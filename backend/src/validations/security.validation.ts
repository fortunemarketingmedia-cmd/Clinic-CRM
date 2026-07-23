import { z } from 'zod';
export const mfaConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const mfaDisableSchema = z
  .object({
    password: z.string().min(8),
    code: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z.string().min(8).optional(),
  })
  .refine((value) => value.code || value.recoveryCode, 'An MFA or recovery code is required');
export const exportLogSchema = z.object({
  resourceType: z.enum(['PEOPLE', 'LEADS', 'APPOINTMENTS', 'PATIENTS', 'AUDIT_LOGS', 'REPORT']),
  format: z.enum(['CSV', 'XLSX', 'PDF', 'JSON']),
  branchId: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  rowCount: z.coerce.number().int().min(0).optional(),
  status: z.enum(['REQUESTED', 'COMPLETED', 'FAILED']).default('COMPLETED'),
  purpose: z.string().trim().min(3).max(500),
  failureReason: z.string().max(1000).optional(),
});
export const backupVerificationSchema = z.object({
  backupReference: z.string().min(3),
  environment: z.string().min(2),
  status: z.enum(['VERIFIED', 'FAILED', 'RUNNING']),
  checksum: z.string().optional(),
  restoreStartedAt: z.coerce.date().optional(),
  restoreCompletedAt: z.coerce.date().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  failureReason: z.string().optional(),
});
