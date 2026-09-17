import PDFDocument from 'pdfkit';
import { prisma } from '../config/db.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { mailService } from './mail.service.js';

function pdfBuffer(render: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    doc.end();
  });
}

function money(value: number) {
  return `Rs ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value?: Date) {
  return value ? value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

type TaxType = 'ALL' | 'GST' | 'NON_GST';

async function buildOverview(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }) {
  return analyticsRepository.overview(filters);
}

async function buildFinancePdf(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; taxType: TaxType }) {
  const settings = await settingsRepository.getOrCreate();
  const overview = await buildOverview(filters);
  const financial = overview.analytics.financial;
  const rowCount = filters.taxType === 'GST' ? financial.gst.invoices : filters.taxType === 'NON_GST' ? financial.nonGst.invoices : financial.invoices;
  const scopeLabel = filters.taxType === 'GST' ? 'GST invoices only' : filters.taxType === 'NON_GST' ? 'Non-GST invoices only' : 'GST + Non-GST invoices';

  const buffer = await pdfBuffer((doc) => {
    const brand = settings.clinicName || 'Clinic';
    const legalName = settings.legalName || brand;
    const address = settings.businessAddress || '';
    const line = (y: number) => doc.moveTo(48, y).lineTo(548, y).strokeColor('#d8c7ca').lineWidth(0.7).stroke();

    // Header
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#a51d2d').text(brand, 48, 42, { width: 320 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#241719').text('FINANCE ANALYTICS REPORT', 380, 46, { width: 168, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#5f5053').text(legalName, 48, 68);
    if (address) doc.text(address, 48, 82, { width: 320 });
    if (settings.businessPhone) doc.text(`Phone: ${settings.businessPhone}`, 48, 108);
    if (settings.clinicEmail) doc.text(`Email: ${settings.clinicEmail}`, 48, 122);
    if (settings.gstNumber) doc.font('Helvetica-Bold').fillColor('#241719').text(`GSTIN: ${settings.gstNumber}`, 380, 68, { width: 168, align: 'right' });
    line(148);

    // Report metadata
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#241719').text('Report period', 48, 166).text('Report scope', 48, 188).text('Generated on', 48, 210);
    doc.font('Helvetica').fillColor('#5f5053')
      .text(`${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}`, 160, 166, { width: 388, align: 'right' })
      .text(scopeLabel, 160, 188, { width: 388, align: 'right' })
      .text(`${formatDate(new Date())} - Prepared for Chartered Accountant / audit review`, 160, 210, { width: 388, align: 'right' });

    let y = 246;
    const sectionHeader = (title: string) => {
      doc.rect(48, y, 500, 22).fill('#a51d2d');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(title, 56, y + 6);
      y += 22;
    };
    const rows = (entries: Array<[string, string, boolean?]>) => {
      entries.forEach(([label, value, bold], index) => {
        const rowHeight = 20;
        if (y + rowHeight > 760) { doc.addPage(); y = 56; }
        if (index % 2 === 0) doc.rect(48, y, 500, rowHeight).fill('#faf6f6');
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor('#241719')
          .text(label, 56, y + 6, { width: 300 })
          .text(value, 380, y + 6, { width: 160, align: 'right' });
        y += rowHeight;
      });
      y += 14;
    };

    if (filters.taxType === 'ALL') {
      sectionHeader('OVERALL SUMMARY');
      rows([
        ['Total invoices', String(financial.invoices)],
        ['Subtotal', money(financial.subtotal)],
        ['Discounts given', money(financial.discounts)],
        ['Tax collected', money(financial.taxCollected)],
        ['Total billed', money(financial.billed)],
        ['Total collected', money(financial.collected)],
        ['Outstanding', money(financial.outstanding)],
        ['Collection rate', `${financial.collectionRate}%`, true],
      ]);
    }

    if (filters.taxType === 'ALL' || filters.taxType === 'GST') {
      sectionHeader('GST INVOICES');
      rows([
        ['GST invoice count', String(financial.gst.invoices)],
        ['GST billed', money(financial.gst.billed)],
        ['GST tax amount', money(financial.gst.tax)],
        ['GST collected', money(financial.gst.collected), true],
      ]);
    }

    if (filters.taxType === 'ALL' || filters.taxType === 'NON_GST') {
      sectionHeader('NON-GST INVOICES');
      rows([
        ['Non-GST invoice count', String(financial.nonGst.invoices)],
        ['Non-GST billed', money(financial.nonGst.billed)],
        ['Non-GST collected', money(financial.nonGst.collected), true],
      ]);
    }

    if (filters.taxType === 'ALL' && financial.byStatus.length) {
      sectionHeader('INVOICE VALUE BY STATUS');
      rows(financial.byStatus.map((item) => [item.name.replaceAll('_', ' '), money(item.amount ?? 0)] as [string, string]));
    }

    if (y + 40 > 780) { doc.addPage(); y = 56; }
    line(y);
    doc.font('Helvetica').fontSize(7.5).fillColor('#8a7a7c').text(
      'This report is system-generated from clinic billing records and is provided for accounting and tax-filing reference. Figures are in Indian Rupees (INR).',
      48,
      y + 10,
      { width: 500 },
    );
  });
  return { buffer, financial, rowCount };
}

function financeCsv(financial: Awaited<ReturnType<typeof buildFinancePdf>>['financial'], taxType: TaxType) {
  const lines: string[] = ['Metric,Value'];
  const push = (label: string, value: string | number) => lines.push(`"${label}",${value}`);
  if (taxType === 'ALL') {
    push('Total invoices', financial.invoices);
    push('Subtotal', financial.subtotal);
    push('Discounts given', financial.discounts);
    push('Tax collected', financial.taxCollected);
    push('Total billed', financial.billed);
    push('Total collected', financial.collected);
    push('Outstanding', financial.outstanding);
    push('Collection rate (%)', financial.collectionRate);
  }
  if (taxType === 'ALL' || taxType === 'GST') {
    push('GST invoice count', financial.gst.invoices);
    push('GST billed', financial.gst.billed);
    push('GST tax amount', financial.gst.tax);
    push('GST collected', financial.gst.collected);
  }
  if (taxType === 'ALL' || taxType === 'NON_GST') {
    push('Non-GST invoice count', financial.nonGst.invoices);
    push('Non-GST billed', financial.nonGst.billed);
    push('Non-GST collected', financial.nonGst.collected);
  }
  if (taxType === 'ALL') {
    financial.byStatus.forEach((item) => push(`Invoice value - ${item.name}`, item.amount ?? 0));
  }
  return lines.join('\n');
}

export const financeExportService = {
  async export(
    filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; format: 'pdf' | 'csv'; taxType: TaxType },
    actor: { id: string; role: string },
  ) {
    const { buffer: pdf, financial, rowCount } = await buildFinancePdf(filters);
    const result =
      filters.format === 'csv'
        ? { buffer: Buffer.from(financeCsv(financial, filters.taxType), 'utf-8'), contentType: 'text/csv', filename: 'finance-analytics.csv' }
        : { buffer: pdf, contentType: 'application/pdf', filename: 'finance-analytics.pdf' };
    await prisma.exportLog.create({
      data: {
        userId: actor.id,
        branchId: filters.branchId,
        resourceType: 'FINANCE_ANALYTICS',
        format: filters.format.toUpperCase(),
        filters: { dateFrom: filters.dateFrom?.toISOString(), dateTo: filters.dateTo?.toISOString(), taxType: filters.taxType },
        rowCount,
        status: 'COMPLETED',
        purpose: 'Finance analytics download',
        correlationId: `finance-export-${Date.now()}`,
        completedAt: new Date(),
      },
    });
    return result;
  },

  async emailReport(
    filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; recipientEmail: string; taxType: TaxType },
    actor: { id: string; role: string },
  ) {
    const { buffer, rowCount } = await buildFinancePdf(filters);
    try {
      await mailService.sendMail({
        to: filters.recipientEmail,
        subject: 'Finance analytics report',
        text: `Please find attached the finance analytics report for ${formatDate(filters.dateFrom)} to ${formatDate(filters.dateTo)} (${filters.taxType === 'GST' ? 'GST invoices only' : filters.taxType === 'NON_GST' ? 'Non-GST invoices only' : 'GST + Non-GST invoices'}).`,
        attachments: [{ filename: 'finance-analytics.pdf', content: buffer, contentType: 'application/pdf' }],
      });
    } catch (error) {
      await prisma.exportLog.create({
        data: {
          userId: actor.id,
          branchId: filters.branchId,
          resourceType: 'FINANCE_ANALYTICS',
          format: 'EMAIL',
          filters: { dateFrom: filters.dateFrom?.toISOString(), dateTo: filters.dateTo?.toISOString(), recipientEmail: filters.recipientEmail, taxType: filters.taxType },
          rowCount,
          status: 'FAILED',
          purpose: 'Finance analytics emailed to recipient',
          correlationId: `finance-export-${Date.now()}`,
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
    await prisma.exportLog.create({
      data: {
        userId: actor.id,
        branchId: filters.branchId,
        resourceType: 'FINANCE_ANALYTICS',
        format: 'EMAIL',
        filters: { dateFrom: filters.dateFrom?.toISOString(), dateTo: filters.dateTo?.toISOString(), recipientEmail: filters.recipientEmail, taxType: filters.taxType },
        rowCount,
        status: 'COMPLETED',
        purpose: 'Finance analytics emailed to recipient',
        correlationId: `finance-export-${Date.now()}`,
        completedAt: new Date(),
      },
    });
    return { sent: true };
  },

  async recentRecipients(branchId?: string) {
    const rows = await prisma.exportLog.findMany({
      where: { resourceType: 'FINANCE_ANALYTICS', format: 'EMAIL', status: 'COMPLETED', ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { filters: true },
    });
    const seen = new Set<string>();
    for (const row of rows) {
      const email = (row.filters as { recipientEmail?: string } | null)?.recipientEmail;
      if (email) seen.add(email);
      if (seen.size >= 10) break;
    }
    return Array.from(seen);
  },
};
