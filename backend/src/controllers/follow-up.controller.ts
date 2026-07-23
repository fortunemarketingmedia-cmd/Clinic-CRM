import type { Request, Response } from 'express';
import { followUpService } from '../services/follow-up.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  workQuerySchema,
} from '../validations/work.validation.js';

const context = (req: Request) => ({
  userId: req.user?.id,
  ipAddress: req.ip,
  device: req.header('user-agent'),
  correlationId: req.correlationId,
});
export const followUpController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res.json({
      data: await followUpService.list({
        ...workQuerySchema.parse(req.query),
        userId: req.user.id,
        role: req.user.role,
      }),
    });
  },
  async create(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const input = createFollowUpSchema.parse(req.body);
    res
      .status(201)
      .json({
        data: await followUpService.create(
          { ...input, createdById: req.user.id, role: req.user.role },
          context(req),
        ),
      });
  },
  async complete(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    res.json({
      data: await followUpService.complete(
        req.params.id,
        completeFollowUpSchema.parse(req.body),
        req.user.id,
        req.user.role,
        context(req),
      ),
    });
  },
};
