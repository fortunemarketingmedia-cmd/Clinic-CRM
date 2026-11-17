import PDFDocument from 'pdfkit';
import { prisma } from '../config/db.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { analyticsRepository } from '../repositories/analytics.repository.js';
import { mailService } from './mail.service.js';
import { HttpError } from '../utils/http-error.js';
import { cleanPhone } from './pdf-theme.js';

function pdfBuffer(render: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    render(doc);
    // Page numbers on every page once the final page count is known.
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index);
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(7.5).fillColor('#6B7B86').text(`Page ${index + 1} of ${range.count}`, 48, 780, { width: 500, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

function money(value: number) {
  return `Rs ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value?: Date) {
  return value ? value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

type SettingsRow = Awaited<ReturnType<typeof settingsRepository.getOrCreate>>;
type RegisterRow = { invoiceNo: string; date: Date; patient: string; patientNo: string; branch: string; gst: boolean; taxable: number; tax: number; total: number; paid: number; due: number; status: string };
type Register = { rows: RegisterRow[]; paymentsByMode: Array<{ mode: string; count: number; amount: number }> };
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

/** Finance reports are legal documents: refuse to produce one while the clinic profile is incomplete. */
function assertClinicProfile(settings: SettingsRow, taxType: TaxType) {
  const missing: string[] = [];
  if (!(settings.legalName || settings.clinicName)) missing.push('clinic or legal name');
  if (!settings.businessAddress) missing.push('business address');
  if (taxType !== 'NON_GST' && !settings.gstNumber) missing.push('GSTIN');
  if (missing.length) throw new HttpError(409, `Complete the clinic profile in Settings (${missing.join(', ')}) before exporting finance reports.`);
}

async function loadRegister(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; taxType: TaxType }): Promise<Register> {
  const dateRange = filters.dateFrom || filters.dateTo ? { gte: filters.dateFrom, lte: filters.dateTo } : undefined;
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'REFUNDED'] }, branchId: filters.branchId || undefined, invoiceDate: dateRange },
    include: { patient: { select: { fullName: true, patientNo: true } }, branch: { select: { name: true } } },
    orderBy: [{ invoiceDate: 'asc' }, { invoiceNo: 'asc' }],
  });
  const rows = invoices
    .map((invoice): RegisterRow => ({
      invoiceNo: invoice.invoiceNo, date: invoice.invoiceDate, patient: invoice.patient.fullName, patientNo: invoice.patient.patientNo, branch: invoice.branch.name,
      gst: Number(invoice.taxAmount) > 0, taxable: Number(invoice.subtotal) - Number(invoice.discount), tax: Number(invoice.taxAmount), total: Number(invoice.totalAmount),
      paid: Number(invoice.paidAmount), due: Number(invoice.outstandingAmount), status: invoice.status,
    }))
    .filter((row) => filters.taxType === 'ALL' || (filters.taxType === 'GST' ? row.gst : !row.gst));
  const grouped = await prisma.payment.groupBy({
    by: ['mode'], where: { status: 'COMPLETED', deletedAt: null, branchId: filters.branchId || undefined, paidAt: dateRange }, _sum: { amount: true }, _count: { _all: true },
  });
  return { rows, paymentsByMode: grouped.map((item) => ({ mode: item.mode, count: item._count._all, amount: Number(item._sum.amount ?? 0) })).sort((a, b) => b.amount - a.amount) };
}

type TaxType = 'ALL' | 'GST' | 'NON_GST';

async function buildOverview(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date }) {
  return analyticsRepository.overview(filters);
}

async function buildFinancePdf(filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; taxType: TaxType }) {
  const settings = await settingsRepository.getOrCreate();
  assertClinicProfile(settings, filters.taxType);
  const register = await loadRegister(filters);
  const overview = await buildOverview(filters);
  const financial = overview.analytics.financial;
  const rowCount = filters.taxType === 'GST' ? financial.gst.invoices : filters.taxType === 'NON_GST' ? financial.nonGst.invoices : financial.invoices;
  const scopeLabel = filters.taxType === 'GST' ? 'GST invoices only' : filters.taxType === 'NON_GST' ? 'Non-GST invoices only' : 'GST + Non-GST invoices';

  const buffer = await pdfBuffer((doc) => {
    const brand = settings.clinicName || settings.legalName || '';
    const legalName = settings.legalName || brand;
    const address = settings.businessAddress || '';
    const line = (y: number) => doc.moveTo(48, y).lineTo(548, y).strokeColor('#D5E2E4').lineWidth(0.7).stroke();

    // Header
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#176B78').text(brand, 48, 42, { width: 320 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#253640').text('FINANCE REPORT', 380, 46, { width: 168, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#5F6F7B').text(legalName, 48, 68);
    if (address) doc.text(address, 48, 82, { width: 320 });
    if (cleanPhone(settings.businessPhone)) doc.text(`Phone: ${cleanPhone(settings.businessPhone)}`, 48, 108);
    if (settings.clinicEmail) doc.text(`Email: ${settings.clinicEmail}`, 48, 122);
    if (settings.gstNumber) doc.font('Helvetica-Bold').fillColor('#253640').text(`GSTIN: ${settings.gstNumber}`, 380, 68, { width: 168, align: 'right' });
    line(148);

    // Report metadata
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#253640').text('Report period', 48, 166).text('Report scope', 48, 188).text('Generated on', 48, 210);
    doc.font('Helvetica').fillColor('#5F6F7B')
      .text(filters.dateFrom || filters.dateTo ? `${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}` : 'All dates', 160, 166, { width: 388, align: 'right' })
      .text(scopeLabel, 160, 188, { width: 388, align: 'right' })
      .text(`${formatDate(new Date())} - Prepared for accounting, tax-filing and audit review`, 160, 210, { width: 388, align: 'right' });

    let y = 246;
    const sectionHeader = (title: string) => {
      if (y + 22 + 44 > 760) { doc.addPage(); y = 56; }
      doc.rect(48, y, 500, 22).fill('#176B78');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(title, 56, y + 6);
      y += 22;
    };
    const rows = (entries: Array<[string, string, boolean?]>) => {
      entries.forEach(([label, value, bold], index) => {
        const rowHeight = 20;
        if (y + rowHeight > 760) { doc.addPage(); y = 56; }
        if (index % 2 === 0) doc.rect(48, y, 500, rowHeight).fill('#F1F8F7');
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor('#253640')
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

    if (register.paymentsByMode.length) {
      sectionHeader('PAYMENTS RECEIVED BY MODE');
      rows([...register.paymentsByMode.map((item) => [`${item.mode.replaceAll('_', ' ')} (${item.count} payment${item.count === 1 ? '' : 's'})`, money(item.amount)] as [string, string]), ['Total received', money(register.paymentsByMode.reduce((sum, item) => sum + item.amount, 0)), true]]);
    }

    // Itemised invoice register: the schedule an accountant reconciles against.
    doc.addPage(); y = 56;
    sectionHeader('INVOICE REGISTER');
    const cols = { no: 52, date: 118, patient: 170, taxable: 278, tax: 336, total: 390, paid: 446, due: 496 };
    const header = () => {
      doc.rect(48, y, 500, 18).fill('#F1F8F7');
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#253640')
        .text('INVOICE NO', cols.no, y + 6, { width: 62, lineBreak: false }).text('DATE', cols.date, y + 6, { width: 50, lineBreak: false }).text('PATIENT', cols.patient, y + 6, { width: 100, lineBreak: false })
        .text('TAXABLE', cols.taxable, y + 6, { width: 54, align: 'right', lineBreak: false }).text('GST', cols.tax, y + 6, { width: 48, align: 'right', lineBreak: false }).text('TOTAL', cols.total, y + 6, { width: 52, align: 'right', lineBreak: false })
        .text('PAID', cols.paid, y + 6, { width: 46, align: 'right', lineBreak: false }).text('DUE', cols.due, y + 6, { width: 48, align: 'right', lineBreak: false });
      y += 18;
    };
    header();
    const plain = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    for (const row of register.rows) {
      if (y + 16 > 770) { doc.addPage(); y = 56; header(); }
      doc.font('Helvetica').fontSize(7.5).fillColor('#253640')
        .text(row.invoiceNo, cols.no, y + 4, { width: 62, lineBreak: false, ellipsis: true }).text(formatDate(row.date), cols.date, y + 4, { width: 50, lineBreak: false })
        .text(row.patient, cols.patient, y + 4, { width: 100, lineBreak: false, ellipsis: true })
        .text(plain(row.taxable), cols.taxable, y + 4, { width: 54, align: 'right', lineBreak: false }).text(plain(row.tax), cols.tax, y + 4, { width: 48, align: 'right', lineBreak: false })
        .text(plain(row.total), cols.total, y + 4, { width: 52, align: 'right', lineBreak: false }).text(plain(row.paid), cols.paid, y + 4, { width: 46, align: 'right', lineBreak: false }).text(plain(row.due), cols.due, y + 4, { width: 48, align: 'right', lineBreak: false });
      doc.moveTo(48, y + 15).lineTo(548, y + 15).strokeColor('#D5E2E4').lineWidth(0.4).stroke();
      y += 16;
    }
    if (!register.rows.length) { doc.font('Helvetica').fontSize(9).fillColor('#5F6F7B').text('No issued invoices fall in this period and scope.', 52, y + 8); y += 30; }
    else {
      const sum = (pick: (row: RegisterRow) => number) => register.rows.reduce((total, row) => total + pick(row), 0);
      if (y + 20 > 770) { doc.addPage(); y = 56; }
      doc.rect(48, y, 500, 20).fill('#F1F8F7');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#253640').text(`TOTAL (${register.rows.length} invoices)`, cols.no, y + 6, { width: 200, lineBreak: false })
        .text(plain(sum((r) => r.taxable)), cols.taxable, y + 6, { width: 54, align: 'right', lineBreak: false }).text(plain(sum((r) => r.tax)), cols.tax, y + 6, { width: 48, align: 'right', lineBreak: false })
        .text(plain(sum((r) => r.total)), cols.total, y + 6, { width: 52, align: 'right', lineBreak: false }).text(plain(sum((r) => r.paid)), cols.paid, y + 6, { width: 46, align: 'right', lineBreak: false }).text(plain(sum((r) => r.due)), cols.due, y + 6, { width: 48, align: 'right', lineBreak: false });
      y += 30;
    }

    if (y + 40 > 780) { doc.addPage(); y = 56; }
    line(y);
    doc.font('Helvetica').fontSize(7.5).fillColor('#6B7B86').text(
      `Generated from the billing records of ${legalName}. Draft and cancelled invoices are excluded. All figures are in Indian Rupees (INR).`,
      48,
      y + 10,
      { width: 500 },
    );
    if (y + 90 > 790) { doc.addPage(); y = 56; }
    doc.moveTo(388, y + 70).lineTo(548, y + 70).strokeColor('#253640').lineWidth(0.6).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#253640').text(`For ${legalName}`, 388, y + 44, { width: 160, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor('#5F6F7B').text('Authorised signatory', 388, y + 75, { width: 160, align: 'right' });
  });
  return { buffer, financial, rowCount, register, settings };
}

function financeCsv(
  financial: Awaited<ReturnType<typeof buildFinancePdf>>['financial'],
  taxType: TaxType,
  register: Register,
  settings: SettingsRow,
  filters: { dateFrom?: Date; dateTo?: Date },
) {
  const lines: string[] = [];
  const add = (...cells: Array<string | number>) => lines.push(cells.map(csvCell).join(','));
  add('Finance analytics report');
  add('Clinic', settings.legalName || settings.clinicName);
  if (settings.gstNumber) add('GSTIN', settings.gstNumber);
  if (settings.businessAddress) add('Address', settings.businessAddress);
  add('Period', filters.dateFrom || filters.dateTo ? `${formatDate(filters.dateFrom)} - ${formatDate(filters.dateTo)}` : 'All dates');
  add('Scope', taxType === 'GST' ? 'GST invoices only' : taxType === 'NON_GST' ? 'Non-GST invoices only' : 'GST + Non-GST invoices');
  add('Generated on', formatDate(new Date()));
  add('Currency', 'INR');
  lines.push('');
  add('Summary');
  add('Metric', 'Value');
  if (taxType === 'ALL') {
    add('Total invoices', financial.invoices); add('Subtotal', financial.subtotal); add('Discounts given', financial.discounts); add('Tax collected', financial.taxCollected);
    add('Total billed', financial.billed); add('Total collected', financial.collected); add('Outstanding', financial.outstanding); add('Collection rate (%)', financial.collectionRate);
  }
  if (taxType === 'ALL' || taxType === 'GST') { add('GST invoice count', financial.gst.invoices); add('GST billed', financial.gst.billed); add('GST tax amount', financial.gst.tax); add('GST collected', financial.gst.collected); }
  if (taxType === 'ALL' || taxType === 'NON_GST') { add('Non-GST invoice count', financial.nonGst.invoices); add('Non-GST billed', financial.nonGst.billed); add('Non-GST collected', financial.nonGst.collected); }
  lines.push('');
  add('Invoice register');
  add('Invoice no', 'Invoice date', 'Patient', 'Patient no', 'Branch', 'Type', 'Taxable value', 'CGST', 'SGST', 'Total GST', 'Invoice total', 'Paid', 'Outstanding', 'Status');
  const fix = (value: number) => value.toFixed(2);
  for (const row of register.rows) {
    add(row.invoiceNo, row.date.toISOString().slice(0, 10), row.patient, row.patientNo, row.branch, row.gst ? 'GST' : 'Non-GST', fix(row.taxable), fix(row.tax / 2), fix(row.tax / 2), fix(row.tax), fix(row.total), fix(row.paid), fix(row.due), row.status);
  }
  const sum = (pick: (row: RegisterRow) => number) => fix(register.rows.reduce((total, row) => total + pick(row), 0));
  add('Total', '', '', '', '', '', sum((r) => r.taxable), sum((r) => r.tax / 2), sum((r) => r.tax / 2), sum((r) => r.tax), sum((r) => r.total), sum((r) => r.paid), sum((r) => r.due), '');
  lines.push('');
  add('Payments received by mode');
  add('Mode', 'Payments', 'Amount');
  for (const item of register.paymentsByMode) add(item.mode, item.count, fix(item.amount));
  return `\uFEFF${lines.join('\r\n')}`;
}

export const financeExportService = {
  async export(
    filters: { branchId?: string; dateFrom?: Date; dateTo?: Date; format: 'pdf' | 'csv'; taxType: TaxType },
    actor: { id: string; role: string },
  ) {
    const { buffer: pdf, financial, rowCount, register, settings } = await buildFinancePdf(filters);
    const result =
      filters.format === 'csv'
        ? { buffer: Buffer.from(financeCsv(financial, filters.taxType, register, settings, filters), 'utf-8'), contentType: 'text/csv; charset=utf-8', filename: `finance-report-${new Date().toISOString().slice(0, 10)}.csv` }
        : { buffer: pdf, contentType: 'application/pdf', filename: `finance-report-${new Date().toISOString().slice(0, 10)}.pdf` };
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
        attachments: [{ filename: `finance-report-${new Date().toISOString().slice(0, 10)}.pdf`, content: buffer, contentType: 'application/pdf' }],
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
