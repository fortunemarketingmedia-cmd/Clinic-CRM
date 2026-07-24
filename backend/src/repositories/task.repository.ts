import type { WorkPriority, WorkStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

export const taskRepository = {
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
  list(filters: { branchId?: string; assignedUserId?: string; status?: WorkStatus; dueFrom?: Date; dueTo?: Date }) {
    return prisma.task.findMany({
      where: { branchId: filters.branchId, assignedUserId: filters.assignedUserId, status: filters.status,
        dueAt: filters.dueFrom || filters.dueTo ? { gte: filters.dueFrom, lte: filters.dueTo } : undefined },
      include: { assignedUser: { select: { id: true, name: true } }, branch: true, person: true, lead: true, patient: true },
      orderBy: { dueAt: 'asc' },
    });
  },
  create(data: { title: string; description?: string; type: string; priority: WorkPriority; assignedUserId: string;
    assignedTeam?: string; branchId: string; personId?: string; leadId?: string; patientId?: string;
    relatedAppointmentId?: string; dueAt: Date; reminderAt?: Date; automaticallyCreated: boolean; createdById: string }) {
    return prisma.task.create({ data, include: { assignedUser: true, branch: true, person: true, lead: true, patient: true } });
  },
  findById(id: string) { return prisma.task.findUnique({ where: { id } }); },
  update(id: string, data: Partial<{ title: string; description: string; priority: WorkPriority; assignedUserId: string;
    dueAt: Date; reminderAt: Date; status: WorkStatus; completionNotes: string; completedById: string; completedAt: Date }>) {
    return prisma.task.update({ where: { id }, data, include: { assignedUser: true, branch: true, person: true, lead: true, patient: true } });
  },
};

