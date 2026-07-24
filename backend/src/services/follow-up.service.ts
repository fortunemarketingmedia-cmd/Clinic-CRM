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
  workQuerySchema,
} from '../validations/work.validation.js';

type CreateInput = z.infer<typeof createFollowUpSchema>;
type CompleteInput = z.infer<typeof completeFollowUpSchema>;
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
    const followUp = await followUpRepository.create(input);
    await timelineRepository.create({
      personId: input.personId,
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
    const { resolution, ...completion } = input;
    const followUp = await followUpRepository.complete(id, { ...completion, completedById: userId });
    if (followUp.lead && resolution === 'NEXT_ACTION') {
      const { prisma } = await import('../config/db.js');
      await prisma.lead.update({
        where: { id: followUp.lead.id },
        data: { nextAction: input.nextAction, nextActionDueAt: input.nextFollowUpAt },
      });
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
        data: { status: leadStatusByResolution[resolution] },
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
