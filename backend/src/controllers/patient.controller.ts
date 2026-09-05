import type { Request, Response } from 'express';
import { patientService } from '../services/patient.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  convertLeadSchema,
  medicalProfileSchema,
  patientQuerySchema,
  importPatientsSchema,
  updatePatientSchema,
} from '../validations/patient.validation.js';
import { qrRegistrationSchema } from '../validations/qr.validation.js';
import { auditService } from '../services/audit.service.js';
import { accessService } from '../services/access.service.js';
import { leadService } from '../services/lead.service.js';

export const patientController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = patientQuerySchema.parse(req.query);
    await accessService.assertBranchAccess(req.user.id, req.user.role, query.branchId);
    const patients = await patientService.listPatients({ ...query, role: req.user.role });
    return res.json({ data: patients.items, meta: { total: patients.total, page: patients.page, pageSize: patients.pageSize, totalPages: Math.ceil(patients.total / patients.pageSize) } });
  },

  async get(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const patient = await patientService.getPatient(req.params.id, req.user.role);
    await accessService.assertBranchAccess(req.user.id, req.user.role, patient.branchId);
    return res.json({ data: patient });
  },

  async timeline(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const patient = await patientService.getPatient(req.params.id, req.user.role);
    await accessService.assertBranchAccess(req.user.id, req.user.role, patient.branchId);
    const timeline = await patientService.getPatientTimeline(req.params.id);
    return res.json({ data: timeline });
  },

  async convertLead(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const input = convertLeadSchema.parse(req.body);
    await leadService.getLead(input.leadId, req.user);
    const patient = await patientService.convertLead(input);
    return res.status(201).json({ data: patient });
  },

  async import(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const input = importPatientsSchema.parse(req.body);
    await accessService.assertBranchAccess(req.user.id, req.user.role, input.branchId);
    const result = await patientService.importPatients(input);
    await auditService.record(
      { userId: req.user.id, branchId: input.branchId, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId },
      { action: 'PATIENT_DATA_IMPORTED', entity: 'Patient', newValue: { received: input.rows.length, imported: result.imported, skipped: result.skipped } },
    );
    return res.status(201).json({ data: result });
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const existing = await patientService.getPatient(req.params.id, req.user.role);
    await accessService.assertBranchAccess(req.user.id, req.user.role, existing.branchId);
    const input = updatePatientSchema.parse(req.body);
    const patient = await patientService.updatePatient(req.params.id, input);
    return res.json({ data: patient });
  },

  async upsertMedicalProfile(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const existing = await patientService.getPatient(req.params.id, req.user.role);
    await accessService.assertBranchAccess(req.user.id, req.user.role, existing.branchId);
    const input = medicalProfileSchema.parse(req.body);
    const profile = await patientService.upsertMedicalProfile(req.params.id, input, req.user.id);
    await auditService.record({ userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId }, { action: 'MEDICAL_PROFILE_UPDATED', entity: 'Patient', entityId: req.params.id });
    return res.json({ data: profile });
  },

  async getQrRegistration(req: Request, res: Response) {
    const registration = await patientService.getQrRegistration(req.params.token);
    return res.json({ data: registration });
  },

  async submitQrRegistration(req: Request, res: Response) {
    const input = qrRegistrationSchema.parse(req.body);
    const patient = await patientService.submitQrRegistration(req.params.token, input, { ipAddress: req.ip, deviceMetadata: req.header('user-agent') });
    return res.json({ data: patient });
  },
};
