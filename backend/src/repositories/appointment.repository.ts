import type { AppointmentResource, AppointmentStatus, AppointmentType, EnquirySource, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { HttpError } from '../utils/http-error.js';
import { prisma, type DbTransaction } from '../config/db.js';
import { normalizeSearchTerm, textSearchVariants } from '../utils/search.js';

type AppointmentFilters = {
  branchId?: string;
  status?: AppointmentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
};

type Slot = { branchId: string; appointmentAt: Date; endAt?: Date | null; durationMinutes?: number; bufferMinutes?: number; doctorId?: string | null; therapistId?: string | null; resourceId?: string | null; equipmentId?: string | null; roomNumber?: number | null; status?: AppointmentStatus };
async function guardSlot(tx: DbTransaction, slot: Slot, excludeId?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`appointment:${slot.branchId}`}))`;
  if (slot.status && ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(slot.status)) return;
  const ids = [slot.doctorId, slot.therapistId, slot.resourceId, slot.equipmentId].filter(Boolean) as string[];
  if (!ids.length && !slot.roomNumber) return;
  const endsAt = new Date((slot.endAt ?? new Date(slot.appointmentAt.getTime() + (slot.durationMinutes ?? 30) * 60_000)).getTime() + (slot.bufferMinutes ?? 0) * 60_000);
  const rows = await tx.appointment.findMany({ where: { branchId: slot.branchId, id: excludeId ? { not: excludeId } : undefined, status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] }, appointmentAt: { lt: endsAt }, OR: [{ doctorId: { in: ids } }, { therapistId: { in: ids } }, { resourceId: { in: ids } }, { equipmentId: { in: ids } }, ...(slot.roomNumber ? [{ roomNumber: slot.roomNumber }] : [])] }, select: { appointmentAt: true, endAt: true, durationMinutes: true, bufferMinutes: true } });
  if (rows.some((row) => (row.endAt?.getTime() ?? row.appointmentAt.getTime() + row.durationMinutes * 60_000) + row.bufferMinutes * 60_000 > slot.appointmentAt.getTime())) throw new HttpError(409, 'The selected staff member or resource is not available for this interval');
}

export const appointmentRepository = {
  async list(filters: AppointmentFilters) {
    const search = normalizeSearchTerm(filters.search);
    const textVariants = textSearchVariants(search);
    const where: Prisma.AppointmentWhereInput = {
        branchId: filters.branchId,
        status: filters.status,
        appointmentAt:
          filters.dateFrom || filters.dateTo
            ? {
                gte: filters.dateFrom,
                lte: filters.dateTo,
              }
            : undefined,
        lead: search
          ? {
              OR: [
                ...textVariants.map((filter) => ({ name: filter })),
                { mobile: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
      };
    const [items, total] = await prisma.$transaction([
      prisma.appointment.findMany({ where, include: {
        branch: true,
        lead: { include: { patient: true } },
        service: true,
        doctor: { select: { id: true, name: true } },
        therapist: { select: { id: true, name: true } },
        resource: true,
        equipment: true,
      },
      orderBy: { appointmentAt: 'asc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      }),
      prisma.appointment.count({ where }),
    ]);
    return { items, total, page: filters.page, pageSize: filters.pageSize };
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

  createQrToken() {
    return crypto.randomBytes(24).toString('hex');
  },

  createForQrSubmission(patientId: string, submittedAt: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qr-appointment:${patientId}`}))`;
      const patient = await tx.patient.findUnique({ where: { id: patientId }, include: { lead: true } });
      if (!patient) throw new HttpError(404, 'Patient not found');

      let lead = patient.lead;
      if (!lead) {
        const branchUser = await tx.user.findFirst({
          where: { status: 'ACTIVE', branchAccess: { some: { branchId: patient.branchId } } },
          orderBy: { createdAt: 'asc' },
        });
        const creator = branchUser ?? await tx.user.findFirst({ where: { status: 'ACTIVE', role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
        if (!creator) throw new HttpError(503, 'Clinic staff setup is required before QR appointments can be booked');
        lead = await tx.lead.create({
          data: {
            qrToken: crypto.randomBytes(24).toString('hex'),
            name: patient.fullName,
            mobile: patient.mobile,
            email: patient.email,
            address: patient.address,
            source: 'WALK_IN',
            status: 'CONVERTED',
            branchId: patient.branchId,
            createdById: creator.id,
            ownerId: creator.id,
            personId: patient.personId,
            appointmentAt: submittedAt,
            appointmentType: 'CLINIC_VISIT',
            nextAction: 'Attend consultation',
            nextActionDueAt: submittedAt,
            convertedAt: submittedAt,
          },
        });
        await tx.patient.update({ where: { id: patient.id }, data: { leadId: lead.id } });
      }

      const clinicDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(submittedAt);
      const dayStart = new Date(`${clinicDate}T00:00:00+05:30`);
      const dayEnd = new Date(`${clinicDate}T23:59:59.999+05:30`);
      const existing = await tx.appointment.findFirst({
        where: {
          leadId: lead.id,
          resourceType: 'CONSULTATION',
          appointmentAt: { gte: dayStart, lte: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          deletedAt: null,
        },
        orderBy: { appointmentAt: 'asc' },
      });
      if (existing) return { appointment: existing, created: false };

      const appointment = await tx.appointment.create({
        data: {
          leadId: lead.id,
          branchId: patient.branchId,
          appointmentAt: submittedAt,
          endAt: new Date(submittedAt.getTime() + 30 * 60_000),
          durationMinutes: 30,
          bufferMinutes: 10,
          appointmentType: 'CLINIC_VISIT',
          resourceType: 'CONSULTATION',
          status: 'SCHEDULED',
          notes: 'Automatically booked from QR registration submission',
          bookingSource: 'QR_REGISTRATION',
          bookingChannel: 'PUBLIC_QR',
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { appointmentAt: submittedAt, appointmentType: 'CLINIC_VISIT', nextAction: 'Attend consultation', nextActionDueAt: submittedAt },
      });
      return { appointment, created: true };
    });
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
      await guardSlot(tx, data);
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
      await guardSlot(tx, data);
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
      const existing = await tx.appointment.findUniqueOrThrow({ where: { id } });
      await guardSlot(tx, { ...existing, ...data }, id);
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

};
