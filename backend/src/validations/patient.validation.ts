import { EnquirySource, LeadStatus, Sex } from '@prisma/client';
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
  surgicalHistory: z.string().optional(),
  productAllergies: z.string().optional(),
  foodAllergies: z.string().optional(),
  previousAestheticProcedures: z.string().optional(),
  hairProductsUsed: z.string().optional(),
  breastfeedingStatus: z.string().optional(),
  familyHistory: z.string().optional(),
  smokingStatus: z.string().optional(),
  alcoholHistory: z.string().optional(),
  clinicalAlerts: z.string().optional(),
  criticalAlert: z.boolean().optional(),
  keloidOrHypertrophicScar: z.string().optional(),
  productsCurrentlyUsed: z.string().optional(),
  menstrualHistory: z.string().optional(),
  pregnancyStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const medicalProfileSchema = z.object({
  reasonForChange: z.string().min(2).optional(),
  referredBy: z.string().optional(),
  skinConcern: z.string().optional(),
  hairConcern: z.string().optional(),
  medicalHistory: z.string().optional(),
  currentMedications: z.string().optional(),
  allergyToDrugs: z.string().optional(),
  surgicalHistory: z.string().optional(),
  productAllergies: z.string().optional(),
  foodAllergies: z.string().optional(),
  previousAestheticProcedures: z.string().optional(),
  hairProductsUsed: z.string().optional(),
  breastfeedingStatus: z.string().optional(),
  familyHistory: z.string().optional(),
  smokingStatus: z.string().optional(),
  alcoholHistory: z.string().optional(),
  clinicalAlerts: z.string().optional(),
  criticalAlert: z.boolean().optional(),
  keloidOrHypertrophicScar: z.string().optional(),
  productsCurrentlyUsed: z.string().optional(),
  menstrualHistory: z.string().optional(),
  pregnancyStatus: z.string().optional(),
  notes: z.string().optional(),
});

export const patientQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
  leadStatus: z.nativeEnum(LeadStatus).optional(),
  leadSource: z.nativeEnum(EnquirySource).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const importPatientsSchema = z.object({
  branchId: z.string().min(1),
  rows: z.array(z.object({
    fullName: z.string().trim().min(2),
    mobile: z.string().trim().min(8),
    email: z.string().trim().email().optional(),
    age: z.coerce.number().int().positive().max(120).optional(),
    sex: z.nativeEnum(Sex).optional(),
    address: z.string().trim().optional(),
    occupation: z.string().trim().optional(),
    maritalStatus: z.string().trim().optional(),
    referredBy: z.string().trim().optional(),
    medicalHistory: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })).min(1).max(5000),
});
