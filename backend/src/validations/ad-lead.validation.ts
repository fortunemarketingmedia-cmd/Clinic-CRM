import { AdPlatform } from '@prisma/client';
import { z } from 'zod';

export const adLeadSchema = z.object({
  platform: z.nativeEnum(AdPlatform),
  externalLeadId: z.string().optional(),
  name: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional(),
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  adSetId: z.string().optional(),
  adSetName: z.string().optional(),
  adId: z.string().optional(),
  adName: z.string().optional(),
  formId: z.string().optional(),
  formName: z.string().optional(),
  branchId: z.string().optional(),
  rawPayload: z.unknown().optional(),
});

export const adLeadQuerySchema = z.object({
  platform: z.nativeEnum(AdPlatform).optional(),
  branchId: z.string().optional(),
  search: z.string().optional(),
});

export const convertAdLeadSchema = z.object({
  branchId: z.string().min(1),
  appointmentAt: z.coerce.date().optional(),
});
