import type { ClinicResourceType, ScheduleExceptionType } from '@prisma/client';
import { prisma } from '../config/db.js';

export const frontDeskRepository = {
  listServices(branchId?: string) {
    return prisma.clinicService.findMany({
      where: { active: true, OR: branchId ? [{ branchId }, { branchId: null }] : undefined },
      orderBy: { name: 'asc' },
    });
  },
  findService(id: string) {
    return prisma.clinicService.findUnique({ where: { id } });
  },
  createService(data: {
    branchId?: string;
    name: string;
    category?: string;
    durationMinutes: number;
    bufferMinutes: number;
    resourceType: 'CONSULTATION' | 'TREATMENT_ROOM';
    advancePaymentRequired: boolean;
    bookingNoticeMinutes: number;
    cancellationWindowMinutes: number;
    active: boolean;
  }) {
    return prisma.clinicService.create({ data });
  },
  listResources(branchId?: string, type?: ClinicResourceType) {
    return prisma.clinicResource.findMany({
      where: { branchId, type, active: true },
      include: { branch: true },
      orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
    });
  },
  createResource(data: {
    branchId: string;
    name: string;
    type: ClinicResourceType;
    serialNumber?: string;
    active: boolean;
  }) {
    return prisma.clinicResource.create({ data });
  },
  listStaff(branchId?: string) {
    return prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: { in: ['DOCTOR', 'THERAPIST', 'LEAD_COUNSELLOR'] },
        branchAccess: branchId ? { some: { branchId } } : undefined,
      },
      select: {
        id: true,
        name: true,
        role: true,
        branchAccess: { where: branchId ? { branchId } : undefined, include: { branch: true } },
        staffSchedules: {
          where: { active: true, branchId },
          include: { branch: true },
          orderBy: [{ branch: { name: 'asc' } }, { weekday: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
  },
  listSchedules(branchId?: string, userId?: string) {
    return prisma.staffSchedule.findMany({
      where: { branchId, userId, active: true },
      include: { user: { select: { id: true, name: true, role: true } }, branch: true },
      orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }],
    });
  },
  createSchedule(data: {
    userId: string;
    branchId: string;
    weekday: number;
    startMinutes: number;
    endMinutes: number;
    effectiveFrom?: Date;
    effectiveTo?: Date;
    active: boolean;
  }) {
    return prisma.staffSchedule.create({
      data,
      include: { user: { select: { id: true, name: true, role: true } }, branch: true },
    });
  },
  createException(data: {
    branchId: string;
    userId?: string;
    resourceId?: string;
    type: ScheduleExceptionType;
    startsAt: Date;
    endsAt: Date;
    reason?: string;
  }) {
    return prisma.scheduleException.create({ data });
  },
  findExceptions(input: {
    branchId: string;
    userIds: string[];
    resourceIds: string[];
    start: Date;
    end: Date;
  }) {
    return prisma.scheduleException.findMany({
      where: {
        branchId: input.branchId,
        startsAt: { lt: input.end },
        endsAt: { gt: input.start },
        OR: [
          { userId: { in: input.userIds } },
          { resourceId: { in: input.resourceIds } },
          { userId: null, resourceId: null },
        ],
      },
    });
  },
  findPotentialConflicts(input: { branchId: string; start: Date; end: Date; excludeId?: string }) {
    return prisma.appointment.findMany({
      where: {
        branchId: input.branchId,
        id: input.excludeId ? { not: input.excludeId } : undefined,
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
        appointmentAt: { gt: new Date(input.start.getTime() - 86_400_000), lt: input.end },
      },
      include: {
        lead: true,
        resource: true,
        equipment: true,
        doctor: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
      },
    });
  },
  todayQueue(branchId: string, start: Date, end: Date) {
    return prisma.appointment.findMany({
      where: {
        branchId,
        appointmentAt: { gte: start, lte: end },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      include: {
        lead: { include: { patient: true } },
        service: true,
        doctor: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        resource: true,
      },
      orderBy: { appointmentAt: 'asc' },
    });
  },
  scheduleAppointments(filters: {
    branchId?: string;
    dateFrom: Date;
    dateTo: Date;
    doctorId?: string;
    therapistId?: string;
    resourceId?: string;
  }) {
    return prisma.appointment.findMany({
      where: {
        branchId: filters.branchId,
        appointmentAt: { gte: filters.dateFrom, lte: filters.dateTo },
        doctorId: filters.doctorId,
        therapistId: filters.therapistId,
        OR: filters.resourceId
          ? [{ resourceId: filters.resourceId }, { equipmentId: filters.resourceId }]
          : undefined,
      },
      include: {
        branch: true,
        lead: true,
        service: true,
        doctor: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        resource: true,
        equipment: true,
      },
      orderBy: { appointmentAt: 'asc' },
    });
  },
};
