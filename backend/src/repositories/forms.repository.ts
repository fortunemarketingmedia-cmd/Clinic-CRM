import type { FormFieldType, FormType, PatientFileType, Prisma, TemplateStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

type FormFieldInput = { key: string; label: string; type: FormFieldType; required: boolean; hidden: boolean; readOnly: boolean; placeholder?: string; helpText?: string; options?: Prisma.InputJsonValue; condition?: Prisma.InputJsonValue; sortOrder: number };
type FormTemplateInput = { key: string; name: string; type: FormType; description?: string; language: string; branchId?: string; status: TemplateStatus; fields: FormFieldInput[] };
type ConsentTemplateInput = { key: string; name: string; type: FormType; language: string; branchId?: string; status: TemplateStatus; consentText: string; requiresGuardian: boolean; requiresWitness: boolean; expiryDays?: number };

function formSnapshot(template: Omit<FormTemplateInput, 'key' | 'branchId' | 'status'> & { key: string; version: number }) {
  return { key: template.key, name: template.name, type: template.type, description: template.description, language: template.language, version: template.version, fields: template.fields } as Prisma.InputJsonValue;
}

function consentSnapshot(template: ConsentTemplateInput & { version: number }) {
  return { key: template.key, name: template.name, type: template.type, language: template.language, consentText: template.consentText, requiresGuardian: template.requiresGuardian, requiresWitness: template.requiresWitness, expiryDays: template.expiryDays, version: template.version } as Prisma.InputJsonValue;
}

export const formsRepository = {
  findPatient(id: string) { return prisma.patient.findUnique({ where: { id }, include: { person: { select: { id: true, marketingConsent: true } } } }); },
  findUser(id: string) { return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, status: true } }); },
  listFormTemplates(filters: { branchId?: string; type?: FormType; status?: TemplateStatus }) {
    return prisma.formTemplate.findMany({ where: { OR: filters.branchId ? [{ branchId: null }, { branchId: filters.branchId }] : undefined, type: filters.type, status: filters.status }, include: { fields: { orderBy: { sortOrder: 'asc' } }, versions: { orderBy: { version: 'desc' }, take: 5 }, createdBy: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' } });
  },
  findFormTemplate(id: string) { return prisma.formTemplate.findUnique({ where: { id }, include: { fields: { orderBy: { sortOrder: 'asc' } }, versions: { orderBy: { version: 'desc' } } } }); },
  createFormTemplate(input: FormTemplateInput, createdById: string) {
    return prisma.$transaction(async (tx) => {
      const { fields, ...template } = input;
      const created = await tx.formTemplate.create({ data: { ...template, createdById, publishedAt: template.status === 'PUBLISHED' ? new Date() : undefined, fields: { create: fields } }, include: { fields: { orderBy: { sortOrder: 'asc' } } } });
      await tx.formTemplateVersion.create({ data: { templateId: created.id, version: 1, snapshot: formSnapshot({ ...input, version: 1 }) } });
      return created;
    });
  },
  updateFormTemplate(id: string, currentVersion: number, input: Partial<FormTemplateInput>) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.formTemplate.findUniqueOrThrow({ where: { id }, include: { fields: { orderBy: { sortOrder: 'asc' } } } });
      const version = currentVersion + 1; const fields = input.fields ?? existing.fields.map(({ key, label, type, required, hidden, readOnly, placeholder, helpText, options, condition, sortOrder }) => ({ key, label, type, required, hidden, readOnly, placeholder: placeholder ?? undefined, helpText: helpText ?? undefined, options: options as Prisma.InputJsonValue | undefined, condition: condition as Prisma.InputJsonValue | undefined, sortOrder }));
      if (input.fields) { await tx.formField.deleteMany({ where: { templateId: id } }); await tx.formField.createMany({ data: input.fields.map((field) => ({ templateId: id, ...field })) }); }
      const updated = await tx.formTemplate.update({ where: { id }, data: { name: input.name, type: input.type, description: input.description, language: input.language, branchId: input.branchId, status: input.status, currentVersion: version, publishedAt: input.status === 'PUBLISHED' ? new Date() : undefined }, include: { fields: { orderBy: { sortOrder: 'asc' } } } });
      await tx.formTemplateVersion.create({ data: { templateId: id, version, snapshot: formSnapshot({ key: existing.key, name: updated.name, type: updated.type, description: updated.description ?? undefined, language: updated.language, fields, version }) } });
      return updated;
    });
  },
  findPublishedFormVersion(templateId: string) { return prisma.formTemplate.findFirst({ where: { id: templateId, status: 'PUBLISHED' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } }); },
  async findPublishedRegistrationTemplate(branchId?: string) { const templates = await prisma.formTemplate.findMany({ where: { type: 'PATIENT_REGISTRATION', status: 'PUBLISHED', OR: branchId ? [{ branchId }, { branchId: null }] : [{ branchId: null }] }, include: { fields: { orderBy: { sortOrder: 'asc' } }, versions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } }); return templates.find((item) => item.branchId === branchId) ?? templates[0] ?? null; },
  createSubmission(data: Prisma.FormSubmissionUncheckedCreateInput) { return prisma.formSubmission.create({ data, include: { template: true, templateVersion: true } }); },
  listSubmissions(patientId: string) { return prisma.formSubmission.findMany({ where: { patientId }, include: { template: true, submittedBy: { select: { id: true, name: true } } }, orderBy: { submittedAt: 'desc' } }); },

  listConsentTemplates(branchId?: string) { return prisma.consentTemplate.findMany({ where: { OR: branchId ? [{ branchId: null }, { branchId }] : undefined }, include: { versions: { orderBy: { version: 'desc' }, take: 5 }, createdBy: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' } }); },
  findConsentTemplate(id: string) { return prisma.consentTemplate.findUnique({ where: { id }, include: { versions: { orderBy: { version: 'desc' } } } }); },
  createConsentTemplate(input: ConsentTemplateInput, createdById: string) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.consentTemplate.create({ data: { ...input, createdById, publishedAt: input.status === 'PUBLISHED' ? new Date() : undefined } });
      await tx.consentTemplateVersion.create({ data: { templateId: created.id, version: 1, consentText: created.consentText, snapshot: consentSnapshot({ ...input, version: 1 }) } });
      return created;
    });
  },
  updateConsentTemplate(id: string, currentVersion: number, input: Partial<ConsentTemplateInput>) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.consentTemplate.findUniqueOrThrow({ where: { id } }); const version = currentVersion + 1;
      const updated = await tx.consentTemplate.update({ where: { id }, data: { ...input, currentVersion: version, publishedAt: input.status === 'PUBLISHED' ? new Date() : undefined } });
      await tx.consentTemplateVersion.create({ data: { templateId: id, version, consentText: updated.consentText, snapshot: consentSnapshot({ key: existing.key, name: updated.name, type: updated.type, language: updated.language, branchId: updated.branchId ?? undefined, status: updated.status, consentText: updated.consentText, requiresGuardian: updated.requiresGuardian, requiresWitness: updated.requiresWitness, expiryDays: updated.expiryDays ?? undefined, version }) } });
      return updated;
    });
  },
  findPublishedConsentVersion(templateId: string) { return prisma.consentTemplate.findFirst({ where: { id: templateId, status: 'PUBLISHED' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } }); },
  createConsentRecord(data: Prisma.ConsentRecordUncheckedCreateInput) { return prisma.consentRecord.create({ data, include: { template: true, version: true, staffWitness: { select: { id: true, name: true } } } }); },
  findConsentRecord(id: string) { return prisma.consentRecord.findUnique({ where: { id }, include: { template: true, patient: true, staffWitness: { select: { id: true, name: true } } } }); },
  listConsentRecords(patientId: string) { return prisma.consentRecord.findMany({ where: { patientId }, include: { template: true, staffWitness: { select: { id: true, name: true } } }, orderBy: { signedAt: 'desc' } }); },
  hasActiveMarketingConsent(patientId: string) { return prisma.consentRecord.count({ where: { patientId, status: 'SIGNED', template: { type: 'MARKETING_USE_CONSENT' }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }).then((count) => count > 0); },
  expireConsentRecords(patientId: string) { return prisma.consentRecord.updateMany({ where: { patientId, status: 'SIGNED', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } }); },
  markConsentExpired(id: string) { return prisma.consentRecord.update({ where: { id }, data: { status: 'EXPIRED' } }); },
  withdrawConsent(id: string, reason: string) { return prisma.consentRecord.update({ where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawalReason: reason }, include: { template: true } }); },
  updateMarketingConsent(patientId: string, allowed: boolean) { return prisma.person.updateMany({ where: { patient: { id: patientId } }, data: { marketingConsent: allowed } }); },

  createFile(data: Prisma.PatientFileUncheckedCreateInput) { return prisma.patientFile.create({ data, include: { uploadedBy: { select: { id: true, name: true } } } }); },
  findFileByIdempotencyKey(uploadIdempotencyKey: string) { return prisma.patientFile.findUnique({ where: { uploadIdempotencyKey }, include: { uploadedBy: { select: { id: true, name: true } }, derivedFiles: true } }); },
  upsertDerivedFile(data: Prisma.PatientFileUncheckedCreateInput & { originalFileId: string; variant: string }) {
    return prisma.patientFile.upsert({
      where: { originalFileId_variant: { originalFileId: data.originalFileId, variant: data.variant } },
      create: data,
      update: { storageKey: data.storageKey, url: data.url, mimeType: data.mimeType, sizeBytes: data.sizeBytes, checksum: data.checksum, width: data.width, height: data.height, optimizationStatus: 'READY' },
    });
  },
  updateFileOptimization(id: string, optimizationStatus: string, dimensions?: { width?: number; height?: number }) { return prisma.patientFile.update({ where: { id }, data: { optimizationStatus, ...dimensions } }); },
  findFile(id: string) { return prisma.patientFile.findUnique({ where: { id }, include: { patient: { select: { id: true, branchId: true } }, uploadedBy: { select: { id: true, name: true } } } }); },
  listFiles(filters: { patientId?: string; fileType?: PatientFileType; gallery?: boolean }) { return prisma.patientFile.findMany({ where: { patientId: filters.patientId, originalFileId: null, fileType: filters.gallery ? { in: ['CLINICAL_PHOTOGRAPH', 'BEFORE_IMAGE', 'AFTER_IMAGE'] } : filters.fileType }, include: { uploadedBy: { select: { id: true, name: true } }, procedureSession: { select: { id: true, procedureName: true } }, derivedFiles: true }, orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }] }); },
};
