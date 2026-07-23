import type { Request, Response } from 'express';
import { reportService } from '../services/report.service.js';
import { HttpError } from '../utils/http-error.js';
import { reportQuerySchema } from '../validations/integration.validation.js';
function input(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return { ...reportQuerySchema.parse(req.query), role: req.user.role };
}
export const reportController = {
  async dashboard(req: Request, res: Response) {
    res.json({ data: await reportService.dashboard(input(req)) });
  },
  async crm(req: Request, res: Response) {
    res.json({ data: await reportService.crm(input(req)) });
  },
  async appointments(req: Request, res: Response) {
    res.json({ data: await reportService.appointments(input(req)) });
  },
  async clinical(req: Request, res: Response) {
    res.json({ data: await reportService.clinical(input(req)) });
  },
  async marketing(req: Request, res: Response) {
    res.json({ data: await reportService.marketing(input(req)) });
  },
};
