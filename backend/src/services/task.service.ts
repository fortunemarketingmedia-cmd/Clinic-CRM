import type { Role } from '@prisma/client';
import type { z } from 'zod';
import { taskRepository } from '../repositories/task.repository.js';
import { HttpError } from '../utils/http-error.js';
import type {
  createTaskSchema,
  updateTaskSchema,
  workQuerySchema,
} from '../validations/work.validation.js';
import { accessService } from './access.service.js';
import { auditService, type AuditContext } from './audit.service.js';

type Query = z.infer<typeof workQuerySchema>;
type Create = z.infer<typeof createTaskSchema>;
type Update = z.infer<typeof updateTaskSchema>;

export const taskService = {
  async list(filters: Query & { userId: string; role: Role }) {
    await accessService.assertBranchAccess(filters.userId, filters.role, filters.branchId);
    return taskRepository.list(filters);
  },
  async create(input: Create & { createdById: string; role: Role }, audit: AuditContext) {
    await accessService.assertBranchAccess(input.createdById, input.role, input.branchId);
    const assignee = await taskRepository.findAssignableUser(input.assignedUserId, input.branchId);
    if (!assignee) throw new HttpError(400, 'Select an active team member from this branch');
    const task = await taskRepository.create(input);
    await auditService.record(
      { ...audit, branchId: input.branchId },
      { action: 'TASK_CREATED', entity: 'Task', entityId: task.id },
    );
    return task;
  },
  async update(id: string, input: Update, userId: string, role: Role, audit: AuditContext) {
    const existing = await taskRepository.findById(id);
    if (!existing) throw new HttpError(404, 'Task not found');
    await accessService.assertBranchAccess(userId, role, existing.branchId);
    if (role === 'RECEPTIONIST' && existing.assignedUserId !== userId)
      throw new HttpError(403, 'You can only update tasks assigned to you');
    if (input.assignedUserId) {
      const assignee = await taskRepository.findAssignableUser(input.assignedUserId, existing.branchId);
      if (!assignee) throw new HttpError(400, 'Select an active team member from this branch');
    }
    if (input.status === 'COMPLETED' && !input.completionNotes)
      throw new HttpError(400, 'Completion notes are required');
    const task = await taskRepository.update(id, {
      ...input,
      completedById: input.status === 'COMPLETED' ? userId : undefined,
      completedAt: input.status === 'COMPLETED' ? new Date() : undefined,
    });
    await auditService.record(
      { ...audit, branchId: existing.branchId },
      { action: 'TASK_UPDATED', entity: 'Task', entityId: id },
    );
    return task;
  },
};
