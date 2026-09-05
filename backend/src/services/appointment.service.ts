import type { AppointmentResource, AppointmentStatus, AppointmentType, EnquirySource, Role } from '@prisma/client';
import { AppointmentStatus as AppointmentStatusEnum, LeadStatus as LeadStatusEnum, Role as RoleEnum } from '@prisma/client';
import { appointmentRepository } from '../repositories/appointment.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { followUpRepository } from '../repositories/follow-up.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';
import { personService } from './person.service.js';
import { frontDeskRepository } from '../repositories/front-desk.repository.js';
import { frontDeskService } from './front-desk.service.js';
import { addMinutes, validateAppointmentTransition } from './appointment-policy.js';
import { auditService, type AuditContext } from './audit.service.js';
import { leadScoringService } from './lead-scoring.service.js';
import { accessService } from './access.service.js';
import { automationService } from './automation.service.js';
import { integrationService } from './integration.service.js';
import { whatsappAppointmentService } from './whatsapp-appointment.service.js';

const globalRoles: Role[] = [RoleEnum.ADMIN];

function requireBranchForReceptionist(role: Role, branchId?: string) {
  if (!globalRoles.includes(role) && !branchId) {
    throw new HttpError(400, 'Branch-scoped requests must include a branchId');
  }
}

async function ensureBranchExists(branchId?: string) {
  if (!branchId) {
    return;
  }

  const branch = await branchRepository.exists(branchId);

  if (!branch) {
    throw new HttpError(404, 'Branch not found');
  }
}

async function ensureLeadCanBeScheduled(leadId: string, branchId: string) {
  const lead = await leadRepository.findById(leadId);

  if (!lead) {
    throw new HttpError(404, 'Lead not found');
  }

  if (lead.status === LeadStatusEnum.CONVERTED) {
    throw new HttpError(409, 'Converted leads cannot be booked again from the lead appointment flow');
  }

  if (lead.branchId !== branchId) {
    await ensureBranchExists(branchId);
  }

  return lead;
}

async function sendAppointmentConfirmation(appointment: {
  id: string;
  lead: { mobile: string };
}) {
  try {
    await whatsappAppointmentService.sendAppointmentBookedConfirmation({
      appointmentId: appointment.id,
      mobile: appointment.lead.mobile,
    });
  } catch (error) {
    console.error('WhatsApp appointment confirmation failed', {
      appointmentId: appointment.id,
      error: error instanceof Error ? error.message : 'Unknown Meta API error',
    });
  }
}

function ensureReceptionStatus(status?: AppointmentStatus) {
  if (!status) return;

  if (!Object.values(AppointmentStatusEnum).includes(status)) throw new HttpError(400, 'Invalid appointment status');
}

export const appointmentService = {
  async listAppointments(filters: {
    branchId?: string;
    status?: AppointmentStatus;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    role: Role;
    userId: string;
    page: number;
    pageSize: number;
  }) {
    requireBranchForReceptionist(filters.role, filters.branchId);
    await ensureBranchExists(filters.branchId);
    await accessService.assertBranchAccess(filters.userId, filters.role, filters.branchId);
    return appointmentRepository.list(filters);
  },

  async getAppointment(id: string, access?: { id: string; role: Role }) {
    const appointment = await appointmentRepository.findById(id);

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found');
    }
    if (access) await accessService.assertBranchAccess(access.id, access.role, appointment.branchId);

    return appointment;
  },

  async createAppointment(input: {
    leadId?: string;
    name?: string;
    mobile?: string;
    address?: string;
    source: EnquirySource;
    branchId: string;
    createdById: string;
    appointmentAt: Date;
    appointmentType: AppointmentType;
    resourceType: AppointmentResource;
    roomNumber?: number | null;
    notes?: string;
    serviceId?: string;
    durationMinutes?: number;
    bufferMinutes?: number;
    doctorId?: string;
    therapistId?: string;
    counsellorId?: string;
    resourceId?: string;
    equipmentId?: string;
    bookingSource?: string;
    bookingChannel?: string;
  }, audit?: AuditContext) {
    await ensureBranchExists(input.branchId);
    if (audit?.userId) {
      const user = await import('../config/db.js').then(({ prisma }) => prisma.user.findUnique({ where: { id: audit.userId }, select: { role: true } }));
      if (user) await accessService.assertBranchAccess(audit.userId, user.role, input.branchId);
    }
    const service = input.serviceId ? await frontDeskRepository.findService(input.serviceId) : null;
    if (input.serviceId && !service) throw new HttpError(404, 'Service not found');
    const durationMinutes = input.durationMinutes ?? service?.durationMinutes ?? 30;
    const bufferMinutes = input.bufferMinutes ?? service?.bufferMinutes ?? 0;
    const endAt = addMinutes(input.appointmentAt, durationMinutes);
    const availability = await frontDeskService.availability({ branchId: input.branchId, resourceType: input.resourceType, startsAt: input.appointmentAt, durationMinutes, bufferMinutes, doctorId: input.doctorId, therapistId: input.therapistId, resourceId: input.resourceId, equipmentId: input.equipmentId, roomNumber: input.roomNumber ?? undefined });
    if (!availability.available) throw new HttpError(409, 'The selected staff member or resource is not available for this interval');

    if (!input.leadId) {
      if (!input.name || !input.mobile) {
        throw new HttpError(400, 'Name and mobile are required to book an appointment');
      }

      const person = await personService.findOrCreate({ fullName: input.name, primaryMobile: input.mobile, address: input.address, preferredBranchId: input.branchId });
      const appointment = await appointmentRepository.createForIntake({
        name: input.name,
        mobile: input.mobile,
        address: input.address,
        source: input.source,
        branchId: input.branchId,
        createdById: input.createdById,
        appointmentAt: input.appointmentAt,
        appointmentType: input.appointmentType,
        resourceType: input.resourceType,
        roomNumber: input.roomNumber,
        notes: input.notes,
        personId: person.id,
        serviceId: input.serviceId,
        durationMinutes,
        bufferMinutes,
        endAt,
        doctorId: input.doctorId,
        therapistId: input.therapistId,
        counsellorId: input.counsellorId,
        resourceId: input.resourceId,
        equipmentId: input.equipmentId,
        bookingSource: input.bookingSource,
        bookingChannel: input.bookingChannel,
      });
      await timelineRepository.create({
        leadId: appointment.leadId,
        patientId: appointment.lead?.patient?.id,
        type: 'APPOINTMENT_BOOKED',
        title: 'Appointment booked',
        description: appointment.appointmentAt.toISOString(),
        createdById: input.createdById,
      });
      await followUpRepository.closeOpenLeadFollowUps(appointment.leadId, 'Appointment booked');
      if (audit) await auditService.record({ ...audit, branchId: input.branchId }, { action: 'APPOINTMENT_CREATED', entity: 'Appointment', entityId: appointment.id });
      await leadScoringService.recalculate(appointment.leadId);
      await automationService.trigger('APPOINTMENT_BOOKED', { branchId: appointment.branchId, leadId: appointment.leadId, referenceType: 'Appointment', referenceId: appointment.id, payload: { appointment }, actorId: input.createdById });
      await sendAppointmentConfirmation(appointment);
      await integrationService.trackFunnelEvent('APPOINTMENT_BOOKED', appointment.leadId, appointment.id);
      return appointment;
    }

    await ensureLeadCanBeScheduled(input.leadId, input.branchId);
    const appointment = await appointmentRepository.create({
      leadId: input.leadId,
      branchId: input.branchId,
      appointmentAt: input.appointmentAt,
      appointmentType: input.appointmentType,
      resourceType: input.resourceType,
      roomNumber: input.roomNumber,
      notes: input.notes,
      serviceId: input.serviceId,
      durationMinutes,
      bufferMinutes,
      endAt,
      doctorId: input.doctorId,
      therapistId: input.therapistId,
      counsellorId: input.counsellorId,
      resourceId: input.resourceId,
      equipmentId: input.equipmentId,
      bookingSource: input.bookingSource,
      bookingChannel: input.bookingChannel,
    });
    await timelineRepository.create({
      leadId: appointment.leadId,
      patientId: appointment.lead?.patient?.id,
      type: 'APPOINTMENT_BOOKED',
      title: 'Appointment booked',
      description: appointment.appointmentAt.toISOString(),
      createdById: input.createdById,
    });
    await followUpRepository.closeOpenLeadFollowUps(appointment.leadId, 'Appointment booked');
    if (audit) await auditService.record({ ...audit, branchId: input.branchId }, { action: 'APPOINTMENT_CREATED', entity: 'Appointment', entityId: appointment.id });
    await leadScoringService.recalculate(appointment.leadId);
    await automationService.trigger('APPOINTMENT_BOOKED', { branchId: appointment.branchId, leadId: appointment.leadId, referenceType: 'Appointment', referenceId: appointment.id, payload: { appointment }, actorId: input.createdById });
    await sendAppointmentConfirmation(appointment);
    await integrationService.trackFunnelEvent('APPOINTMENT_BOOKED', appointment.leadId, appointment.id);
    return appointment;
  },

  async updateAppointment(
    id: string,
    input: Partial<{
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
      doctorId: string | null;
      therapistId: string | null;
      counsellorId: string | null;
      resourceId: string | null;
      equipmentId: string | null;
      cancellationReason: string;
      noShowReason: string;
      rescheduleReason: string;
    }>,
    audit?: AuditContext,
  ) {
    const appointment = await this.getAppointment(id);
    await ensureBranchExists(input.branchId);
    ensureReceptionStatus(input.status);
    const directRoomCheckout = appointment.resourceType === 'TREATMENT_ROOM' && appointment.status === AppointmentStatusEnum.CHECKED_IN && input.status === AppointmentStatusEnum.COMPLETED;
    if (input.status && !directRoomCheckout) validateAppointmentTransition(appointment.status, input.status, input);

    if (input.branchId) {
      await ensureLeadCanBeScheduled(appointment.leadId, input.branchId);
    }

    const service = input.serviceId === null ? null : input.serviceId ? await frontDeskRepository.findService(input.serviceId) : appointment.serviceId ? await frontDeskRepository.findService(appointment.serviceId) : null;
    const isRoomCheckIn = input.status === AppointmentStatusEnum.CHECKED_IN && appointment.resourceType === 'TREATMENT_ROOM';
    const now = new Date();
    if (isRoomCheckIn) {
      const clinicDate = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(value);
      if (clinicDate(appointment.appointmentAt) !== clinicDate(now)) throw new HttpError(409, 'Treatment-room check-in is allowed only on the scheduled day');
    }
    const startsAt = isRoomCheckIn ? now : input.appointmentAt ?? appointment.appointmentAt;
    const durationMinutes = input.durationMinutes ?? service?.durationMinutes ?? appointment.durationMinutes;
    const bufferMinutes = input.bufferMinutes ?? service?.bufferMinutes ?? appointment.bufferMinutes;
    const schedulingChanged = Boolean(isRoomCheckIn || input.appointmentAt || input.branchId || input.doctorId !== undefined || input.therapistId !== undefined || input.resourceId !== undefined || input.equipmentId !== undefined || input.roomNumber !== undefined || input.durationMinutes || input.bufferMinutes);
    if (schedulingChanged) {
      const availability = await frontDeskService.availability({ branchId: input.branchId ?? appointment.branchId, resourceType: input.resourceType ?? appointment.resourceType, startsAt, durationMinutes, bufferMinutes, doctorId: input.doctorId === null ? undefined : input.doctorId ?? appointment.doctorId ?? undefined, therapistId: input.therapistId === null ? undefined : input.therapistId ?? appointment.therapistId ?? undefined, resourceId: input.resourceId === null ? undefined : input.resourceId ?? appointment.resourceId ?? undefined, equipmentId: input.equipmentId === null ? undefined : input.equipmentId ?? appointment.equipmentId ?? undefined, roomNumber: input.roomNumber ?? appointment.roomNumber ?? undefined, excludeAppointmentId: id });
      if (!availability.available) throw new HttpError(409, 'The selected staff member or resource is not available for this interval');
    }
    const lifecycleData = input.status === 'CHECKED_IN' ? appointment.resourceType === 'TREATMENT_ROOM' ? { arrivalAt: now, checkInAt: now, treatmentStartedAt: now } : { arrivalAt: now } : input.status === 'WAITING' ? { checkInAt: now, waitingStartedAt: now } : input.status === 'IN_CONSULTATION' ? { consultationStartedAt: now } : input.status === 'TREATMENT_IN_PROGRESS' ? { consultationCompletedAt: now, treatmentStartedAt: now } : input.status === 'BILLING_PENDING' ? { treatmentCompletedAt: now } : input.status === 'COMPLETED' ? { checkoutAt: now, ...(appointment.resourceType === 'TREATMENT_ROOM' ? { treatmentCompletedAt: now } : {}) } : {};
    const updated = await appointmentRepository.update(id, { ...input, ...lifecycleData, endAt: addMinutes(startsAt, durationMinutes), durationMinutes, bufferMinutes, rescheduleCount: input.appointmentAt && input.appointmentAt.getTime() !== appointment.appointmentAt.getTime() ? appointment.rescheduleCount + 1 : appointment.rescheduleCount });

    if (input.status === AppointmentStatusEnum.CHECKED_IN) {
      await timelineRepository.create({
        leadId: updated.leadId,
        patientId: updated.lead?.patient?.id,
        type: 'PATIENT_ARRIVED',
        title: appointment.resourceType === 'TREATMENT_ROOM' ? 'Treatment room checked in' : 'Patient arrived',
      });
    } else if (input.status) {
      await timelineRepository.create({
        leadId: updated.leadId,
        patientId: updated.lead?.patient?.id,
        type: 'APPOINTMENT_STATUS_CHANGED',
        title: `Appointment marked ${input.status.replace('_', ' ').toLowerCase()}`,
      });
    } else if (input.appointmentAt) {
      await timelineRepository.create({
        leadId: updated.leadId,
        patientId: updated.lead?.patient?.id,
        type: 'APPOINTMENT_RESCHEDULED',
        title: 'Appointment rescheduled',
        description: updated.appointmentAt.toISOString(),
      });
    }

    if (audit) await auditService.record({ ...audit, branchId: updated.branchId }, { action: input.status ? 'APPOINTMENT_STATUS_CHANGED' : 'APPOINTMENT_UPDATED', entity: 'Appointment', entityId: id, previousValue: { status: appointment.status }, newValue: { status: updated.status } });

    const automationTrigger = input.status === AppointmentStatusEnum.CONFIRMED ? 'APPOINTMENT_CONFIRMED' : input.status === AppointmentStatusEnum.NO_SHOW ? 'APPOINTMENT_MISSED' : input.status === AppointmentStatusEnum.COMPLETED ? 'APPOINTMENT_COMPLETED' : input.status === AppointmentStatusEnum.CHECKED_IN ? 'PATIENT_ARRIVED' : undefined;
    if (automationTrigger) await automationService.trigger(automationTrigger, { branchId: updated.branchId, leadId: updated.leadId, referenceType: 'Appointment', referenceId: updated.id, payload: { appointment: updated, previousStatus: appointment.status }, actorId: audit?.userId });
    if (input.status === AppointmentStatusEnum.CHECKED_IN) await integrationService.trackFunnelEvent('PATIENT_ARRIVED', updated.leadId, updated.id);

    return updated;
  },

  async cancelAppointment(id: string, reason = 'Cancelled by clinic', audit?: AuditContext) {
    return this.updateAppointment(id, { status: AppointmentStatusEnum.CANCELLED, cancellationReason: reason }, audit);
  },

  async deleteAppointment(id: string) {
    await this.cancelAppointment(id, 'Removed from calendar');
  },
};
