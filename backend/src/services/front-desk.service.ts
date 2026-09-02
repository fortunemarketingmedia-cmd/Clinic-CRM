import type { Role } from '@prisma/client';
import type { z } from 'zod';
import { frontDeskRepository } from '../repositories/front-desk.repository.js';
import type { availabilityQuerySchema } from '../validations/front-desk.validation.js';
import { accessService } from './access.service.js';
import { addMinutes, intervalsOverlap } from './appointment-policy.js';

type Availability = z.infer<typeof availabilityQuerySchema>;

function clinicClock(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value.weekday);
  return { weekday, minutes: Number(value.hour) * 60 + Number(value.minute) };
}

export const frontDeskService = {
  listServices: frontDeskRepository.listServices,
  listResources: frontDeskRepository.listResources,
  listStaff: frontDeskRepository.listStaff,
  listSchedules: frontDeskRepository.listSchedules,
  createService: frontDeskRepository.createService,
  createResource: frontDeskRepository.createResource,
  createSchedule: frontDeskRepository.createSchedule,
  createException: frontDeskRepository.createException,

  async availability(input: Availability) {
    const end = addMinutes(input.startsAt, input.durationMinutes + input.bufferMinutes);
    const [appointments, exceptions, schedules] = await Promise.all([
      frontDeskRepository.findPotentialConflicts({ branchId: input.branchId, start: input.startsAt, end, excludeId: input.excludeAppointmentId }),
      frontDeskRepository.findExceptions({ branchId: input.branchId, userIds: [input.doctorId, input.therapistId].filter(Boolean) as string[], resourceIds: [input.resourceId, input.equipmentId].filter(Boolean) as string[], start: input.startsAt, end }),
      Promise.all([input.doctorId, input.therapistId].filter(Boolean).map((userId) => frontDeskRepository.listSchedules(input.branchId, userId))),
    ]);
    const requestedIds = new Set([input.doctorId, input.therapistId, input.resourceId, input.equipmentId].filter(Boolean));
    const conflicts = appointments.filter((appointment) => {
      const existingStart = appointment.checkInAt ?? appointment.appointmentAt;
      const existingEnd = addMinutes(appointment.endAt ?? addMinutes(appointment.appointmentAt, appointment.durationMinutes), appointment.bufferMinutes);
      const shared = [appointment.doctorId, appointment.therapistId, appointment.resourceId, appointment.equipmentId].some((id) => id && requestedIds.has(id));
      const legacyRoom = Boolean(input.roomNumber && appointment.roomNumber === input.roomNumber);
      const consultancyOverlap = input.resourceType === 'CONSULTATION' && appointment.resourceType === 'CONSULTATION';
      return (consultancyOverlap || shared || legacyRoom) && intervalsOverlap({ start: input.startsAt, end }, { start: existingStart, end: existingEnd });
    });
    const clock = clinicClock(input.startsAt);
    const outsideSchedule = schedules.some((userSchedules) => userSchedules.length > 0 && !userSchedules.some((schedule) => schedule.weekday === clock.weekday && clock.minutes >= schedule.startMinutes && clock.minutes + input.durationMinutes <= schedule.endMinutes));
    return { available: conflicts.length === 0 && exceptions.length === 0 && !outsideSchedule, startsAt: input.startsAt, endsAt: end, conflicts, exceptions, outsideSchedule };
  },

  async todayQueue(branchId: string, userId: string, role: Role, dateFrom?: Date, dateTo?: Date) {
    await accessService.assertBranchAccess(userId, role, branchId);
    const now = new Date();
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const start = dateFrom ?? new Date(`${localDate}T00:00:00+05:30`);
    const end = dateTo ?? new Date(`${localDate}T23:59:59.999+05:30`);
    const records = await frontDeskRepository.todayQueue(branchId, start, end);
    const stage = (status: string) => ['REQUESTED', 'SLOT_PROPOSED', 'SCHEDULED', 'CONFIRMATION_PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(status) ? 'EXPECTED' : status === 'CHECKED_IN' ? 'ARRIVED' : status === 'WAITING' ? 'WAITING' : status === 'IN_CONSULTATION' ? 'WITH_DOCTOR' : status === 'TREATMENT_IN_PROGRESS' ? 'TREATMENT' : status === 'BILLING_PENDING' ? 'BILLING' : 'COMPLETED';
    return records.map((record) => ({ ...record, queueStage: stage(record.status) }));
  },

  async scheduleAppointments(filters: Parameters<typeof frontDeskRepository.scheduleAppointments>[0]) {
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    await frontDeskRepository.expireUnattendedTreatmentRoomBookings(new Date(`${localDate}T00:00:00+05:30`));
    return frontDeskRepository.scheduleAppointments(filters);
  },
};
