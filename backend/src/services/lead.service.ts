import type { LeadPriority, LeadStatus, Role } from '@prisma/client';
import type { EnquirySource } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
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

export const leadService = {
  async listLeads(filters: {
    branchId?: string;
    status?: LeadStatus;
    source?: EnquirySource;
    search?: string;
    role: Role;
  }) {
    requireBranchForReceptionist(filters.role, filters.branchId);
    await ensureBranchExists(filters.branchId);
    return leadRepository.list(filters);
  },

  async getLead(id: string) {
    const lead = await leadRepository.findById(id);

    if (!lead) {
      throw new HttpError(404, 'Lead not found');
    }

    return lead;
  },

  async getLeadTimeline(id: string) {
    await this.getLead(id);
    return timelineRepository.listForLead(id);
  },

  async findDuplicates(input: { mobile?: string; email?: string }) {
    return leadRepository.findDuplicates(input);
  },

  async createLead(input: {
    name: string;
    mobile: string;
    email?: string;
    address?: string;
    source: EnquirySource;
    priority?: LeadPriority;
    nextFollowupAt?: Date;
    lastContactedAt?: Date;
    followupNotes?: string;
    interestedTreatment?: string;
    branchId: string;
    createdById: string;
    appointmentType: 'CLINIC_VISIT' | 'VIDEO_CONSULTATION';
    appointmentAt?: Date;
  }) {
    await ensureBranchExists(input.branchId);
    const duplicates = await leadRepository.findDuplicates({ mobile: input.mobile, email: input.email });

    if (duplicates.leads.length || duplicates.patients.length) {
      throw new HttpError(409, 'Existing record found with the same mobile or email');
    }

    const lead = await leadRepository.create({ ...input, qrToken: leadRepository.createQrToken() });
    await timelineRepository.create({
      leadId: lead.id,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      description: `${lead.source.replace('_', ' ')} enquiry added`,
      createdById: input.createdById,
    });
    return lead;
  },

  async updateLead(
    id: string,
    input: Partial<{
      name: string;
      mobile: string;
      email: string;
      address: string;
      source: EnquirySource;
      priority: LeadPriority;
      nextFollowupAt: Date;
      lastContactedAt: Date;
      followupNotes: string;
      interestedTreatment: string;
      branchId: string;
      appointmentType: 'CLINIC_VISIT' | 'VIDEO_CONSULTATION';
      appointmentAt: Date;
      status: LeadStatus;
    }>,
  ) {
    const lead = await this.getLead(id);
    await ensureBranchExists(input.branchId);

    if (input.status === 'CONFIRMED' && !input.appointmentAt && !lead.appointmentAt) {
      throw new HttpError(400, 'Appointment date and time are required before confirming a lead');
    }

    const updated = await leadRepository.update(id, input);

    if (input.status && input.status !== lead.status) {
      await timelineRepository.create({
        leadId: id,
        patientId: updated.patient?.id,
        type: 'LEAD_STATUS_CHANGED',
        title: `Lead marked ${input.status.replace('_', ' ').toLowerCase()}`,
        description: `Previous status: ${lead.status.replace('_', ' ').toLowerCase()}`,
      });
    }

    if (input.lastContactedAt) {
      await timelineRepository.create({
        leadId: id,
        patientId: updated.patient?.id,
        type: 'CONTACT_LOGGED',
        title: 'Receptionist called',
        description: input.followupNotes ?? 'Lead contact was updated',
      });
    }

    if (input.nextFollowupAt) {
      await timelineRepository.create({
        leadId: id,
        patientId: updated.patient?.id,
        type: 'FOLLOW_UP_SCHEDULED',
        title: 'Follow-up scheduled',
        description: input.followupNotes,
      });
    }

    return updated;
  },

  async deleteLead(id: string) {
    await this.getLead(id);
    await leadRepository.delete(id);
  },
};
