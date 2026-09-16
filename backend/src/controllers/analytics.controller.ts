import type { Request, Response } from 'express';
import { z } from 'zod';
import { analyticsService } from '../services/analytics.service.js';
import { financeExportService } from '../services/finance-export.service.js';
import { HttpError } from '../utils/http-error.js';

const analyticsQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const financeExportQuerySchema = analyticsQuerySchema.extend({
  format: z.enum(['pdf', 'csv']).default('pdf'),
});

const financeEmailSchema = analyticsQuerySchema.extend({
  recipientEmail: z.string().email(),
});

export const analyticsController = {
  async overview(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = analyticsQuerySchema.parse(req.query);
    const data = await analyticsService.overview(query, req.user);
    return res.json({ data });
  },
  async exportFinance(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = financeExportQuerySchema.parse(req.query);
    const { buffer, contentType, filename } = await financeExportService.export(query, req.user);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  },
  async emailFinance(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const body = financeEmailSchema.parse(req.body);
    const result = await financeExportService.emailReport(body, req.user);
    return res.json({ data: result });
  },
  async financeRecipients(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const data = await financeExportService.recentRecipients(branchId);
    return res.json({ data });
  },
};
