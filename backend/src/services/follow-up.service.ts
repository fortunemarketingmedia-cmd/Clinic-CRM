import type { LeadStatus, Role } from '@prisma/client';
import { followUpRepository } from '../repositories/follow-up.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';
import { accessService } from './access.service.js';
import { auditService, type AuditContext } from './audit.service.js';
import type { z } from 'zod';
import type {
  completeFollowUpSchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  workQuerySchema,
} from '../validations/work.validation.js';
import { defaultReminderAt } from './work-reminder.js';
import { personService } from './person.service.js';

type CreateInput = z.infer<typeof createFollowUpSchema>;
type CompleteInput = z.infer<typeof completeFollowUpSchema>;
type UpdateInput = z.infer<typeof updateFollowUpSchema>;
type Query = z.infer<typeof workQuerySchema>;
const leadStatusByResolution: Partial<Record<CompleteInput['resolution'], LeadStatus>> = {
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
  DISQUALIFIED: 'DISQUALIFIED',
};

export const followUpService = {
  async list(filters: Query & { userId: string; role: Role }) {
    await accessService.assertBranchAccess(filters.userId, filters.role, filters.branchId);
    return followUpRepository.list(filters);
  },
  async create(input: CreateInput & { createdById: string; role: Role }, audit: AuditContext) {
    await accessService.assertBranchAccess(input.createdById, input.role, input.branchId);
    const assignee = await followUpRepository.findAssignableUser(input.assignedUserId, input.branchId);
    if (!assignee) throw new HttpError(400, 'Select an active team member from this branch');
    const { role: _authorizationRole, ...followUpData } = input;
    void _authorizationRole;
    let personId = followUpData.personId;
    if (followUpData.patientId) {
      // Patient follow-up (e.g. next check-up call from the patient file): the person comes from the patient record.
      const patient = await followUpRepository.findPatient(followUpData.patientId);
      if (!patient) throw new HttpError(404, 'Patient not found');
      if (patient.branchId !== input.branchId) throw new HttpError(400, 'Follow-up branch must match the patient branch');
      personId ??= patient.personId ?? (await personService.findOrCreate({ fullName: patient.fullName, primaryMobile: patient.mobile, email: patient.email ?? undefined })).id;
    }
    if (!personId) throw new HttpError(400, 'Select the person or patient for this follow-up');
    const followUp = await followUpRepository.create({
      ...followUpData,
      personId,
      reminderAt: followUpData.reminderAt ?? defaultReminderAt(followUpData.dueAt),
    });
    if (input.leadId) {
      await followUpRepository.updateLeadNextAction(input.leadId, input.activityType, input.dueAt);
    }
    await timelineRepository.create({
      personId,
      leadId: input.leadId,
      patientId: input.patientId,
      type: 'FOLLOW_UP_SCHEDULED',
      title: 'Follow-up scheduled',
      description: input.dueAt.toISOString(),
      createdById: input.createdById,
    });
    await auditService.record(
      { ...audit, branchId: input.branchId },
      { action: 'FOLLOW_UP_CREATED', entity: 'FollowUp', entityId: followUp.id },
    );
    return followUp;
  },
  async update(id: string, input: UpdateInput, userId: string, role: Role, audit: AuditContext) {
    const existing = await followUpRepository.findById(id);
    if (!existing) throw new HttpError(404, 'Follow-up not found');
    await accessService.assertBranchAccess(userId, role, existing.branchId);
    if (input.assignedUserId && input.assignedUserId !== existing.assignedUserId) {
      const assignee = await followUpRepository.findAssignableUser(input.assignedUserId, existing.branchId);
      if (!assignee) throw new HttpError(400, 'Select an active team member from this branch');
    }
    const reminderAt = input.reminderAt ?? (input.dueAt ? defaultReminderAt(input.dueAt) : undefined);
    const followUp = await followUpRepository.update(id, { ...input, reminderAt });
    const stillOpen = ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(followUp.status);
    if (existing.leadId && stillOpen && (input.dueAt || input.activityType)) {
      await followUpRepository.updateLeadNextAction(existing.leadId, followUp.activityType, followUp.dueAt);
    }
    await auditService.record(
      { ...audit, branchId: existing.branchId },
      { action: 'FOLLOW_UP_UPDATED', entity: 'FollowUp', entityId: id, previousValue: JSON.parse(JSON.stringify(existing)), newValue: JSON.parse(JSON.stringify(input)) },
    );
    return followUp;
  },
  async complete(
    id: string,
    input: CompleteInput,
    userId: string,
    role: Role,
    audit: AuditContext,
  ) {
    const existing = await followUpRepository.findById(id);
    if (!existing) throw new HttpError(404, 'Follow-up not found');
    await accessService.assertBranchAccess(userId, role, existing.branchId);
    const { resolution, nextReminderAt, ...completion } = input;
    const followUp = await followUpRepository.complete(id, { ...completion, completedById: userId });
    if (followUp.lead) {
      const { prisma } = await import('../config/db.js');
      await prisma.lead.update({
        where: { id: followUp.lead.id },
        data: { lastContactedAt: new Date(), followupNotes: input.notes ?? input.outcome },
      });
    }
    if (resolution === 'NEXT_ACTION') {
      if (followUp.lead) {
        const { prisma } = await import('../config/db.js');
        await prisma.lead.update({
          where: { id: followUp.lead.id },
          data: { nextAction: input.nextAction, nextActionDueAt: input.nextFollowUpAt, nextFollowupAt: input.nextFollowUpAt },
        });
      }
      // The next follow-up is created for patient follow-ups too, not only lead follow-ups.
      await followUpRepository.create({
        personId: existing.personId,
        leadId: existing.leadId ?? undefined,
        patientId: existing.patientId ?? undefined,
        assignedUserId: existing.assignedUserId,
        branchId: existing.branchId,
        activityType: input.nextAction ?? 'Next follow-up',
        channel: existing.channel,
        direction: existing.direction,
        dueAt: input.nextFollowUpAt ?? new Date(),
        reminderAt: nextReminderAt
          ?? (input.nextFollowUpAt ? new Date(Math.max(Date.now(), input.nextFollowUpAt.getTime() - 15 * 60_000)) : new Date()),
        notes: input.notes,
        priority: existing.priority,
        source: 'FOLLOW_UP_NEXT_ACTION',
        relatedAppointmentId: existing.relatedAppointmentId ?? undefined,
        createdById: userId,
      });
    } else if (followUp.lead && leadStatusByResolution[resolution]) {
      const { prisma } = await import('../config/db.js');
      await prisma.lead.update({
        where: { id: followUp.lead.id },
        data: {
          status: leadStatusByResolution[resolution],
          lostReason: resolution === 'LOST' ? input.outcome : undefined,
          disqualificationReason: resolution === 'DISQUALIFIED' ? input.outcome : undefined,
        },
      });
    }
    await timelineRepository.create({
      personId: existing.personId,
      leadId: existing.leadId ?? undefined,
      patientId: existing.patientId ?? undefined,
      type: 'FOLLOW_UP_COMPLETED',
      title: 'Follow-up completed',
      description: input.outcome,
      createdById: userId,
    });
    await auditService.record(
      { ...audit, branchId: existing.branchId },
      { action: 'FOLLOW_UP_COMPLETED', entity: 'FollowUp', entityId: id },
    );
    return followUp;
  },
};
