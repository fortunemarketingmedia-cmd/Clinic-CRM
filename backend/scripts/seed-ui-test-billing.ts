/**
 * Adds synthetic packages, invoices, payments and prescriptions to the patients created by
 * seed-ui-test-data.ts. Refuses to run unless the database name ends in `_uitest`.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

import { assertDummyDataTarget } from './ui-test-guard.js';

const dbName = assertDummyDataTarget();

const prisma = new PrismaClient();
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day);

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const patients = await prisma.patient.findMany({ where: { email: { endsWith: '@example.test' }, deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 8 });
  const plans = [
    { name: 'Laser hair reduction · 6 sessions', total: 6, done: 2, amount: 18000 },
    { name: 'Acne clearing programme · 4 sessions', total: 4, done: 4, amount: 9600 },
    { name: 'HIFU face lift · 3 sessions', total: 3, done: 1, amount: 24000 },
  ];
  const invoiceStates = [
    { status: 'PAID', total: 18000, paid: 18000 },
    { status: 'PARTIAL', total: 9600, paid: 4000 },
    { status: 'ISSUED', total: 24000, paid: 0 },
    { status: 'OVERDUE', total: 3500, paid: 0 },
  ] as const;

  for (const [index, patient] of patients.entries()) {
    const plan = plans[index % plans.length];
    if (index < 6) {
      await prisma.treatmentPackage.create({ data: {
        patientId: patient.id, branchId: patient.branchId, name: plan.name, totalSessions: plan.total, completedSessions: plan.done, amount: plan.amount,
        paidAmount: plan.amount / 2, outstandingAmount: plan.amount / 2, status: plan.done === plan.total ? 'COMPLETED' : 'ACTIVE', purchaseDate: ago(20 - index), expiryDate: new Date(Date.now() + 120 * day),
      } });
    }
    if (index < 4) {
      const state = invoiceStates[index];
      const invoice = await prisma.invoice.create({ data: {
        invoiceNo: `INV-UITEST-${String(index + 1).padStart(4, '0')}`, patientId: patient.id, branchId: patient.branchId, invoiceDate: ago(12 - index), dueDate: ago(index === 3 ? 4 : -7), issuedAt: ago(12 - index),
        serviceName: plan.name, subtotal: state.total, totalAmount: state.total, paidAmount: state.paid, outstandingAmount: state.total - state.paid, status: state.status, createdById: admin.id,
        items: { create: [{ type: 'SERVICE', description: plan.name, quantity: 1, unitPrice: state.total, totalAmount: state.total }] },
      } });
      if (state.paid > 0) {
        await prisma.payment.create({ data: { paymentNo: `PAY-UITEST-${index + 1}`, patientId: patient.id, branchId: patient.branchId, invoiceId: invoice.id, amount: state.paid, allocatedAmount: state.paid, mode: index % 2 ? 'UPI' : 'CARD', paidAt: ago(10 - index), collectedById: admin.id } });
      }
    }
    if (index < 5) {
      await prisma.prescription.create({ data: {
        prescriptionNo: `RX-UITEST-${String(index + 1).padStart(4, '0')}`, patientId: patient.id, doctorId: admin.id, prescribedAt: ago(index + 1), diagnosisSummary: 'Synthetic diagnosis for UI review', consultationSummary: 'Synthetic consultation summary',
        instructions: 'Apply as directed. Avoid direct sun exposure.', followUpDate: new Date(Date.now() + 14 * day), status: index % 3 === 2 ? 'DRAFT' : 'SIGNED', signedById: index % 3 === 2 ? undefined : admin.id, signedAt: index % 3 === 2 ? undefined : ago(index + 1),
        items: { create: [
          { medicineName: 'Synthetic Sunscreen SPF 50', dosage: 'Apply', frequency: 'Twice daily', duration: '30 days', route: 'Topical', timing: 'Morning' },
          { medicineName: 'Synthetic Retinoid Cream', genericName: 'Retinoid', strength: '0.025%', dosage: 'Pea-sized amount', frequency: 'Once daily', duration: '4 weeks', route: 'Topical', timing: 'Night', instructions: 'Start every alternate night.' },
        ] },
      } });
    }
  }
  console.log({ packages: 6, invoices: 4, prescriptions: 5, db: dbName });
}

main().finally(() => prisma.$disconnect());
