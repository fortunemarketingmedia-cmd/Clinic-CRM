import PDFDocument from 'pdfkit';
import { billingRepository } from '../repositories/billing.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';

export const billingService = {
  listInvoices(filters: { branchId?: string; patientId?: string }) {
    return billingRepository.listInvoices(filters);
  },

  async createInvoice(input: {
    patientId: string;
    branchId: string;
    serviceName: string;
    consultationFee: number;
    packageFee: number;
    discount: number;
    gstAmount: number;
    notes?: string;
  }) {
    const patient = await patientRepository.findById(input.patientId);
    if (!patient) throw new HttpError(404, 'Patient not found');
    const branch = await branchRepository.exists(input.branchId);
    if (!branch) throw new HttpError(404, 'Branch not found');
    const settings = await settingsRepository.getOrCreate();
    const totalAmount = input.consultationFee + input.packageFee + input.gstAmount - input.discount;

    const invoice = await billingRepository.createInvoice({
      ...input,
      invoiceNo: await billingRepository.nextInvoiceNo(settings.invoicePrefix),
      totalAmount,
    });
    await timelineRepository.create({
      leadId: patient.leadId,
      patientId: patient.id,
      type: 'INVOICE_GENERATED',
      title: 'Invoice generated',
      description: `${invoice.invoiceNo} · Rs ${invoice.totalAmount}`,
    });
    return invoice;
  },

  async addPayment(invoiceId: string, input: {
    patientId: string;
    amount: number;
    mode: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER';
    paidAt?: Date;
    reference?: string;
    notes?: string;
  }) {
    const invoice = await billingRepository.findInvoice(invoiceId);
    if (!invoice) throw new HttpError(404, 'Invoice not found');
    if (invoice.patientId !== input.patientId) throw new HttpError(400, 'Payment patient does not match invoice');
    const payment = await billingRepository.addPayment(invoiceId, input);
    await timelineRepository.create({
      leadId: invoice.patient.leadId,
      patientId: invoice.patientId,
      type: 'PAYMENT_COLLECTED',
      title: 'Payment collected',
      description: `Rs ${payment.amount}`,
    });
    return payment;
  },

  async getInvoicePdf(id: string) {
    const invoice = await billingRepository.findInvoice(id);
    if (!invoice) throw new HttpError(404, 'Invoice not found');
    const settings = await settingsRepository.getOrCreate();

    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(22).text(settings.clinicName, { align: 'center' });
      doc.fontSize(10).text(settings.businessAddress ?? invoice.branch.address, { align: 'center' });
      doc.text(`Phone: ${settings.businessPhone ?? invoice.branch.phone}`, { align: 'center' });
      if (settings.gstNumber) doc.text(`GST: ${settings.gstNumber}`, { align: 'center' });
      doc.moveDown();
      doc.moveTo(48, doc.y).lineTo(548, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(16).text('TAX INVOICE', { align: 'center' });
      doc.moveDown();

      const top = doc.y;
      doc.fontSize(11).text(`Invoice No: ${invoice.invoiceNo}`, 48, top);
      doc.text(`Invoice Date: ${invoice.invoiceDate.toLocaleDateString('en-IN')}`, 48, top + 18);
      doc.text(`Status: ${invoice.status}`, 48, top + 36);
      doc.text(`Patient: ${invoice.patient.fullName}`, 320, top);
      doc.text(`Mobile: ${invoice.patient.mobile}`, 320, top + 18);
      doc.text(`Branch: ${invoice.branch.name}`, 320, top + 36);
      doc.moveDown(4);

      const tableTop = doc.y + 16;
      doc.rect(48, tableTop, 500, 28).fill('#f3f4f6').stroke();
      doc.fillColor('#111827').fontSize(10).text('Service', 60, tableTop + 9);
      doc.text('Amount', 460, tableTop + 9, { width: 70, align: 'right' });
      doc.rect(48, tableTop + 28, 500, 34).stroke();
      doc.text(invoice.serviceName, 60, tableTop + 40);
      doc.text(`Rs ${invoice.totalAmount}`, 460, tableTop + 40, { width: 70, align: 'right' });

      const summaryTop = tableTop + 90;
      const rows = [
        ['Consultation Fee', invoice.consultationFee],
        ['Package Fee', invoice.packageFee],
        ['GST', invoice.gstAmount],
        ['Discount', `-${invoice.discount}`],
        ['Total', invoice.totalAmount],
        ['Paid', invoice.paidAmount],
        ['Balance', Number(invoice.totalAmount) - Number(invoice.paidAmount)],
      ];

      rows.forEach(([label, value], index) => {
        doc.fontSize(index >= 4 ? 12 : 10);
        doc.text(String(label), 340, summaryTop + index * 20);
        doc.text(`Rs ${value}`, 460, summaryTop + index * 20, { width: 70, align: 'right' });
      });

      doc.moveDown(8);
      doc
        .fontSize(10)
        .fillColor('#4b5563')
        .text(settings.invoiceTemplate || 'Thank you for choosing Revive Clinic.', 48, 700, { align: 'center' });
      doc.end();
    });
  },
};
