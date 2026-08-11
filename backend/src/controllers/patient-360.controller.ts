import type { Request, Response } from 'express';
import { patient360Service } from '../services/patient-360.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  addendumSchema,
  clinicalListQuerySchema,
  encounterSchema,
  encounterUpdateSchema,
  medicineQuerySchema,
  prescriptionSchema,
  procedureSessionSchema,
  treatmentPlanSchema,
  treatmentPlanUpdateSchema,
} from '../validations/patient-360.validation.js';

function actor(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return { id: req.user.id, role: req.user.role, userId: req.user.id, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId };
}

export const patient360Controller = {
  async getPatient360(req: Request, res: Response) { return res.json({ data: await patient360Service.getPatient360(req.params.patientId, actor(req)) }); },
  async listEncounters(req: Request, res: Response) { return res.json({ data: await patient360Service.listEncounters(req.params.patientId, actor(req)) }); },
  async createEncounter(req: Request, res: Response) { return res.status(201).json({ data: await patient360Service.createEncounter(req.params.patientId, encounterSchema.parse(req.body), actor(req)) }); },
  async updateEncounter(req: Request, res: Response) { return res.json({ data: await patient360Service.updateEncounter(req.params.id, encounterUpdateSchema.parse(req.body), actor(req)) }); },
  async signEncounter(req: Request, res: Response) { return res.json({ data: await patient360Service.signEncounter(req.params.id, actor(req)) }); },
  async addAddendum(req: Request, res: Response) { const input = addendumSchema.parse(req.body); return res.status(201).json({ data: await patient360Service.addAddendum(req.params.id, input.content, actor(req)) }); },
  async listTreatmentPlans(req: Request, res: Response) { return res.json({ data: await patient360Service.listTreatmentPlans(req.params.patientId, actor(req)) }); },
  async createTreatmentPlan(req: Request, res: Response) { return res.status(201).json({ data: await patient360Service.createTreatmentPlan(req.params.patientId, treatmentPlanSchema.parse(req.body), actor(req)) }); },
  async updateTreatmentPlan(req: Request, res: Response) { return res.json({ data: await patient360Service.updateTreatmentPlan(req.params.id, treatmentPlanUpdateSchema.parse(req.body), actor(req)) }); },
  async listProcedureSessions(req: Request, res: Response) { return res.json({ data: await patient360Service.listProcedureSessions(req.params.patientId, actor(req)) }); },
  async createProcedureSession(req: Request, res: Response) { return res.status(201).json({ data: await patient360Service.createProcedureSession(req.params.patientId, procedureSessionSchema.parse(req.body), actor(req)) }); },
  async listPrescriptions(req: Request, res: Response) { return res.json({ data: await patient360Service.listPrescriptions(req.params.patientId, actor(req)) }); },
  async createPrescription(req: Request, res: Response) { return res.status(201).json({ data: await patient360Service.createPrescription(req.params.patientId, prescriptionSchema.parse(req.body), actor(req)) }); },
  async signPrescription(req: Request, res: Response) { return res.json({ data: await patient360Service.signPrescription(req.params.id, actor(req)) }); },
  async prescriptionPdf(req: Request, res: Response) { const buffer = await patient360Service.getPrescriptionPdf(req.params.id, actor(req)); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="prescription-${req.params.id}.pdf"`); return res.send(buffer); },
  async listMedicines(req: Request, res: Response) { const query = medicineQuerySchema.parse(req.query); return res.json({ data: await patient360Service.listMedicines(query.search) }); },
  async listTemplates(req: Request, res: Response) { const query = clinicalListQuerySchema.pick({ branchId: true }).parse(req.query); return res.json({ data: await patient360Service.listTemplates(query.branchId) }); },
};
