import { Sex } from '@prisma/client';
import { z } from 'zod';

export const convertLeadSchema = z.object({
  leadId: z.string().min(1),
  fullName: z.string().min(2).optional(),
  mobile: z.string().min(8).optional(),
  email: z.string().email().optional(),
  age: z.coerce.number().int().positive().optional(),
  sex: z.nativeEnum(Sex).optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
});

export const updatePatientSchema = convertLeadSchema.omit({ leadId: true }).partial();

export const createPatientSchema = z.object({
  branchId: z.string().min(1),
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
});

export const medicalProfileSchema = z.object({
  referredBy: z.string().optional(),
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
});

export const patientQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
});
