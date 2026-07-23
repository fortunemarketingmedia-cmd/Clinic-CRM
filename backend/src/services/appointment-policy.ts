import type { AppointmentStatus } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['SLOT_PROPOSED', 'SCHEDULED', 'CANCELLED'],
  SLOT_PROPOSED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['CONFIRMATION_PENDING', 'CONFIRMED', 'CHECKED_IN', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMATION_PENDING: ['CONFIRMED', 'CHECKED_IN', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['WAITING', 'IN_CONSULTATION', 'CANCELLED'],
  WAITING: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['TREATMENT_IN_PROGRESS', 'BILLING_PENDING', 'COMPLETED'],
  TREATMENT_IN_PROGRESS: ['BILLING_PENDING', 'COMPLETED'],
  BILLING_PENDING: ['COMPLETED'],
  COMPLETED: [], RESCHEDULED: ['SCHEDULED', 'CONFIRMED', 'CANCELLED'], CANCELLED: [], NO_SHOW: ['RESCHEDULED'],
};

export function validateAppointmentTransition(current: AppointmentStatus, next: AppointmentStatus, input: { cancellationReason?: string; noShowReason?: string; rescheduleReason?: string }) {
  if (current === next) return;
  if (!transitions[current].includes(next)) throw new HttpError(409, `Appointment cannot move from ${current} to ${next}`);
  if (next === 'CANCELLED' && !input.cancellationReason) throw new HttpError(400, 'Cancellation reason is required');
  if (next === 'NO_SHOW' && !input.noShowReason) throw new HttpError(400, 'No-show reason is required');
  if (next === 'RESCHEDULED' && !input.rescheduleReason) throw new HttpError(400, 'Reschedule reason is required');
}

export function intervalsOverlap(first: { start: Date; end: Date }, second: { start: Date; end: Date }) {
  return first.start < second.end && second.start < first.end;
}

export function addMinutes(value: Date, minutes: number) { return new Date(value.getTime() + minutes * 60_000); }

