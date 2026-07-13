import type { Request, Response } from 'express';
import { patientService } from '../services/patient.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  convertLeadSchema,
  createPatientSchema,
  medicalProfileSchema,
  patientQuerySchema,
  updatePatientSchema,
} from '../validations/patient.validation.js';
import { qrRegistrationSchema } from '../validations/qr.validation.js';

export const patientController = {
  async list(req: Request, res: Response) {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    const query = patientQuerySchema.parse(req.query);
    const patients = await patientService.listPatients({ ...query, role: req.user.role });
    return res.json({ data: patients });
  },

  async get(req: Request, res: Response) {
    const patient = await patientService.getPatient(req.params.id);
    return res.json({ data: patient });
  },

  async timeline(req: Request, res: Response) {
    const timeline = await patientService.getPatientTimeline(req.params.id);
    return res.json({ data: timeline });
  },

  async convertLead(req: Request, res: Response) {
    const input = convertLeadSchema.parse(req.body);
    const patient = await patientService.convertLead(input);
    return res.status(201).json({ data: patient });
  },

  async create(req: Request, res: Response) {
    const input = createPatientSchema.parse(req.body);
    const patient = await patientService.createPatient(input);
    return res.status(201).json({ data: patient });
  },

  async update(req: Request, res: Response) {
    const input = updatePatientSchema.parse(req.body);
    const patient = await patientService.updatePatient(req.params.id, input);
    return res.json({ data: patient });
  },

  async upsertMedicalProfile(req: Request, res: Response) {
    const input = medicalProfileSchema.parse(req.body);
    const profile = await patientService.upsertMedicalProfile(req.params.id, input);
    return res.json({ data: profile });
  },

  async getQrRegistration(req: Request, res: Response) {
    const registration = await patientService.getQrRegistration(req.params.token);
    return res.json({ data: registration });
  },

  async submitQrRegistration(req: Request, res: Response) {
    const input = qrRegistrationSchema.parse(req.body);
    const patient = await patientService.submitQrRegistration(req.params.token, input);
    return res.json({ data: patient });
  },
};
