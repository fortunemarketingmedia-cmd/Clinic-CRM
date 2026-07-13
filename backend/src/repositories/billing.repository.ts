import type { PaymentMode } from '@prisma/client';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

function getInvoiceStatus(totalAmount: number, paidAmount: number) {
  if (paidAmount <= 0) return InvoiceStatus.DRAFT;
  if (paidAmount >= totalAmount) return InvoiceStatus.PAID;
  return InvoiceStatus.PARTIAL;
}

export const billingRepository = {
  listInvoices(filters: { branchId?: string; patientId?: string }) {
    return prisma.invoice.findMany({
      where: filters,
      include: { patient: true, branch: true, payments: true },
      orderBy: { invoiceDate: 'desc' },
    });
  },

  findInvoice(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { patient: true, branch: true, payments: true },
    });
  },

  async nextInvoiceNo(prefix: string) {
    const count = await prisma.invoice.count();
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  },

  createInvoice(data: {
    invoiceNo: string;
    patientId: string;
    branchId: string;
    serviceName: string;
    consultationFee: number;
    packageFee: number;
    discount: number;
    gstAmount: number;
    totalAmount: number;
    notes?: string;
  }) {
    return prisma.invoice.create({
      data,
      include: { patient: true, branch: true, payments: true },
    });
  },

  addPayment(invoiceId: string, data: {
    patientId: string;
    amount: number;
    mode: PaymentMode;
    paidAt?: Date;
    reference?: string;
    notes?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      const payment = await tx.payment.create({
        data: { invoiceId, ...data },
      });
      const paidAmount = Number(invoice.paidAmount) + data.amount;
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount,
          status: getInvoiceStatus(Number(invoice.totalAmount), paidAmount),
        },
      });
      return payment;
    });
  },
};
