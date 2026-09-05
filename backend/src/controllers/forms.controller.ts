import type { Request, Response } from 'express';
import { formsService } from '../services/forms.service.js';
import { HttpError } from '../utils/http-error.js';
import { consentSignSchema, consentTemplateSchema, consentTemplateUpdateSchema, consentWithdrawalSchema, fileAccessTokenSchema, fileQuerySchema, formSubmissionSchema, formTemplateQuerySchema, formTemplateSchema, formTemplateUpdateSchema, secureFileMetadataSchema, secureFileSchema } from '../validations/forms.validation.js';

function actor(req: Request) { if (!req.user) throw new HttpError(401, 'Authentication required'); return { id: req.user.id, role: req.user.role, userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId }; }

export const formsController = {
  async listFormTemplates(req: Request, res: Response) { return res.json({ data: await formsService.listFormTemplates(formTemplateQuerySchema.parse(req.query), actor(req)) }); },
  async createFormTemplate(req: Request, res: Response) { return res.status(201).json({ data: await formsService.createFormTemplate(formTemplateSchema.parse(req.body), actor(req)) }); },
  async updateFormTemplate(req: Request, res: Response) { return res.json({ data: await formsService.updateFormTemplate(req.params.id, formTemplateUpdateSchema.parse(req.body), actor(req)) }); },
  async submitForm(req: Request, res: Response) { return res.status(201).json({ data: await formsService.submitForm(formSubmissionSchema.parse(req.body), actor(req)) }); },
  async listSubmissions(req: Request, res: Response) { return res.json({ data: await formsService.listSubmissions(req.params.patientId, actor(req)) }); },
  async listConsentTemplates(req: Request, res: Response) { const query = formTemplateQuerySchema.pick({ branchId: true }).parse(req.query); return res.json({ data: await formsService.listConsentTemplates(query.branchId, actor(req)) }); },
  async createConsentTemplate(req: Request, res: Response) { return res.status(201).json({ data: await formsService.createConsentTemplate(consentTemplateSchema.parse(req.body), actor(req)) }); },
  async updateConsentTemplate(req: Request, res: Response) { return res.json({ data: await formsService.updateConsentTemplate(req.params.id, consentTemplateUpdateSchema.parse(req.body), actor(req)) }); },
  async signConsent(req: Request, res: Response) { return res.status(201).json({ data: await formsService.signConsent(consentSignSchema.parse(req.body), actor(req)) }); },
  async listConsentRecords(req: Request, res: Response) { return res.json({ data: await formsService.listConsentRecords(req.params.patientId, actor(req)) }); },
  async withdrawConsent(req: Request, res: Response) { const input = consentWithdrawalSchema.parse(req.body); return res.json({ data: await formsService.withdrawConsent(req.params.id, input.reason, actor(req)) }); },
  async consentPdf(req: Request, res: Response) { const buffer = await formsService.consentPdf(req.params.id, actor(req)); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="consent-${req.params.id}.pdf"`); return res.send(buffer); },
  async uploadFile(req: Request, res: Response) {
    if (req.file) {
      let metadata: unknown;
      try { metadata = JSON.parse(String(req.body.metadata ?? '{}')); }
      catch { throw new HttpError(400, 'Upload metadata must be valid JSON'); }
      const input = secureFileMetadataSchema.parse(metadata);
      if (req.file.mimetype !== input.mimeType) throw new HttpError(400, 'Uploaded file type does not match its metadata');
      return res.status(201).json({ data: await formsService.uploadFile(input, actor(req), req.file.buffer) });
    }
    return res.status(201).json({ data: await formsService.uploadFile(secureFileSchema.parse(req.body), actor(req)) });
  },
  async listFiles(req: Request, res: Response) { return res.json({ data: await formsService.listFiles(fileQuerySchema.parse(req.query), actor(req)) }); },
  async fileContent(req: Request, res: Response) { const query = fileAccessTokenSchema.parse(req.query); const file = await formsService.fileContent(req.params.id, query.token); res.setHeader('Content-Type', file.mimeType); res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/[\r\n"]/g, '_')}"`); res.setHeader('ETag', `"${file.checksum}"`); res.setHeader('Cache-Control', file.cacheable ? 'private, max-age=300, immutable' : 'private, no-store'); if (req.header('if-none-match') === `"${file.checksum}"`) return res.status(304).end(); return res.send(file.buffer); },
};
