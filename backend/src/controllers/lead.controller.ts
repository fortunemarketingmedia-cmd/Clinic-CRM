import type { Request, Response } from 'express';
import { leadService } from '../services/lead.service.js';
import { HttpError } from '../utils/http-error.js';
import { createLeadSchema, duplicateLeadQuerySchema, leadQuerySchema, updateLeadSchema, websiteLeadSchema } from '../validations/lead.validation.js';
import { leadScoringService } from '../services/lead-scoring.service.js';
import { accessService } from '../services/access.service.js';

export const leadController = {
  async list(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const query = leadQuerySchema.parse(req.query);
    const leads = await leadService.listLeads({ ...query, role: req.user.role, userId: req.user.id });
    return res.json({ data: leads.items, meta: { total: leads.total, page: leads.page, pageSize: leads.pageSize, totalPages: Math.ceil(leads.total / leads.pageSize) } });
  },

  async get(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const lead = await leadService.getLead(req.params.id, req.user);
    return res.json({ data: lead });
  },

  async timeline(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await leadService.getLead(req.params.id, req.user);
    const timeline = await leadService.getLeadTimeline(req.params.id);
    return res.json({ data: timeline });
  },

  async duplicates(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = duplicateLeadQuerySchema.parse(req.query);
    if (!query.branchId && req.user.role !== 'ADMIN') throw new HttpError(400, 'Branch is required');
    await accessService.assertBranchAccess(req.user.id, req.user.role, query.branchId);
    const data = await leadService.findDuplicates(query);
    return res.json({ data });
  },

  async scoreHistory(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await leadService.getLead(req.params.id, req.user);
    return res.json({ data: await leadScoringService.history(req.params.id) });
  },

  async recalculateScore(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await leadService.getLead(req.params.id, req.user);
    return res.json({ data: await leadScoringService.recalculate(req.params.id) });
  },

  async create(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const input = createLeadSchema.parse(req.body);
    const lead = await leadService.createLead({ ...input, createdById: req.user.id, role: req.user.role }, { userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });
    return res.status(201).json({ data: lead });
  },

  async createWebsiteLead(req: Request, res: Response) {
    const input = websiteLeadSchema.parse(req.body);
    const lead = await leadService.createWebsiteLead(input);
    return res.status(201).json({ data: { id: lead.id, status: lead.status } });
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await leadService.getLead(req.params.id, req.user);
    const input = updateLeadSchema.parse(req.body);
    const lead = await leadService.updateLead(req.params.id, input, { userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });
    return res.json({ data: lead });
  },

  async delete(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    await leadService.getLead(req.params.id, req.user);
    await leadService.deleteLead(req.params.id, { userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId });
    return res.status(204).send();
  },
};
