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

async function buildOverview(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }) {
  return analyticsRepository.overview(filters);
}

async function buildFinancePdf(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }) {
  const settings = await settingsRepository.getOrCreate();
  const overview = await buildOverview(filters);
  const financial = overview.analytics.financial;
  const buffer = await pdfBuffer((doc) => {
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#241719').text(settings.clinicName ?? 'Clinic', { align: 'left' });
    if (settings.gstNumber) doc.font('Helvetica').fontSize(9).fillColor('#5c4a4a').text(`GSTIN: ${settings.gstNumber}`);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#241719').text('Finance analytics report');
    doc.font('Helvetica').fontSize(9).fillColor('#5c4a4a').text(`Period: ${formatDate(filters.dateFrom)} to ${formatDate(filters.dateTo)}`);
    doc.text(`Generated: ${formatDate(new Date())}`);
    doc.moveDown();

    const row = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor('#241719')
        .text(label, { continued: true, width: 260 })
        .text(value, { align: 'right' });
    };

    doc.font('Helvetica-Bold').fontSize(12).text('Overall summary');
    doc.moveDown(0.3);
    row('Total invoices', String(financial.invoices));
    row('Subtotal', money(financial.subtotal));
    row('Discounts given', money(financial.discounts));
    row('Tax collected', money(financial.taxCollected));
    row('Total billed', money(financial.billed));
    row('Total collected', money(financial.collected));
    row('Outstanding', money(financial.outstanding));
    row('Collection rate', `${financial.collectionRate}%`, true);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('GST invoices');
    doc.moveDown(0.3);
    row('GST invoice count', String(financial.gst.invoices));
    row('GST billed', money(financial.gst.billed));
    row('GST tax amount', money(financial.gst.tax));
    row('GST collected', money(financial.gst.collected));
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('Non-GST invoices');
    doc.moveDown(0.3);
    row('Non-GST invoice count', String(financial.nonGst.invoices));
    row('Non-GST billed', money(financial.nonGst.billed));
    row('Non-GST collected', money(financial.nonGst.collected));
    doc.moveDown();

    if (financial.byStatus.length) {
      doc.font('Helvetica-Bold').fontSize(12).text('Invoice value by status');
      doc.moveDown(0.3);
      financial.byStatus.forEach((item) => row(item.name.replaceAll('_', ' '), money(item.amount ?? 0)));
    }
  });
  return { buffer, financial, rowCount: financial.invoices };
}

function financeCsv(financial: Awaited<ReturnType<typeof buildFinancePdf>>['financial']) {
  const lines: string[] = ['Metric,Value'];
  const push = (label: string, value: string | number) => lines.push(`"${label}",${value}`);
  push('Total invoices', financial.invoices);
  push('Subtotal', financial.subtotal);
  push('Discounts given', financial.discounts);
  push('Tax collected', financial.taxCollected);
  push('Total billed', financial.billed);
  push('Total collected', financial.collected);
  push('Outstanding', financial.outstanding);
  push('Collection rate (%)', financial.collectionRate);
  push('GST invoice count', financial.gst.invoices);
  push('GST billed', financial.gst.billed);
  push('GST tax amount', financial.gst.tax);
  push('GST collected', financial.gst.collected);
  push('Non-GST invoice count', financial.nonGst.invoices);
  push('Non-GST billed', financial.nonGst.billed);
  push('Non-GST collected', financial.nonGst.collected);
  financial.byStatus.forEach((item) => push(`Invoice value - ${item.name}`, item.amount ?? 0));
  return lines.join('\n');
}

export const financeExportService = {
  async export(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; format: 'pdf' | 'csv' }, actor: { id: string; role: string }) {
    const { buffer: pdf, financial, rowCount } = await buildFinancePdf(filters);
    const result =
      filters.format === 'csv'
        ? { buffer: Buffer.from(financeCsv(financial), 'utf-8'), contentType: 'text/csv', filename: 'finance-analytics.csv' }
        : { buffer: pdf, contentType: 'application/pdf', filename: 'finance-analytics.pdf' };
    await prisma.exportLog.create({
      data: {
        userId: actor.id,
        branchId: filters.branchId,
        resourceType: 'FINANCE_ANALYTICS',
        format: filters.format.toUpperCase(),
        filters: { dateFrom: filters.dateFrom?.toISOString(), dateTo: filters.dateTo?.toISOString() },
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
    filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; recipientEmail: string },
    actor: { id: string; role: string },
  ) {
    const { buffer, rowCount } = await buildFinancePdf(filters);
    try {
      await mailService.sendMail({
        to: filters.recipientEmail,
        subject: 'Finance analytics report',
        text: `Please find attached the finance analytics report for ${formatDate(filters.dateFrom)} to ${formatDate(filters.dateTo)}.`,
        attachments: [{ filename: 'finance-analytics.pdf', content: buffer, contentType: 'application/pdf' }],
      });
    } catch (error) {
      await prisma.exportLog.create({
        data: {
          userId: actor.id,
          branchId: filters.branchId,
          resourceType: 'FINANCE_ANALYTICS',
          format: 'EMAIL',
          filters: { dateFrom: filters.dateFrom?.toISOString(), dateTo: filters.dateTo?.toISOString(), recipientEmail: filters.recipientEmail },
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
        filters: { dateFrom: filters.dateFrom?.toISOString(), dateTo: filters.dateTo?.toISOString(), recipientEmail: filters.recipientEmail },
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
