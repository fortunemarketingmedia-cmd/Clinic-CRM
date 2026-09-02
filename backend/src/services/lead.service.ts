import type { LeadPriority, LeadStatus, Role } from '@prisma/client';
import type { EnquirySource } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import { branchRepository } from '../repositories/branch.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';
import { personService } from './person.service.js';
import { auditService, type AuditContext } from './audit.service.js';
import { validateLeadTransition } from './lead-stage-policy.js';
import { leadScoringService } from './lead-scoring.service.js';
import { accessService } from './access.service.js';
import { automationService } from './automation.service.js';
import { integrationService } from './integration.service.js';
import { followUpRepository } from '../repositories/follow-up.repository.js';
import { userRepository } from '../repositories/user.repository.js';

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

async function createLeadFollowUp(
  lead: {
    id: string;
    personId: string | null;
    branchId: string;
    ownerId: string | null;
    patient?: { id: string } | null;
    priority: LeadPriority;
  },
  dueAt: Date,
  createdById: string,
  notes?: string,
) {
  if (!lead.personId) return;
  const reminderAt = new Date(Math.max(Date.now(), dueAt.getTime() - 15 * 60_000));
  await followUpRepository.create({
    personId: lead.personId,
    leadId: lead.id,
    patientId: lead.patient?.id,
    assignedUserId: lead.ownerId ?? createdById,
    branchId: lead.branchId,
    activityType: 'Lead follow-up',
    channel: 'CALL',
    direction: 'OUTBOUND',
    dueAt,
    reminderAt,
    notes,
    priority: lead.priority,
    source: 'LEAD_NEXT_FOLLOW_UP',
    createdById,
  });
}

export const leadService = {
  async createWebsiteLead(input: {
    name: string;
    mobile: string;
    email?: string;
    branchId?: string;
    interestedTreatment?: string;
    message?: string;
    formName?: string;
    pageUrl?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }) {
    const branchId = input.branchId ?? (await branchRepository.first())?.id;
    if (!branchId) throw new HttpError(409, 'No clinic branch is configured for website leads');

    const owner = await userRepository.firstActiveAdmin();
    if (!owner) throw new HttpError(409, 'No active Dr. Revive account is available for website leads');

    const tracking = [
      input.formName ? `Form: ${input.formName}` : undefined,
      input.pageUrl ? `Page: ${input.pageUrl}` : undefined,
      input.utmSource ? `UTM source: ${input.utmSource}` : undefined,
      input.utmMedium ? `UTM medium: ${input.utmMedium}` : undefined,
      input.utmCampaign ? `UTM campaign: ${input.utmCampaign}` : undefined,
      input.message ? `Message: ${input.message}` : undefined,
    ].filter(Boolean).join('\n');

    return this.createLead({
      name: input.name,
      mobile: input.mobile,
      email: input.email,
      source: 'WEBSITE',
      branchId,
      interestedTreatment: input.interestedTreatment,
      followupNotes: tracking || undefined,
      createdById: owner.id,
      ownerId: owner.id,
      appointmentType: 'CLINIC_VISIT',
      nextAction: 'Contact website enquiry',
      nextActionDueAt: new Date(),
    });
  },

  async listLeads(filters: {
    branchId?: string;
    status?: LeadStatus;
    source?: EnquirySource;
    search?: string;
    createdFrom?: Date;
    createdTo?: Date;
    includeClosed?: boolean;
    role: Role;
    userId: string;
  }) {
    requireBranchForReceptionist(filters.role, filters.branchId);
    await ensureBranchExists(filters.branchId);
    await accessService.assertBranchAccess(filters.userId, filters.role, filters.branchId);
    return leadRepository.list(filters);
  },

  async getLead(id: string, access?: { id: string; role: Role }) {
    const lead = await leadRepository.findById(id);

    if (!lead) {
      throw new HttpError(404, 'Lead not found');
    }
    if (access) await accessService.assertBranchAccess(access.id, access.role, lead.branchId);

    return lead;
  },

  async getLeadTimeline(id: string) {
    await this.getLead(id);
    return timelineRepository.listForLead(id);
  },

  async findDuplicates(input: { mobile?: string; email?: string; branchId?: string }) {
    return leadRepository.findDuplicates(input);
  },

  async createLead(
    input: {
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
      ownerId?: string;
      nextAction?: string;
      nextActionDueAt?: Date;
      role?: Role;
    },
    audit?: AuditContext,
  ) {
    await ensureBranchExists(input.branchId);
    if (input.role)
      await accessService.assertBranchAccess(input.createdById, input.role, input.branchId);
    const leadInput = { ...input };
    delete leadInput.role;
    const person = await personService.findOrCreate({
      fullName: input.name,
      primaryMobile: input.mobile,
      email: input.email,
      address: input.address,
      preferredBranchId: input.branchId,
    });
    const lead = await leadRepository.create({
      ...leadInput,
      qrToken: leadRepository.createQrToken(),
      personId: person.id,
      ownerId: input.ownerId ?? input.createdById,
      nextAction: input.nextAction ?? 'Initial contact',
      nextActionDueAt: input.nextActionDueAt ?? input.nextFollowupAt ?? new Date(),
    });
    await timelineRepository.create({
      leadId: lead.id,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      description: `${lead.source.replace('_', ' ')} enquiry added`,
      createdById: input.createdById,
      personId: person.id,
    });
    if (audit)
      await auditService.record(
        { ...audit, branchId: input.branchId },
        { action: 'LEAD_CREATED', entity: 'Lead', entityId: lead.id },
      );
    await leadScoringService.recalculate(lead.id);
    if (input.nextFollowupAt) {
      await createLeadFollowUp(lead, input.nextFollowupAt, input.createdById, input.followupNotes);
    }
    await automationService.trigger('LEAD_CREATED', {
      branchId: lead.branchId,
      leadId: lead.id,
      referenceType: 'Lead',
      referenceId: lead.id,
      payload: { lead },
      actorId: input.createdById,
    });
    await integrationService.trackFunnelEvent('LEAD_CREATED', lead.id, lead.id);
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
      ownerId: string;
      nextAction: string;
      nextActionDueAt: Date;
      qualificationStatus: string;
      qualificationNotes: string;
      leadScore: number;
      lostReason: string;
      lostNotes: string;
      disqualificationReason: string;
    }>,
    audit?: AuditContext,
  ) {
    const lead = await this.getLead(id);
    await ensureBranchExists(input.branchId);

    validateLeadTransition(
      {
        status: lead.status,
        ownerId: lead.ownerId,
        nextAction: lead.nextAction,
        nextActionDueAt: lead.nextActionDueAt,
        appointmentCount: lead.appointments.length,
      },
      input,
    );

    const updated = await leadRepository.update(id, input);

    if (input.status && ['CONVERTED', 'LOST', 'DISQUALIFIED'].includes(input.status)) {
      await followUpRepository.closeOpenLeadFollowUps(id, `Lead closed as ${input.status.replaceAll('_', ' ').toLowerCase()}`);
    }

    if (input.status && input.status !== lead.status) {
      await timelineRepository.create({
        personId: updated.personId ?? undefined,
        leadId: id,
        patientId: updated.patient?.id,
        type: 'LEAD_STATUS_CHANGED',
        title: `Lead marked ${input.status.replace('_', ' ').toLowerCase()}`,
        description: `Previous status: ${lead.status.replace('_', ' ').toLowerCase()}`,
      });
    }

    if (audit)
      await auditService.record(
        { ...audit, branchId: updated.branchId },
        {
          action:
            input.status && input.status !== lead.status ? 'LEAD_STAGE_CHANGED' : 'LEAD_UPDATED',
          entity: 'Lead',
          entityId: id,
          previousValue: { status: lead.status },
          newValue: { status: updated.status },
        },
      );
    await leadScoringService.recalculate(id);

    if (input.ownerId && input.ownerId !== lead.ownerId)
      await automationService.trigger('LEAD_ASSIGNED', {
        branchId: updated.branchId,
        leadId: id,
        referenceType: 'Lead',
        referenceId: id,
        payload: { lead: updated, previousOwnerId: lead.ownerId },
        actorId: audit?.userId,
      });
    if (input.status && input.status !== lead.status)
      await automationService.trigger('LEAD_STAGE_CHANGED', {
        branchId: updated.branchId,
        leadId: id,
        referenceType: 'Lead',
        referenceId: id,
        payload: { lead: updated, previousStatus: lead.status, status: updated.status },
        actorId: audit?.userId,
      });
    if (input.lastContactedAt)
      await integrationService.trackFunnelEvent(
        'LEAD_CONTACTED',
        id,
        `${id}:${input.lastContactedAt.toISOString()}`,
      );
    if (input.status === 'QUALIFIED')
      await integrationService.trackFunnelEvent('QUALIFIED_LEAD', id, id);
    if (input.status === 'CONVERTED')
      await integrationService.trackFunnelEvent('LEAD_CONVERTED', id, id);

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
      if (audit?.userId) {
        await createLeadFollowUp(updated, input.nextFollowupAt, audit.userId, input.followupNotes);
      }
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

  async deleteLead(id: string, audit?: AuditContext) {
    const lead = await this.getLead(id);
    await leadRepository.delete(id);
    if (audit)
      await auditService.record(
        { ...audit, branchId: lead.branchId },
        { action: 'LEAD_DELETED', entity: 'Lead', entityId: id },
      );
  },
};
