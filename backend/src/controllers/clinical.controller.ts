import type { Request, Response } from 'express';
import { clinicalService } from '../services/clinical.service.js';
import { fileSchema, packageSchema, sessionSchema } from '../validations/clinical.validation.js';

export const clinicalController = {
  async listSessions(req: Request, res: Response) {
    const sessions = await clinicalService.listSessions(req.params.id);
    return res.json({ data: sessions });
  },

  async createSession(req: Request, res: Response) {
    const input = sessionSchema.parse(req.body);
    const session = await clinicalService.createSession(req.params.id, input);
    return res.status(201).json({ data: session });
  },

  async listPackages(req: Request, res: Response) {
    const packages = await clinicalService.listPackages(req.params.id);
    return res.json({ data: packages });
  },

  async createPackage(req: Request, res: Response) {
    const input = packageSchema.parse(req.body);
    const treatmentPackage = await clinicalService.createPackage(req.params.id, input);
    return res.status(201).json({ data: treatmentPackage });
  },

  async listFiles(req: Request, res: Response) {
    const files = await clinicalService.listFiles(req.params.id);
    return res.json({ data: files });
  },

  async createFile(req: Request, res: Response) {
    const input = fileSchema.parse(req.body);
    const file = await clinicalService.createFile(req.params.id, input);
    return res.status(201).json({ data: file });
  },
};
