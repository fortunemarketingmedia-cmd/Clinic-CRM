import { FileVisibility, FormFieldType, FormSubmissionStatus, FormType, PatientFileType, PhotoAngle, TemplateStatus } from '@prisma/client';
import { z } from 'zod';

const fieldSchema = z.object({
  key: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), label: z.string().trim().min(2), type: z.nativeEnum(FormFieldType),
  required: z.boolean().default(false), hidden: z.boolean().default(false), readOnly: z.boolean().default(false),
  placeholder: z.string().optional(), helpText: z.string().optional(), options: z.array(z.string()).optional(),
  condition: z.object({ field: z.string(), operator: z.enum(['EQUALS', 'NOT_EQUALS', 'CONTAINS']), value: z.unknown() }).optional(), sortOrder: z.coerce.number().int().min(0),
});

export const formTemplateSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]+$/), name: z.string().trim().min(3), type: z.nativeEnum(FormType), description: z.string().optional(),
  language: z.string().trim().min(2).default('en'), branchId: z.string().optional(), status: z.nativeEnum(TemplateStatus).default('DRAFT'), fields: z.array(fieldSchema).min(1),
});
export const formTemplateUpdateSchema = formTemplateSchema.omit({ key: true }).partial().extend({ fields: z.array(fieldSchema).min(1).optional() });
export const formTemplateQuerySchema = z.object({ branchId: z.string().optional(), type: z.nativeEnum(FormType).optional(), status: z.nativeEnum(TemplateStatus).optional() });
export const formSubmissionSchema = z.object({ templateId: z.string().min(1), patientId: z.string().min(1), appointmentId: z.string().optional(), procedureSessionId: z.string().optional(), values: z.record(z.string(), z.unknown()), status: z.nativeEnum(FormSubmissionStatus).default('SUBMITTED') });

export const consentTemplateSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9-]+$/), name: z.string().trim().min(3), type: z.nativeEnum(FormType), language: z.string().min(2).default('en'),
  branchId: z.string().optional(), status: z.nativeEnum(TemplateStatus).default('DRAFT'), consentText: z.string().trim().min(20),
  requiresGuardian: z.boolean().default(false), requiresWitness: z.boolean().default(false), expiryDays: z.coerce.number().int().positive().optional(),
});
export const consentTemplateUpdateSchema = consentTemplateSchema.omit({ key: true }).partial();
export const consentSignSchema = z.object({
  templateId: z.string().min(1), patientId: z.string().min(1), appointmentId: z.string().optional(), procedureSessionId: z.string().optional(),
  signerName: z.string().trim().min(2), signatureBase64: z.string().min(20), guardianName: z.string().optional(), guardianRelationship: z.string().optional(),
  guardianSignatureBase64: z.string().optional(), staffWitnessId: z.string().optional(),
});
export const consentWithdrawalSchema = z.object({ reason: z.string().trim().min(3) });

export const secureFileMetadataSchema = z.object({
  patientId: z.string().min(1), sessionId: z.string().optional(), invoiceId: z.string().optional(), encounterId: z.string().optional(), procedureSessionId: z.string().optional(), appointmentId: z.string().optional(),
  fileType: z.nativeEnum(PatientFileType), originalFilename: z.string().trim().min(1).max(255), mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']),
  clinicalUsePermission: z.boolean().default(true), marketingPermission: z.boolean().default(false),
  visibility: z.nativeEnum(FileVisibility).default('CARE_TEAM'), photoAngle: z.nativeEnum(PhotoAngle).optional(), treatmentArea: z.string().optional(),
  visitDate: z.coerce.date().optional(), annotation: z.record(z.string(), z.unknown()).optional(), originalFileId: z.string().optional(), idempotencyKey: z.string().uuid().optional(),
});
export const secureFileSchema = secureFileMetadataSchema.extend({ contentBase64: z.string().min(20) });
export const fileQuerySchema = z.object({ patientId: z.string().min(1), fileType: z.nativeEnum(PatientFileType).optional(), gallery: z.coerce.boolean().optional() });
export const fileAccessTokenSchema = z.object({ token: z.string().min(10) });
