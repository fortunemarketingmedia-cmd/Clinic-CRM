import type { Request, Response } from 'express';
import { automationService } from '../services/automation.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  automationSchema,
  automationTestSchema,
  automationUpdateSchema,
} from '../validations/integration.validation.js';
function actor(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return { id: req.user.id, role: req.user.role };
}
function audit(req: Request) {
  return {
    userId: req.user?.id,
    ipAddress: req.ip,
    device: req.header('user-agent'),
    correlationId: req.correlationId,
  };
}
export const automationController = {
  async list(req: Request, res: Response) {
    actor(req);
    res.json({
      data: await automationService.list(
        typeof req.query.branchId === 'string' ? req.query.branchId : undefined,
      ),
    });
  },
  async get(req: Request, res: Response) {
    actor(req);
    res.json({ data: await automationService.get(req.params.id) });
  },
  async create(req: Request, res: Response) {
    res
      .status(201)
      .json({
        data: await automationService.create(
          automationSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
  async update(req: Request, res: Response) {
    res.json({
      data: await automationService.update(
        req.params.id,
        automationUpdateSchema.parse(req.body),
        actor(req),
        audit(req),
      ),
    });
  },
  async test(req: Request, res: Response) {
    res.json({
      data: await automationService.test(
        req.params.id,
        automationTestSchema.parse(req.body),
        actor(req),
        audit(req),
      ),
    });
  },
  async executions(req: Request, res: Response) {
    actor(req);
    res.json({
      data: await automationService.executions({
        automationId:
          typeof req.query.automationId === 'string' ? req.query.automationId : undefined,
        status: typeof req.query.status === 'string' ? (req.query.status as never) : undefined,
      }),
    });
  },
};
