import { z } from 'zod';

export const whatsappMessageSchema = z.object({
  mobile: z.string().min(8),
  templateName: z.string().min(2),
  message: z.string().min(1),
  audience: z.string().optional(),
});

export const whatsappBroadcastSchema = z.object({
  audience: z.enum(['LEADS', 'PATIENTS', 'ALL']),
  message: z.string().min(1),
  templateName: z.string().default('broadcast'),
});
