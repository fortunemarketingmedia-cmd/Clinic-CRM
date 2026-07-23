import { ScoreRuleOperator } from '@prisma/client';
import { z } from 'zod';
export const scoringRuleSchema = z.object({ name: z.string().min(2), description: z.string().optional(), branchId: z.string().optional(), field: z.string().min(1), operator: z.nativeEnum(ScoreRuleOperator), value: z.string().optional(), points: z.coerce.number().int().min(-100).max(100), active: z.boolean().default(true) });
export const updateScoringRuleSchema = scoringRuleSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

