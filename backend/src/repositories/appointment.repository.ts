import type { AppointmentResource, AppointmentStatus, AppointmentType, EnquirySource } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';

type AppointmentFilters = {
  branchId?: string;
  status?: AppointmentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

export const appointmentRepository = {
  async markPastConfirmedAsNotArrived() {
    const pastAppointments = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        OR: [{ endAt: { lt: new Date() } }, { endAt: null, appointmentAt: { lt: new Date() } }],
      },
      select: { id: true },
    });

    if (!pastAppointments.length) return;

    const appointmentIds = pastAppointments.map((appointment) => appointment.id);

    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { id: { in: appointmentIds }, status: 'CONFIRMED' },
        data: { status: 'NO_SHOW', noShowReason: 'Automatically marked after confirmed appointment time passed' },
      }),
    ]);
  },

  async list(filters: AppointmentFilters) {
    await this.markPastConfirmedAsNotArrived();

    return prisma.appointment.findMany({
      where: {
        branchId: filters.branchId,
        status: filters.status,
        appointmentAt:
          filters.dateFrom || filters.dateTo
            ? {
                gte: filters.dateFrom,
                lte: filters.dateTo,
              }
            : undefined,
        lead: filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { mobile: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: {
        branch: true,
        lead: { include: { patient: true } },
        service: true,
        doctor: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        resource: true,
        equipment: true,
      },
      orderBy: { appointmentAt: 'asc' },
    });
  },

  findById(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        branch: true,
        lead: { include: { patient: true } },
        service: true,
        doctor: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        resource: true,
        equipment: true,
      },
    });
  },

  findSlotConflict(branchId: string, appointmentAt: Date, resourceType: AppointmentResource, roomNumber?: number | null, excludeId?: string) {
    return prisma.appointment.findFirst({
      where: {
        branchId,
        appointmentAt,
        resourceType,
        roomNumber: resourceType === 'TREATMENT_ROOM' ? roomNumber : null,
        id: excludeId ? { not: excludeId } : undefined,
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
      },
      include: {
        branch: true,
        lead: true,
      },
    });
  },

  createQrToken() {
    return crypto.randomBytes(24).toString('hex');
  },

  createForIntake(data: {
    name: string;
    mobile: string;
    address?: string;
    source: EnquirySource;
    branchId: string;
    createdById: string;
    appointmentAt: Date;
    appointmentType: AppointmentType;
    resourceType: AppointmentResource;
    roomNumber?: number | null;
    notes?: string;
    personId: string;
    serviceId?: string;
    durationMinutes: number;
    bufferMinutes: number;
    endAt: Date;
    doctorId?: string;
    therapistId?: string;
    counsellorId?: string;
    resourceId?: string;
    equipmentId?: string;
    bookingSource?: string;
    bookingChannel?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          qrToken: this.createQrToken(),
          name: data.name,
          mobile: data.mobile,
          address: data.address,
          source: data.source,
          branchId: data.branchId,
          createdById: data.createdById,
          personId: data.personId,
          appointmentAt: data.appointmentAt,
          appointmentType: data.appointmentType,
          status: 'APPOINTMENT_BOOKED',
          ownerId: data.createdById,
          nextAction: 'Confirm appointment',
          nextActionDueAt: data.appointmentAt,
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          leadId: lead.id,
          branchId: data.branchId,
          appointmentAt: data.appointmentAt,
          appointmentType: data.appointmentType,
          resourceType: data.resourceType,
          roomNumber: data.resourceType === 'TREATMENT_ROOM' ? data.roomNumber : null,
          notes: data.notes,
          status: 'SCHEDULED',
          serviceId: data.serviceId,
          durationMinutes: data.durationMinutes,
          bufferMinutes: data.bufferMinutes,
          endAt: data.endAt,
          doctorId: data.doctorId,
          therapistId: data.therapistId,
          counsellorId: data.counsellorId,
          resourceId: data.resourceId,
          equipmentId: data.equipmentId,
          bookingSource: data.bookingSource,
          bookingChannel: data.bookingChannel,
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          branch: true,
          lead: { include: { patient: true } },
          service: true,
          doctor: { select: { id: true, name: true } },
          therapist: { select: { id: true, name: true } },
          resource: true,
          equipment: true,
        },
      });
    });
  },

  create(data: {
    leadId: string;
    branchId: string;
    appointmentAt: Date;
    appointmentType: AppointmentType;
    resourceType: AppointmentResource;
    roomNumber?: number | null;
    notes?: string;
    serviceId?: string;
    durationMinutes: number;
    bufferMinutes: number;
    endAt: Date;
    doctorId?: string;
    therapistId?: string;
    counsellorId?: string;
    resourceId?: string;
    equipmentId?: string;
    bookingSource?: string;
    bookingChannel?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          ...data,
          status: 'SCHEDULED',
        },
      });

      await tx.lead.update({
        where: { id: data.leadId },
        data: {
          branchId: data.branchId,
          appointmentAt: data.appointmentAt,
          appointmentType: data.appointmentType,
          status: 'APPOINTMENT_BOOKED',
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          branch: true,
          lead: { include: { patient: true } },
          service: true,
          doctor: { select: { id: true, name: true } },
          therapist: { select: { id: true, name: true } },
          resource: true,
          equipment: true,
        },
      });
    });
  },

  update(
    id: string,
    data: Partial<{
      branchId: string;
      appointmentAt: Date;
      appointmentType: AppointmentType;
      resourceType: AppointmentResource;
      roomNumber: number | null;
      status: AppointmentStatus;
      notes: string;
      serviceId: string | null;
      durationMinutes: number;
      bufferMinutes: number;
      endAt: Date;
      doctorId: string | null;
      therapistId: string | null;
      counsellorId: string | null;
      resourceId: string | null;
      equipmentId: string | null;
      cancellationReason: string;
      noShowReason: string;
      rescheduleReason: string;
      rescheduleCount: number;
      arrivalAt: Date;
      checkInAt: Date;
      waitingStartedAt: Date;
      consultationStartedAt: Date;
      consultationCompletedAt: Date;
      treatmentStartedAt: Date;
      treatmentCompletedAt: Date;
      checkoutAt: Date;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.update({
        where: { id },
        data,
      });

      await tx.lead.update({
        where: { id: appointment.leadId },
        data: {
          branchId: appointment.branchId,
          appointmentAt: appointment.appointmentAt,
          appointmentType: appointment.appointmentType,
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          branch: true,
          lead: { include: { patient: true } },
          service: true,
          doctor: { select: { id: true, name: true } },
          therapist: { select: { id: true, name: true } },
          resource: true,
          equipment: true,
        },
      });
    });
  },

  delete(id: string) {
    return prisma.appointment.delete({ where: { id } });
  },
};
