import type { Request, Response } from 'express';
import { clinicalService } from '../services/clinical.service.js';
import { fileSchema, packageSchema, sessionSchema, updateSessionSchema } from '../validations/clinical.validation.js';
import { formsService } from '../services/forms.service.js';
import { HttpError } from '../utils/http-error.js';

function actor(req: Request) { if (!req.user) throw new HttpError(401, 'Authentication required'); return { id: req.user.id, role: req.user.role, userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId }; }

export const clinicalController = {
  async listSessions(req: Request, res: Response) {
    const sessions = await clinicalService.listSessions(req.params.id);
    return res.json({ data: sessions });
  },

  async createSession(req: Request, res: Response) {
    const input = sessionSchema.parse(req.body);
    const session = await clinicalService.createSession(req.params.id, input);
    return res.status(201).json({ data: session });
  },

  async updateSession(req: Request, res: Response) {
    const input = updateSessionSchema.parse(req.body);
    const session = await clinicalService.updateSession(req.params.id, req.params.sessionId, input);
    return res.json({ data: session });
  },

  async deleteSession(req: Request, res: Response) {
    await clinicalService.deleteSession(req.params.id, req.params.sessionId);
    return res.status(204).send();
  },

  async listPackages(req: Request, res: Response) {
    const packages = await clinicalService.listPackages(req.params.id);
    return res.json({ data: packages });
  },

  async createPackage(req: Request, res: Response) {
    const input = packageSchema.parse(req.body);
    const treatmentPackage = await clinicalService.createPackage(req.params.id, input);
    return res.status(201).json({ data: treatmentPackage });
  },

  async listFiles(req: Request, res: Response) {
    const files = await formsService.listFiles({ patientId: req.params.id }, actor(req));
    return res.json({ data: files });
  },

  async createFile(req: Request, res: Response) {
    const input = fileSchema.parse(req.body);
    const inferredMime = input.url.startsWith('data:image/png') ? 'image/png' : input.url.startsWith('data:image/webp') ? 'image/webp' : input.url.startsWith('data:image/') ? 'image/jpeg' : 'application/pdf';
    const mimeType = (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const).find((value) => value === input.mimeType) ?? inferredMime;
    const fileType = input.category === 'IMAGE' ? 'CLINICAL_PHOTOGRAPH' : input.category === 'PRESCRIPTION' ? 'PRESCRIPTION' : input.category === 'REPORT' ? 'MEDICAL_REPORT' : input.category === 'INVOICE' ? 'INVOICE' : 'OTHER_DOCUMENT';
    const file = await formsService.uploadFile({ patientId: req.params.id, sessionId: input.sessionId, invoiceId: input.invoiceId, encounterId: undefined, procedureSessionId: undefined, appointmentId: undefined, fileType, originalFilename: input.name, mimeType, contentBase64: input.url, clinicalUsePermission: input.category !== 'INVOICE', marketingPermission: false, visibility: input.category === 'INVOICE' ? 'ADMINISTRATIVE' : 'CARE_TEAM' }, actor(req));
    return res.status(201).json({ data: file });
  },
};
