import { AppointmentResource, AppointmentType, EnquirySource, LeadStatus } from '@prisma/client';
import { z } from 'zod';

export const createAppointmentSchema = z.object({
  leadId: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  mobile: z.string().min(8).optional(),
  address: z.string().optional(),
  source: z.enum([EnquirySource.WEBSITE, EnquirySource.PHONE_CALL, EnquirySource.WALK_IN]).default(EnquirySource.PHONE_CALL),
  branchId: z.string().min(1),
  appointmentAt: z.coerce.date(),
  appointmentType: z.nativeEnum(AppointmentType).default(AppointmentType.CLINIC_VISIT),
  resourceType: z.nativeEnum(AppointmentResource).default(AppointmentResource.CONSULTATION),
  roomNumber: z.coerce.number().int().min(1).max(4).optional(),
  notes: z.string().optional(),
}).refine((value) => Boolean(value.leadId || (value.name && value.mobile)), {
  message: 'Either an existing lead or appointment contact details are required',
}).refine((value) => value.resourceType !== AppointmentResource.TREATMENT_ROOM || Boolean(value.roomNumber), {
  message: 'Room number is required for treatment room bookings',
  path: ['roomNumber'],
});

export const updateAppointmentSchema = z
  .object({
    branchId: z.string().min(1).optional(),
    appointmentAt: z.coerce.date().optional(),
    appointmentType: z.nativeEnum(AppointmentType).optional(),
    resourceType: z.nativeEnum(AppointmentResource).optional(),
    roomNumber: z.coerce.number().int().min(1).max(4).nullable().optional(),
    status: z.nativeEnum(LeadStatus).optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const appointmentQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});
