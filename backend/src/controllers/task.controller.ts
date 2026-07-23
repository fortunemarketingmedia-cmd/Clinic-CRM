import type { Request, Response } from 'express';
import { taskService } from '../services/task.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  createTaskSchema,
  updateTaskSchema,
  workQuerySchema,
} from '../validations/work.validation.js';
const context = (req: Request) => ({
  userId: req.user?.id,
  ipAddress: req.ip,
  device: req.header('user-agent'),
  correlationId: req.correlationId,
});
export const taskController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res.json({
      data: await taskService.list({
        ...workQuerySchema.parse(req.query),
        userId: req.user.id,
        role: req.user.role,
      }),
    });
  },
  async create(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res
      .status(201)
      .json({
        data: await taskService.create(
          { ...createTaskSchema.parse(req.body), createdById: req.user.id, role: req.user.role },
          context(req),
        ),
      });
  },
  async update(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res.json({
      data: await taskService.update(
        req.params.id,
        updateTaskSchema.parse(req.body),
        req.user.id,
        req.user.role,
        context(req),
      ),
    });
  },
};
