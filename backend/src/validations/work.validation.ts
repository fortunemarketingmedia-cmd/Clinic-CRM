import { ActivityChannel, ActivityDirection, WorkPriority, WorkStatus } from '@prisma/client';
import { z } from 'zod';

export const workQuerySchema = z.object({
  branchId: z.string().optional(),
  assignedUserId: z.string().optional(),
  status: z.nativeEnum(WorkStatus).optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
});

export const createFollowUpSchema = z.object({
  personId: z.string().min(1), leadId: z.string().optional(), patientId: z.string().optional(),
  assignedUserId: z.string().min(1), branchId: z.string().min(1), activityType: z.string().min(1),
  channel: z.nativeEnum(ActivityChannel), direction: z.nativeEnum(ActivityDirection).default(ActivityDirection.OUTBOUND),
  dueAt: z.coerce.date(), notes: z.string().optional(), reminderAt: z.coerce.date().optional(),
  priority: z.nativeEnum(WorkPriority).default(WorkPriority.MEDIUM), source: z.string().optional(),
  relatedAppointmentId: z.string().optional(),
});

export const completeFollowUpSchema = z.object({
  outcome: z.string().min(1), notes: z.string().optional(), nextAction: z.string().optional(),
  nextFollowUpAt: z.coerce.date().optional(), resolution: z.enum(['NEXT_ACTION', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST', 'DISQUALIFIED', 'CLOSED']),
}).superRefine((value, context) => {
  if (value.resolution === 'NEXT_ACTION' && (!value.nextAction || !value.nextFollowUpAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Next action and due date are required', path: ['nextAction'] });
  }
});

export const createTaskSchema = z.object({
  title: z.string().min(2), description: z.string().optional(), type: z.string().min(1),
  priority: z.nativeEnum(WorkPriority).default(WorkPriority.MEDIUM), assignedUserId: z.string().min(1),
  assignedTeam: z.string().optional(), branchId: z.string().min(1), personId: z.string().optional(),
  leadId: z.string().optional(), patientId: z.string().optional(), relatedAppointmentId: z.string().optional(),
  dueAt: z.coerce.date(), reminderAt: z.coerce.date().optional(), automaticallyCreated: z.boolean().default(false),
});

export const updateTaskSchema = z.object({
  title: z.string().min(2).optional(), description: z.string().optional(), priority: z.nativeEnum(WorkPriority).optional(),
  assignedUserId: z.string().optional(), dueAt: z.coerce.date().optional(), reminderAt: z.coerce.date().optional(),
  status: z.nativeEnum(WorkStatus).optional(), completionNotes: z.string().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');

