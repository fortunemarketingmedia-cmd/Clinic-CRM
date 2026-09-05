import type { ActivityChannel, ActivityDirection, LeadStatus, WorkPriority, WorkStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

const clientPipelineLeadStatuses: LeadStatus[] = ['APPOINTMENT_BOOKED', 'BOOKED', 'CONFIRMED', 'ARRIVED', 'CONVERTED'];

export const followUpRepository = {
  findAssignableUser(userId: string, branchId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        role: { in: ['ADMIN', 'RECEPTIONIST'] },
        branchAccess: { some: { branchId } },
      },
      select: { id: true },
    });
  },
  updateLeadNextAction(leadId: string, nextAction: string, dueAt: Date) {
    return prisma.lead.update({
      where: { id: leadId },
      data: { nextAction, nextActionDueAt: dueAt, nextFollowupAt: dueAt },
    });
  },
  list(filters: { branchId?: string; assignedUserId?: string; status?: WorkStatus; dueFrom?: Date; dueTo?: Date; scope?: 'ACTIVE_LEADS' | 'ALL' }) {
    return prisma.followUp.findMany({
      where: { branchId: filters.branchId, assignedUserId: filters.assignedUserId, status: filters.status,
        OR: filters.scope === 'ALL' ? undefined : [{ leadId: null }, { lead: { status: { notIn: clientPipelineLeadStatuses } } }],
        dueAt: filters.dueFrom || filters.dueTo ? { gte: filters.dueFrom, lte: filters.dueTo } : undefined },
      include: { person: true, lead: true, patient: true, assignedUser: { select: { id: true, name: true } }, branch: true },
      orderBy: { dueAt: 'asc' },
    });
  },
  closeOpenLeadFollowUps(leadId: string, outcome: string) {
    return prisma.followUp.updateMany({
      where: { leadId, status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } },
      data: { status: 'COMPLETED', completedAt: new Date(), outcome },
    });
  },
  findById(id: string) { return prisma.followUp.findUnique({ where: { id }, include: { lead: true, person: true } }); },
  create(data: { personId: string; leadId?: string; patientId?: string; assignedUserId: string; branchId: string;
    activityType: string; channel: ActivityChannel; direction: ActivityDirection; dueAt: Date; notes?: string;
    reminderAt?: Date; priority: WorkPriority; source?: string; relatedAppointmentId?: string; createdById: string }) {
    return prisma.followUp.create({ data, include: { person: true, lead: true, patient: true, assignedUser: true, branch: true } });
  },
  complete(id: string, data: { outcome: string; notes?: string; nextAction?: string; nextFollowUpAt?: Date; completedById: string }) {
    return prisma.followUp.update({ where: { id }, data: { ...data, status: 'COMPLETED', completedAt: new Date() }, include: { lead: true, person: true } });
  },
};
