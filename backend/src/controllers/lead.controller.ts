import type { Request, Response } from 'express';
import { leadService } from '../services/lead.service.js';
import { HttpError } from '../utils/http-error.js';
import { createLeadSchema, duplicateLeadQuerySchema, leadQuerySchema, updateLeadSchema } from '../validations/lead.validation.js';

export const leadController = {
  async list(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const query = leadQuerySchema.parse(req.query);
    const leads = await leadService.listLeads({ ...query, role: req.user.role });
    return res.json({ data: leads });
  },

  async get(req: Request, res: Response) {
    const lead = await leadService.getLead(req.params.id);
    return res.json({ data: lead });
  },

  async timeline(req: Request, res: Response) {
    const timeline = await leadService.getLeadTimeline(req.params.id);
    return res.json({ data: timeline });
  },

  async duplicates(req: Request, res: Response) {
    const query = duplicateLeadQuerySchema.parse(req.query);
    const data = await leadService.findDuplicates(query);
    return res.json({ data });
  },

  async create(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const input = createLeadSchema.parse(req.body);
    const lead = await leadService.createLead({ ...input, createdById: req.user.id });
    return res.status(201).json({ data: lead });
  },

  async update(req: Request, res: Response) {
    const input = updateLeadSchema.parse(req.body);
    const lead = await leadService.updateLead(req.params.id, input);
    return res.json({ data: lead });
  },

  async delete(req: Request, res: Response) {
    await leadService.deleteLead(req.params.id);
    return res.status(204).send();
  },
};
