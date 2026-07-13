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
});

export const updateLeadSchema = createLeadSchema
  .partial()
  .extend({
    status: z.nativeEnum(LeadStatus).optional(),
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
}).refine((value) => Boolean(value.mobile || value.email), 'Mobile or email is required');
