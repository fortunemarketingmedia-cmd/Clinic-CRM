import { MedicineStatus } from '@prisma/client';
import { z } from 'zod';

const optionalText = z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), z.string().trim().max(120).optional());

export const medicineQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(MedicineStatus).optional(),
  form: z.string().trim().max(120).optional(),
  sort: z.enum(['name_asc', 'name_desc', 'created_desc', 'updated_desc']).default('name_asc'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const medicineSchema = z.object({
  name: z.string().trim().min(1, 'Medicine name is required').max(160),
  genericName: optionalText,
  strength: optionalText,
  form: optionalText,
  status: z.nativeEnum(MedicineStatus).default(MedicineStatus.ACTIVE),
});

export const medicineUpdateSchema = medicineSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one medicine field is required');
