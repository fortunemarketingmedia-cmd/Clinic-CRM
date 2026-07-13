import type { Request, Response } from 'express';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service.js';

const analyticsQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const analyticsController = {
  async overview(req: Request, res: Response) {
    const query = analyticsQuerySchema.parse(req.query);
    const data = await analyticsService.overview(query);
    return res.json({ data });
  },
};
