import { PaymentMode } from '@prisma/client';
import { z } from 'zod';

export const invoiceSchema = z.object({
  patientId: z.string().min(1),
  branchId: z.string().min(1),
  serviceName: z.string().min(2),
  consultationFee: z.coerce.number().min(0).default(0),
  packageFee: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  gstAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  patientId: z.string().min(1),
  amount: z.coerce.number().positive(),
  mode: z.nativeEnum(PaymentMode),
  paidAt: z.coerce.date().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const invoiceQuerySchema = z.object({
  branchId: z.string().optional(),
  patientId: z.string().optional(),
});
