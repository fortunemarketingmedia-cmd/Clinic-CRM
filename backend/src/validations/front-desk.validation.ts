import { AppointmentResource, ClinicResourceType, ScheduleExceptionType } from '@prisma/client';
import { z } from 'zod';

export const branchQuerySchema = z.object({
  branchId: z.string().min(1),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export const catalogQuerySchema = z.object({
  branchId: z.string().optional(),
  type: z.nativeEnum(ClinicResourceType).optional(),
});
export const serviceSchema = z.object({
  branchId: z.string().optional(),
  name: z.string().min(2),
  category: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(120).default(0),
  resourceType: z.nativeEnum(AppointmentResource).default(AppointmentResource.CONSULTATION),
  advancePaymentRequired: z.boolean().default(false),
  bookingNoticeMinutes: z.coerce.number().int().min(0).default(0),
  cancellationWindowMinutes: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
export const resourceSchema = z.object({
  branchId: z.string().min(1),
  name: z.string().min(2),
  type: z.nativeEnum(ClinicResourceType),
  serialNumber: z.string().optional(),
  active: z.boolean().default(true),
});
export const scheduleQuerySchema = z.object({
  branchId: z.string().optional(),
  userId: z.string().optional(),
});
export const scheduleSchema = z
  .object({
    userId: z.string().min(1),
    branchId: z.string().min(1),
    weekday: z.coerce.number().int().min(0).max(6),
    startMinutes: z.coerce.number().int().min(0).max(1439),
    endMinutes: z.coerce.number().int().min(1).max(1440),
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().optional(),
    active: z.boolean().default(true),
  })
  .refine((value) => value.endMinutes > value.startMinutes, {
    message: 'End time must be after start time',
    path: ['endMinutes'],
  });
export const exceptionSchema = z
  .object({
    branchId: z.string().min(1),
    userId: z.string().optional(),
    resourceId: z.string().optional(),
    type: z.nativeEnum(ScheduleExceptionType),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: 'End time must be after start time',
    path: ['endsAt'],
  });
export const availabilityQuerySchema = z.object({
  branchId: z.string().min(1),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(120).default(0),
  doctorId: z.string().optional(),
  therapistId: z.string().optional(),
  resourceId: z.string().optional(),
  equipmentId: z.string().optional(),
  roomNumber: z.coerce.number().int().min(1).optional(),
  excludeAppointmentId: z.string().optional(),
});
export const scheduleAppointmentsQuerySchema = z.object({
  branchId: z.string().min(1).optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  doctorId: z.string().optional(),
  therapistId: z.string().optional(),
  resourceId: z.string().optional(),
});
