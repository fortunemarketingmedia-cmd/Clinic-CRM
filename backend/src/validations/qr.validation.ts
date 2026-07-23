import { Sex } from '@prisma/client';
import { z } from 'zod';

export const qrRegistrationSchema = z.object({
  branchId: z.string().optional(),
  referredBy: z.string().optional(),
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  age: z.coerce.number().int().positive().optional(),
  sex: z.nativeEnum(Sex).optional(),
  mobile: z.string().min(8),
  address: z.string().optional(),
  maritalStatus: z.string().optional(),
  occupation: z.string().optional(),
  skinConcern: z.string().optional(),
  hairConcern: z.string().optional(),
  medicalHistory: z.string().optional(),
  currentMedications: z.string().optional(),
  allergyToDrugs: z.string().optional(),
  keloidOrHypertrophicScar: z.string().optional(),
  productsCurrentlyUsed: z.string().optional(),
  menstrualHistory: z.string().optional(),
  pregnancyStatus: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();
