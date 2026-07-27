import { FileCategory, TreatmentType } from '@prisma/client';
import { z } from 'zod';

export const sessionSchema = z.object({
  appointmentId: z.string().optional(),
  treatmentType: z.nativeEnum(TreatmentType).default(TreatmentType.CONSULTATION),
  visitDate: z.coerce.date(),
  doctorConsulted: z.string().optional(),
  chiefComplaint: z.string().optional(),
  diagnosis: z.string().optional(),
  treatmentSuggested: z.string().optional(),
  treatmentTaken: z.string().optional(),
  medicinesPrescribed: z.string().optional(),
  prescription: z.array(z.object({
    medicine: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().min(1),
    instructions: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
  followupDate: z.coerce.date().optional(),
  packageId: z.string().optional(),
});

export const updateSessionSchema = sessionSchema.partial();

export const packageSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(2),
  totalSessions: z.coerce.number().int().positive(),
  completedSessions: z.coerce.number().int().min(0).default(0),
  amount: z.coerce.number().min(0),
  paidAmount: z.coerce.number().min(0).default(0),
});

export const fileSchema = z.object({
  sessionId: z.string().optional(),
  invoiceId: z.string().optional(),
  category: z.nativeEnum(FileCategory),
  name: z.string().min(1),
  url: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.coerce.number().int().positive().optional(),
});
