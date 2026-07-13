import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { settingsService } from '../services/settings.service.js';
import { settingsSchema } from '../validations/settings.validation.js';

export const settingsController = {
  async get(_req: Request, res: Response) {
    const settings = await settingsService.getSettings();
    return res.json({ data: settings });
  },

  async update(req: Request, res: Response) {
    const input = settingsSchema.parse(req.body);
    const settings = await settingsService.updateSettings({
      ...input,
      patientFormConfig: input.patientFormConfig as Prisma.InputJsonValue | undefined,
    });
    return res.json({ data: settings });
  },
};
