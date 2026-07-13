import type { Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp.service.js';
import { whatsappBroadcastSchema, whatsappMessageSchema } from '../validations/whatsapp.validation.js';

export const whatsappController = {
  async list(_req: Request, res: Response) {
    const logs = await whatsappService.listLogs();
    return res.json({ data: logs });
  },

  async create(req: Request, res: Response) {
    const input = whatsappMessageSchema.parse(req.body);
    const log = await whatsappService.queueMessage(input);
    return res.status(201).json({ data: log });
  },

  async broadcast(req: Request, res: Response) {
    const input = whatsappBroadcastSchema.parse(req.body);
    const logs = await whatsappService.queueBroadcast(input);
    return res.status(201).json({ data: logs });
  },
};
