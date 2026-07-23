import type { Request, Response } from 'express';
import { z } from 'zod';
import { auditService } from '../services/audit.service.js';

const querySchema = z.object({
  branchId: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const auditController = {
  async list(req: Request, res: Response) {
    const data = await auditService.list(querySchema.parse(req.query));
    res.json({ data });
  },
};

