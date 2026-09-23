import type { Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';
import { medicineService } from '../services/medicine.service.js';
import { medicineQuerySchema, medicineSchema, medicineUpdateSchema } from '../validations/medicine.validation.js';

function actor(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return { id: req.user.id, role: req.user.role, userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId };
}

export const medicineController = {
  async list(req: Request, res: Response) { const result = await medicineService.list(medicineQuerySchema.parse(req.query)); return res.json({ data: result.items, meta: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages } }); },
  async forms(_req: Request, res: Response) { return res.json({ data: await medicineService.listForms() }); },
  async create(req: Request, res: Response) { return res.status(201).json({ data: await medicineService.create(medicineSchema.parse(req.body), actor(req)) }); },
  async import(req: Request, res: Response) { return res.status(201).json({ data: await medicineService.import(req.file, actor(req)) }); },
  async update(req: Request, res: Response) { return res.json({ data: await medicineService.update(req.params.id, medicineUpdateSchema.parse(req.body), actor(req)) }); },
  async remove(req: Request, res: Response) { return res.json({ data: await medicineService.remove(req.params.id, actor(req)) }); },
};
