import type { AppointmentResource, AppointmentType, EnquirySource, LeadStatus } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';

type AppointmentFilters = {
  branchId?: string;
  status?: LeadStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

export const appointmentRepository = {
  async markPastConfirmedAsNotArrived() {
    const pastAppointments = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        appointmentAt: { lt: new Date() },
      },
      select: { leadId: true },
    });

    if (!pastAppointments.length) return;

    const leadIds = pastAppointments.map((appointment) => appointment.leadId);

    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { leadId: { in: leadIds }, status: 'CONFIRMED', appointmentAt: { lt: new Date() } },
        data: { status: 'NOT_ARRIVED' },
      }),
      prisma.lead.updateMany({
        where: { id: { in: leadIds }, status: 'CONFIRMED' },
        data: { status: 'NOT_ARRIVED' },
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
        status: { notIn: ['CANCELLED', 'CONVERTED'] },
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
          appointmentAt: data.appointmentAt,
          appointmentType: data.appointmentType,
          status: 'CONFIRMED',
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
          status: 'CONFIRMED',
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          branch: true,
          lead: { include: { patient: true } },
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
  }) {
    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          ...data,
          status: 'CONFIRMED',
        },
      });

      await tx.lead.update({
        where: { id: data.leadId },
        data: {
          branchId: data.branchId,
          appointmentAt: data.appointmentAt,
          appointmentType: data.appointmentType,
          status: 'CONFIRMED',
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          branch: true,
          lead: { include: { patient: true } },
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
      status: LeadStatus;
      notes: string;
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
          status: appointment.status,
        },
      });

      return tx.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        include: {
          branch: true,
          lead: { include: { patient: true } },
        },
      });
    });
  },

  delete(id: string) {
    return prisma.appointment.delete({ where: { id } });
  },
};
