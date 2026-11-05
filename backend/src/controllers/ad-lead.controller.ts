import type { Request, Response } from 'express';
import { adLeadService } from '../services/ad-lead.service.js';
import { HttpError } from '../utils/http-error.js';
import { accessService } from '../services/access.service.js';
import { adLeadQuerySchema, adLeadSchema, convertAdLeadSchema } from '../validations/ad-lead.validation.js';

export const adLeadController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = adLeadQuerySchema.parse(req.query);
    await accessService.assertBranchAccess(req.user.id, req.user.role, query.branchId);
    const data = await adLeadService.listAdLeads({ ...query, role: req.user.role });
    return res.json({ data });
  },

  async create(req: Request, res: Response) {
    const input = adLeadSchema.parse(req.body);
    const lead = await adLeadService.createAdLead(input);
    return res.status(201).json({ data: lead });
  },

  async createPublic(body: unknown, res: Response) {
    const input = adLeadSchema.parse(body);
    const lead = await adLeadService.createAdLead(input);
    return res.status(201).json({ data: lead });
  },

  async convert(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const input = convertAdLeadSchema.parse(req.body);
    await accessService.assertBranchAccess(req.user.id, req.user.role, input.branchId);
    const lead = await adLeadService.convertToLead(req.params.id, input);
    return res.json({ data: lead });
  },
};
