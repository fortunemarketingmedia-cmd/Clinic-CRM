import type { Prisma, Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { z } from 'zod';
import { formsRepository } from '../repositories/forms.repository.js';
import { HttpError } from '../utils/http-error.js';
import type { consentSignSchema, consentTemplateSchema, consentTemplateUpdateSchema, fileQuerySchema, formSubmissionSchema, formTemplateQuerySchema, formTemplateSchema, formTemplateUpdateSchema, secureFileMetadataSchema } from '../validations/forms.validation.js';
import { accessService } from './access.service.js';
import { auditService, type AuditContext } from './audit.service.js';
import { fileStorageService } from './file-storage.service.js';
import { canAccessFile, validateSubmission, type SnapshotField } from './form-policy.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { integrationRepository } from '../repositories/integration.repository.js';
import { imageOptimizationService } from './image-optimization.service.js';
import { metricsService } from './metrics.service.js';
import { malwareScannerService } from './malware-scanner.service.js';

type Actor = AuditContext & { id: string; role: Role };
const administratorRoles: Role[] = [RoleEnum.ADMIN];
const careRoles: Role[] = [RoleEnum.ADMIN, RoleEnum.RECEPTIONIST];

function requireAdministrator(actor: Actor) { if (!administratorRoles.includes(actor.role)) throw new HttpError(403, 'Form and consent templates require clinic-administrator access'); }
function requireCareRole(actor: Actor) { if (!careRoles.includes(actor.role)) throw new HttpError(403, 'You do not have permission to manage patient forms or files'); }
async function audit(actor: Actor, event: Parameters<typeof auditService.record>[1]) {
  const { userId, branchId, ipAddress, device, correlationId } = actor;
  await auditService.record({ userId, branchId, ipAddress, device, correlationId }, event);
}

async function requirePatient(patientId: string, actor: Actor) {
  const patient = await formsRepository.findPatient(patientId); if (!patient) throw new HttpError(404, 'Patient not found');
  await accessService.assertBranchAccess(actor.id, actor.role, patient.branchId); return patient;
}

function signatureMime(data: string) { const match = /^data:(image\/(?:png|jpeg|webp));base64,/.exec(data); if (!match) throw new HttpError(400, 'Signature must be a PNG, JPEG, or WebP data URL'); return match[1]; }

function buildConsentPdf(input: { clinicTitle: string; patientName: string; patientNo: string; templateName: string; consentText: string; signerName: string; signedAt: Date; signature: Buffer; guardianName?: string; guardianSignature?: Buffer; witnessName?: string }) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 }); const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.fontSize(20).fillColor('#a51d2d').text(input.clinicTitle, { align: 'center' }); doc.fontSize(14).fillColor('#222').text(input.templateName, { align: 'center' }).moveDown();
    doc.fontSize(10).text(`Patient: ${input.patientName} (${input.patientNo})`).text(`Signed: ${input.signedAt.toLocaleString('en-IN')}`).moveDown();
    doc.fontSize(11).text(input.consentText, { align: 'justify', lineGap: 4 }).moveDown();
    doc.fontSize(10).text(`Signed by: ${input.signerName}`); try { doc.image(input.signature, { fit: [180, 70] }); } catch { doc.text('[Signature image recorded securely]'); }
    if (input.guardianName) { doc.moveDown().text(`Guardian: ${input.guardianName}`); if (input.guardianSignature) { try { doc.image(input.guardianSignature, { fit: [180, 70] }); } catch { doc.text('[Guardian signature recorded securely]'); } } }
    if (input.witnessName) doc.moveDown().text(`Staff witness: ${input.witnessName}`); doc.moveDown(2).fontSize(8).fillColor('#666').text('This document is an immutable rendering of the consent template version and signatures recorded at the time shown above.'); doc.end();
  });
}

export const formsService = {
  async listFormTemplates(query: z.infer<typeof formTemplateQuerySchema>, actor: Actor) { requireCareRole(actor); await accessService.assertBranchAccess(actor.id, actor.role, query.branchId); return formsRepository.listFormTemplates(administratorRoles.includes(actor.role) ? query : { ...query, status: 'PUBLISHED' }); },
  async createFormTemplate(input: z.infer<typeof formTemplateSchema>, actor: Actor) { requireAdministrator(actor); await accessService.assertBranchAccess(actor.id, actor.role, input.branchId); const normalized = { ...input, fields: input.fields.map((field) => ({ ...field, options: field.options as Prisma.InputJsonValue | undefined, condition: field.condition as Prisma.InputJsonValue | undefined })) }; const created = await formsRepository.createFormTemplate(normalized, actor.id); await audit(actor, { action: 'FORM_TEMPLATE_CREATED', entity: 'FormTemplate', entityId: created.id, newValue: { version: created.currentVersion, status: created.status } }); return created; },
  async updateFormTemplate(id: string, input: z.infer<typeof formTemplateUpdateSchema>, actor: Actor) { requireAdministrator(actor); const existing = await formsRepository.findFormTemplate(id); if (!existing) throw new HttpError(404, 'Form template not found'); await accessService.assertBranchAccess(actor.id, actor.role, existing.branchId ?? undefined); const normalized = { ...input, fields: input.fields?.map((field) => ({ ...field, options: field.options as Prisma.InputJsonValue | undefined, condition: field.condition as Prisma.InputJsonValue | undefined })) }; const updated = await formsRepository.updateFormTemplate(id, existing.currentVersion, normalized); await audit(actor, { action: 'FORM_TEMPLATE_VERSION_CREATED', entity: 'FormTemplate', entityId: id, previousValue: { version: existing.currentVersion }, newValue: { version: updated.currentVersion, status: updated.status } }); return updated; },
  async submitForm(input: z.infer<typeof formSubmissionSchema>, actor: Actor) { requireCareRole(actor); const patient = await requirePatient(input.patientId, actor); const template = await formsRepository.findPublishedFormVersion(input.templateId); if (!template || !template.versions[0]) throw new HttpError(409, 'Published form template is unavailable'); const snapshot = template.versions[0].snapshot as { fields?: SnapshotField[] }; validateSubmission(snapshot.fields ?? [], input.values); const submission = await formsRepository.createSubmission({ ...input, values: input.values as Prisma.InputJsonValue, templateVersionId: template.versions[0].id, submittedById: actor.id, ipAddress: actor.ipAddress, deviceMetadata: actor.device }); await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId: patient.id, createdById: actor.id, type: 'FORM_SUBMITTED', title: `${template.name} submitted`, description: `Version ${template.currentVersion}` }); await audit(actor, { action: 'FORM_SUBMITTED', entity: 'FormSubmission', entityId: submission.id, newValue: { templateId: template.id, version: template.currentVersion } }); return submission; },
  async listSubmissions(patientId: string, actor: Actor) { requireCareRole(actor); await requirePatient(patientId, actor); return formsRepository.listSubmissions(patientId); },

  async listConsentTemplates(branchId: string | undefined, actor: Actor) { requireCareRole(actor); await accessService.assertBranchAccess(actor.id, actor.role, branchId); const templates = await formsRepository.listConsentTemplates(branchId); return administratorRoles.includes(actor.role) ? templates : templates.filter((template) => template.status === 'PUBLISHED'); },
  async createConsentTemplate(input: z.infer<typeof consentTemplateSchema>, actor: Actor) { requireAdministrator(actor); await accessService.assertBranchAccess(actor.id, actor.role, input.branchId); const created = await formsRepository.createConsentTemplate(input, actor.id); await audit(actor, { action: 'CONSENT_TEMPLATE_CREATED', entity: 'ConsentTemplate', entityId: created.id, newValue: { version: created.currentVersion, status: created.status } }); return created; },
  async updateConsentTemplate(id: string, input: z.infer<typeof consentTemplateUpdateSchema>, actor: Actor) { requireAdministrator(actor); const existing = await formsRepository.findConsentTemplate(id); if (!existing) throw new HttpError(404, 'Consent template not found'); await accessService.assertBranchAccess(actor.id, actor.role, existing.branchId ?? undefined); const updated = await formsRepository.updateConsentTemplate(id, existing.currentVersion, input); await audit(actor, { action: 'CONSENT_TEMPLATE_VERSION_CREATED', entity: 'ConsentTemplate', entityId: id, previousValue: { version: existing.currentVersion }, newValue: { version: updated.currentVersion, status: updated.status } }); return updated; },
  async signConsent(input: z.infer<typeof consentSignSchema>, actor: Actor) {
    requireCareRole(actor); const patient = await requirePatient(input.patientId, actor); const template = await formsRepository.findPublishedConsentVersion(input.templateId);
    if (!template || !template.versions[0]) throw new HttpError(409, 'Published consent template is unavailable'); if (template.requiresGuardian && (!input.guardianName || !input.guardianSignatureBase64)) throw new HttpError(400, 'Guardian name and signature are required'); if (template.requiresWitness && !input.staffWitnessId) throw new HttpError(400, 'Staff witness is required');
    const witness = input.staffWitnessId ? await formsRepository.findUser(input.staffWitnessId) : null; if (input.staffWitnessId && (!witness || witness.status !== 'ACTIVE')) throw new HttpError(400, 'Staff witness must be an active user');
    const signatureBuffer = Buffer.from(input.signatureBase64.slice(input.signatureBase64.indexOf(',') + 1), 'base64'); const signature = await fileStorageService.writeBase64(patient.id, input.signatureBase64, signatureMime(input.signatureBase64));
    let guardianSignature: Awaited<ReturnType<typeof fileStorageService.writeBase64>> | undefined; let guardianBuffer: Buffer | undefined;
    if (input.guardianSignatureBase64) { guardianBuffer = Buffer.from(input.guardianSignatureBase64.slice(input.guardianSignatureBase64.indexOf(',') + 1), 'base64'); guardianSignature = await fileStorageService.writeBase64(patient.id, input.guardianSignatureBase64, signatureMime(input.guardianSignatureBase64)); }
    const signedAt = new Date();
    const pdf = await buildConsentPdf({ clinicTitle: 'Revive Clinic', patientName: patient.fullName, patientNo: patient.patientNo, templateName: template.name, consentText: template.versions[0].consentText, signerName: input.signerName, signedAt, signature: signatureBuffer, guardianName: input.guardianName, guardianSignature: guardianBuffer, witnessName: witness?.name });
    const signedPdf = await fileStorageService.writeBuffer(patient.id, pdf, 'application/pdf'); const expiresAt = template.expiryDays ? new Date(signedAt.getTime() + template.expiryDays * 86_400_000) : undefined;
    const record = await formsRepository.createConsentRecord({ templateId: template.id, templateVersionId: template.versions[0].id, templateVersion: template.versions[0].version, patientId: patient.id, appointmentId: input.appointmentId, procedureSessionId: input.procedureSessionId, language: template.language, consentText: template.versions[0].consentText, signerName: input.signerName, signatureStorageKey: signature.storageKey, guardianName: input.guardianName, guardianRelationship: input.guardianRelationship, guardianSignatureStorageKey: guardianSignature?.storageKey, staffWitnessId: input.staffWitnessId, signedPdfStorageKey: signedPdf.storageKey, signedAt, expiresAt, ipAddress: actor.ipAddress, deviceMetadata: actor.device });
    if (template.type === 'MARKETING_USE_CONSENT') await formsRepository.updateMarketingConsent(patient.id, true);
    await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId: patient.id, createdById: actor.id, type: 'CONSENT_SIGNED', title: `${template.name} signed`, description: `Version ${record.templateVersion}` }); await audit(actor, { action: 'CONSENT_SIGNED', entity: 'ConsentRecord', entityId: record.id, newValue: { templateId: template.id, version: record.templateVersion } }); return record;
  },
  async listConsentRecords(patientId: string, actor: Actor) { requireCareRole(actor); await requirePatient(patientId, actor); await formsRepository.expireConsentRecords(patientId); return formsRepository.listConsentRecords(patientId); },
  async withdrawConsent(id: string, reason: string, actor: Actor) { requireCareRole(actor); const existing = await formsRepository.findConsentRecord(id); if (!existing) throw new HttpError(404, 'Consent record not found'); await requirePatient(existing.patientId, actor); if (existing.status === 'SIGNED' && existing.expiresAt && existing.expiresAt <= new Date()) { await formsRepository.markConsentExpired(id); throw new HttpError(409, 'Expired consent cannot be withdrawn'); } if (existing.status !== 'SIGNED') throw new HttpError(409, 'Only active signed consent can be withdrawn'); const record = await formsRepository.withdrawConsent(id, reason); if (record.template.type === 'MARKETING_USE_CONSENT') await formsRepository.updateMarketingConsent(record.patientId, false); await audit(actor, { action: 'CONSENT_WITHDRAWN', entity: 'ConsentRecord', entityId: id, previousValue: { status: existing.status }, newValue: { status: 'WITHDRAWN', reason } }); return record; },
  async consentPdf(id: string, actor: Actor) { requireCareRole(actor); const record = await formsRepository.findConsentRecord(id); if (!record) throw new HttpError(404, 'Consent record not found'); await requirePatient(record.patientId, actor); await audit(actor, { action: 'CONSENT_PDF_VIEWED', entity: 'ConsentRecord', entityId: id }); return fileStorageService.read(record.signedPdfStorageKey); },

  async uploadFile(input: z.infer<typeof secureFileMetadataSchema> & { contentBase64?: string }, actor: Actor, binary?: Buffer) {
    requireCareRole(actor);
    const patient = await requirePatient(input.patientId, actor);
    if (input.marketingPermission && !(await formsRepository.hasActiveMarketingConsent(patient.id))) throw new HttpError(409, 'Marketing permission requires an active signed marketing consent');
    if (input.idempotencyKey) {
      const existing = await formsRepository.findFileByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        if (existing.patientId !== patient.id) throw new HttpError(409, 'Upload idempotency key is already in use');
        return this.withAccessUrl(existing);
      }
    }
    if (!binary && !input.contentBase64) throw new HttpError(400, 'A file is required');
    let dimensions: { width: number; height: number } | undefined;
    if (binary && imageOptimizationService.isImage(input.mimeType)) {
      try { dimensions = await imageOptimizationService.inspect(binary); }
      catch { throw new HttpError(400, 'Image is malformed or exceeds the permitted dimensions'); }
    }
    if (binary && !imageOptimizationService.isImage(input.mimeType)) await malwareScannerService.scan(binary);
    let stored;
    try {
      stored = binary
        ? await fileStorageService.writeBuffer(patient.id, binary, input.mimeType)
        : await fileStorageService.writeBase64(patient.id, input.contentBase64!, input.mimeType);
    } catch (error) {
      metricsService.upload(input.mimeType, 'failure');
      throw error;
    }
    const category = input.fileType === 'INVOICE' ? 'INVOICE' : input.fileType === 'PRESCRIPTION' ? 'PRESCRIPTION' : input.fileType === 'MEDICAL_REPORT' ? 'REPORT' : ['CLINICAL_PHOTOGRAPH', 'BEFORE_IMAGE', 'AFTER_IMAGE'].includes(input.fileType) ? 'IMAGE' : 'OTHER';
    const { contentBase64: _content, idempotencyKey, ...metadata } = input; void _content;
    let file;
    try {
      file = await formsRepository.createFile({ ...metadata, annotation: metadata.annotation as Prisma.InputJsonValue | undefined, ...stored, category, name: input.originalFilename, url: `secure://${stored.storageKey}`, uploadedById: actor.id, uploadIdempotencyKey: idempotencyKey, width: dimensions?.width, height: dimensions?.height, optimizationStatus: imageOptimizationService.isImage(input.mimeType) ? 'QUEUED' : 'NOT_REQUIRED' });
    } catch (error) {
      await fileStorageService.delete(stored.storageKey).catch(() => undefined);
      if (idempotencyKey) {
        const existing = await formsRepository.findFileByIdempotencyKey(idempotencyKey);
        if (existing?.patientId === patient.id) return this.withAccessUrl(existing);
      }
      throw error;
    }
    if (imageOptimizationService.isImage(input.mimeType)) {
      try { await integrationRepository.createJob({ type: 'FILE_OPTIMIZATION', idempotencyKey: `file-optimize:${file.id}`, payload: { fileId: file.id } }); }
      catch (error) {
        await formsRepository.updateFileOptimization(file.id, 'FAILED');
        console.error(JSON.stringify({ level: 'error', component: 'file-upload', fileId: file.id, message: error instanceof Error ? error.message : String(error) }));
      }
    }
    await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId: patient.id, createdById: actor.id, type: 'FILE_UPLOADED', title: `${input.fileType.replaceAll('_', ' ')} uploaded`, description: input.originalFilename });
    await audit(actor, { action: 'PATIENT_FILE_UPLOADED', entity: 'PatientFile', entityId: file.id, newValue: { fileType: file.fileType, visibility: file.visibility, marketingPermission: file.marketingPermission } });
    metricsService.upload(input.mimeType, 'success');
    return this.withAccessUrl(file);
  },
  async listFiles(query: z.infer<typeof fileQuerySchema>, actor: Actor) { requireCareRole(actor); await requirePatient(query.patientId, actor); const files = await formsRepository.listFiles(query); return files.filter((file) => canAccessFile(actor.role, file.visibility)).map((file) => this.withAccessUrl(file)); },
  withAccessUrl<T extends { id: string; storageKey: string | null; url: string; derivedFiles?: Array<{ id: string; storageKey: string | null; url: string; variant: string }> }>(file: T) { const expiresAt = Date.now() + 5 * 60_000; const token = fileStorageService.createAccessToken(file.id, expiresAt); const { storageKey: _storageKey, url: _url, derivedFiles, ...safe } = file; void _storageKey; void _url; const derivativeUrls = Object.fromEntries((derivedFiles ?? []).map((derived) => { const derivedToken = fileStorageService.createAccessToken(derived.id, expiresAt); return [derived.variant.toLowerCase(), `/files/${derived.id}/content?token=${encodeURIComponent(derivedToken)}`]; })); return { ...safe, accessUrl: `/files/${file.id}/content?token=${encodeURIComponent(token)}`, derivativeUrls, accessExpiresAt: new Date(expiresAt).toISOString() }; },
  async fileContent(id: string, token: string) { if (!fileStorageService.verifyAccessToken(id, token)) throw new HttpError(403, 'File link is invalid or expired'); const file = await formsRepository.findFile(id); if (!file) throw new HttpError(404, 'File not found'); if (file.storageKey?.startsWith('legacy/')) { const legacy = fileStorageService.decodeLegacyDataUrl(file.url); return { ...legacy, filename: file.originalFilename ?? file.name, checksum: file.checksum ?? file.id, cacheable: false }; } if (!file.storageKey) throw new HttpError(409, 'File has not been migrated to secure storage'); return { buffer: await fileStorageService.read(file.storageKey), mimeType: file.mimeType ?? 'application/octet-stream', filename: file.originalFilename ?? file.name, checksum: file.checksum ?? file.id, cacheable: file.variant !== 'ORIGINAL' && file.fileType !== 'IDENTITY_DOCUMENT' }; },
};
