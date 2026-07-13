import type { AppointmentType, EnquirySource, LeadStatus, Role } from '@prisma/client';
import { LeadStatus as LeadStatusEnum, Role as RoleEnum } from '@prisma/client';
import { appointmentRepository } from '../repositories/appointment.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';

function requireBranchForReceptionist(role: Role, branchId?: string) {
  if (role === RoleEnum.RECEPTIONIST && !branchId) {
    throw new HttpError(400, 'Receptionist requests must include a branchId');
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

function ensureReceptionStatus(status?: LeadStatus) {
  if (!status) return;

  if (status === LeadStatusEnum.BOOKED || status === LeadStatusEnum.CONVERTED) {
    throw new HttpError(400, 'Use confirmed, arrived, postponed, not arrived, or cancelled for appointment flow');
  }
}

export const appointmentService = {
  async listAppointments(filters: {
    branchId?: string;
    status?: LeadStatus;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    role: Role;
  }) {
    requireBranchForReceptionist(filters.role, filters.branchId);
    await ensureBranchExists(filters.branchId);
    return appointmentRepository.list(filters);
  },

  async getAppointment(id: string) {
    const appointment = await appointmentRepository.findById(id);

    if (!appointment) {
      throw new HttpError(404, 'Appointment not found');
    }

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
    notes?: string;
  }) {
    await ensureBranchExists(input.branchId);
    const slotConflict = await appointmentRepository.findSlotConflict(input.branchId, input.appointmentAt);

    if (slotConflict) {
      throw new HttpError(409, 'This slot already has an appointment.');
    }

    if (!input.leadId) {
      if (!input.name || !input.mobile) {
        throw new HttpError(400, 'Name and mobile are required to book an appointment');
      }

      const appointment = await appointmentRepository.createForIntake({
        name: input.name,
        mobile: input.mobile,
        address: input.address,
        source: input.source,
        branchId: input.branchId,
        createdById: input.createdById,
        appointmentAt: input.appointmentAt,
        appointmentType: input.appointmentType,
        notes: input.notes,
      });
      await timelineRepository.create({
        leadId: appointment.leadId,
        patientId: appointment.lead?.patient?.id,
        type: 'APPOINTMENT_BOOKED',
        title: 'Appointment booked',
        description: appointment.appointmentAt.toISOString(),
        createdById: input.createdById,
      });
      return appointment;
    }

    await ensureLeadCanBeScheduled(input.leadId, input.branchId);
    const appointment = await appointmentRepository.create({
      leadId: input.leadId,
      branchId: input.branchId,
      appointmentAt: input.appointmentAt,
      appointmentType: input.appointmentType,
      notes: input.notes,
    });
    await timelineRepository.create({
      leadId: appointment.leadId,
      patientId: appointment.lead?.patient?.id,
      type: 'APPOINTMENT_BOOKED',
      title: 'Appointment booked',
      description: appointment.appointmentAt.toISOString(),
      createdById: input.createdById,
    });
    return appointment;
  },

  async updateAppointment(
    id: string,
    input: Partial<{
      branchId: string;
      appointmentAt: Date;
      appointmentType: AppointmentType;
      status: LeadStatus;
      notes: string;
    }>,
  ) {
    const appointment = await this.getAppointment(id);
    await ensureBranchExists(input.branchId);
    ensureReceptionStatus(input.status);

    if (input.branchId) {
      await ensureLeadCanBeScheduled(appointment.leadId, input.branchId);
    }

    if (input.appointmentAt || input.branchId) {
      const slotConflict = await appointmentRepository.findSlotConflict(
        input.branchId ?? appointment.branchId,
        input.appointmentAt ?? appointment.appointmentAt,
        id,
      );

      if (slotConflict) {
        throw new HttpError(409, 'This slot already has an appointment.');
      }
    }

    const updated = await appointmentRepository.update(id, input);

    if (input.status === LeadStatusEnum.ARRIVED) {
      await timelineRepository.create({
        leadId: updated.leadId,
        patientId: updated.lead?.patient?.id,
        type: 'PATIENT_ARRIVED',
        title: 'Patient arrived',
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

    return updated;
  },

  async cancelAppointment(id: string) {
    await this.getAppointment(id);
    return appointmentRepository.update(id, { status: LeadStatusEnum.CANCELLED });
  },

  async deleteAppointment(id: string) {
    await this.getAppointment(id);
    await appointmentRepository.delete(id);
  },
};
