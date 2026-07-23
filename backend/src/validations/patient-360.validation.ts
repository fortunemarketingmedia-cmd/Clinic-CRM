import {
  ClinicalConsentStatus,
  EncounterStatus,
  EncounterType,
  PatientAcceptanceStatus,
  PrescriptionStatus,
  ProcedureSessionStatus,
  TreatmentPlanStatus,
} from '@prisma/client';
import { z } from 'zod';

const optionalText = z.string().trim().optional();

export const clinicalListQuerySchema = z.object({ branchId: z.string().optional(), date: z.coerce.date().optional() });

export const encounterSchema = z.object({
  appointmentId: z.string().optional(), branchId: z.string().min(1), doctorId: z.string().min(1), therapistId: z.string().optional(),
  type: z.nativeEnum(EncounterType), visitDate: z.coerce.date(), chiefComplaint: optionalText, history: optionalText,
  examination: optionalText, assessment: optionalText, diagnosis: optionalText, treatmentAdvised: optionalText,
  procedurePerformed: optionalText, followUpPlan: optionalText, clinicalNotes: optionalText, templateKey: optionalText,
  attachments: z.array(z.object({ name: z.string(), url: z.string(), category: z.string().optional() })).optional(),
  status: z.nativeEnum(EncounterStatus).refine((value) => value === 'DRAFT' || value === 'COMPLETED', 'New encounters must be draft or completed').default('DRAFT'),
});

export const encounterUpdateSchema = encounterSchema.omit({ branchId: true, doctorId: true }).partial();
export const addendumSchema = z.object({ content: z.string().trim().min(3) });

const treatmentPlanItemSchema = z.object({
  serviceId: z.string().optional(), name: z.string().trim().min(2), plannedSessions: z.coerce.number().int().positive(),
  completedSessions: z.coerce.number().int().min(0).default(0), frequency: optionalText, practitionerId: z.string().optional(),
  estimatedAmount: z.coerce.number().min(0).optional(), notes: optionalText,
});

export const treatmentPlanSchema = z.object({
  branchId: z.string().min(1), concern: z.string().trim().min(2), diagnosis: optionalText, goals: optionalText,
  assignedDoctorId: z.string().min(1), assignedTherapistId: z.string().optional(), estimatedStartDate: z.coerce.date().optional(),
  estimatedEndDate: z.coerce.date().optional(), estimatedCost: z.coerce.number().min(0).optional(),
  status: z.nativeEnum(TreatmentPlanStatus).refine((value) => value === 'DRAFT', 'New treatment plans must begin as drafts').default('DRAFT'), patientAcceptance: z.nativeEnum(PatientAcceptanceStatus).default('PENDING'),
  consentStatus: z.nativeEnum(ClinicalConsentStatus).default('PENDING'), reviewDate: z.coerce.date().optional(), outcome: optionalText,
  notes: optionalText, items: z.array(treatmentPlanItemSchema).min(1),
});

export const treatmentPlanUpdateSchema = z.object({
  status: z.nativeEnum(TreatmentPlanStatus).optional(), patientAcceptance: z.nativeEnum(PatientAcceptanceStatus).optional(),
  consentStatus: z.nativeEnum(ClinicalConsentStatus).optional(), reviewDate: z.coerce.date().optional(), outcome: optionalText, notes: optionalText,
});

export const procedureSessionSchema = z.object({
  appointmentId: z.string().optional(), encounterId: z.string().optional(), treatmentPlanId: z.string().optional(),
  treatmentPlanItemId: z.string().optional(), packageId: z.string().optional(), branchId: z.string().min(1),
  procedureName: z.string().trim().min(2), treatmentArea: optionalText, practitionerId: z.string().min(1), assistantId: z.string().optional(),
  roomId: z.string().optional(), deviceId: z.string().optional(), deviceSerialNumber: optionalText,
  deviceParameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  consumables: z.array(z.object({ name: z.string(), quantity: z.number().positive(), unit: z.string().optional() })).optional(),
  batchNumbers: z.array(z.string()).optional(), preProcedureChecklist: z.record(z.string(), z.boolean()).optional(),
  consentVerified: z.boolean().default(false), anaesthesia: optionalText, procedureNotes: optionalText, patientTolerance: optionalText,
  immediateReaction: optionalText, complication: optionalText, postCareInstructions: optionalText, followUpDate: z.coerce.date().optional(),
  beforeImages: z.array(z.string()).optional(), afterImages: z.array(z.string()).optional(), adverseEventFlag: z.boolean().default(false),
  status: z.nativeEnum(ProcedureSessionStatus).default('PLANNED'), performedAt: z.coerce.date().optional(),
});

const prescriptionItemSchema = z.object({
  medicineId: z.string().optional(), medicineName: z.string().trim().min(2), genericName: optionalText, strength: optionalText,
  dosage: z.string().trim().min(1), frequency: z.string().trim().min(1), duration: z.string().trim().min(1),
  route: optionalText, timing: optionalText, instructions: optionalText,
});

export const prescriptionSchema = z.object({
  encounterId: z.string().optional(), doctorId: z.string().min(1), prescribedAt: z.coerce.date().optional(),
  diagnosisSummary: optionalText, instructions: optionalText, precautions: optionalText, followUpDate: z.coerce.date().optional(),
  status: z.nativeEnum(PrescriptionStatus).refine((value) => value === 'DRAFT', 'New prescriptions must be drafts').default('DRAFT'),
  items: z.array(prescriptionItemSchema).min(1),
});

export const medicineQuerySchema = z.object({ search: z.string().optional() });
