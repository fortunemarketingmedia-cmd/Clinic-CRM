import type { Request, Response } from 'express';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service.js';
import { HttpError } from '../utils/http-error.js';

const analyticsQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const analyticsController = {
  async overview(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = analyticsQuerySchema.parse(req.query);
    const data = await analyticsService.overview(query, req.user);
    return res.json({ data });
  },
};
