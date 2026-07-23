import { AppointmentType, EnquirySource, LeadPriority, LeadStatus } from '@prisma/client';
import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional(),
  address: z.string().optional(),
  source: z.nativeEnum(EnquirySource),
  priority: z.nativeEnum(LeadPriority).default(LeadPriority.MEDIUM),
  nextFollowupAt: z.coerce.date().optional(),
  lastContactedAt: z.coerce.date().optional(),
  followupNotes: z.string().optional(),
  interestedTreatment: z.string().optional(),
  branchId: z.string().min(1),
  appointmentType: z.nativeEnum(AppointmentType).default(AppointmentType.CLINIC_VISIT),
  appointmentAt: z.coerce.date().optional(),
  ownerId: z.string().optional(),
  nextAction: z.string().min(1).optional(),
  nextActionDueAt: z.coerce.date().optional(),
});

export const updateLeadSchema = createLeadSchema
  .partial()
  .extend({
    status: z.nativeEnum(LeadStatus).optional(),
    qualificationStatus: z.string().optional(),
    qualificationNotes: z.string().optional(),
    leadScore: z.coerce.number().int().min(0).max(100).optional(),
    lostReason: z.string().optional(),
    lostNotes: z.string().optional(),
    disqualificationReason: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const leadQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(EnquirySource).optional(),
  search: z.string().optional(),
});

export const duplicateLeadQuerySchema = z.object({
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  branchId: z.string().optional(),
}).refine((value) => Boolean(value.mobile || value.email), 'Mobile or email is required');
