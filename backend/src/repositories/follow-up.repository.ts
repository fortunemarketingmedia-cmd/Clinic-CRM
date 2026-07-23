import type { ActivityChannel, ActivityDirection, WorkPriority, WorkStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

export const followUpRepository = {
  list(filters: { branchId?: string; assignedUserId?: string; status?: WorkStatus; dueFrom?: Date; dueTo?: Date }) {
    return prisma.followUp.findMany({
      where: { branchId: filters.branchId, assignedUserId: filters.assignedUserId, status: filters.status,
        dueAt: filters.dueFrom || filters.dueTo ? { gte: filters.dueFrom, lte: filters.dueTo } : undefined },
      include: { person: true, lead: true, patient: true, assignedUser: { select: { id: true, name: true } }, branch: true },
      orderBy: { dueAt: 'asc' },
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

