import { Role } from '@prisma/client';
import { Router } from 'express';
import { patient360Controller } from '../controllers/patient-360.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const clinicalRoles = [Role.ADMIN, Role.RECEPTIONIST] as const;
const prescribingRoles = [Role.ADMIN, Role.RECEPTIONIST] as const;

export const patient360Routes = Router();
patient360Routes.use(requireAuth);

patient360Routes.get('/medicines', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.listMedicines(req, res).catch(next); });
patient360Routes.get('/templates', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.listTemplates(req, res).catch(next); });
patient360Routes.get('/patients/:patientId/360', (req, res, next) => { patient360Controller.getPatient360(req, res).catch(next); });
patient360Routes.get('/patients/:patientId/encounters', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.listEncounters(req, res).catch(next); });
patient360Routes.post('/patients/:patientId/encounters', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.createEncounter(req, res).catch(next); });
patient360Routes.patch('/encounters/:id', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.updateEncounter(req, res).catch(next); });
patient360Routes.post('/encounters/:id/sign', requireRole(...prescribingRoles), (req, res, next) => { patient360Controller.signEncounter(req, res).catch(next); });
patient360Routes.post('/encounters/:id/addendums', requireRole(...prescribingRoles), (req, res, next) => { patient360Controller.addAddendum(req, res).catch(next); });
patient360Routes.get('/patients/:patientId/treatment-plans', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.listTreatmentPlans(req, res).catch(next); });
patient360Routes.post('/patients/:patientId/treatment-plans', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.createTreatmentPlan(req, res).catch(next); });
patient360Routes.patch('/treatment-plans/:id', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.updateTreatmentPlan(req, res).catch(next); });
patient360Routes.get('/patients/:patientId/procedure-sessions', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.listProcedureSessions(req, res).catch(next); });
patient360Routes.post('/patients/:patientId/procedure-sessions', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.createProcedureSession(req, res).catch(next); });
patient360Routes.get('/patients/:patientId/prescriptions', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.listPrescriptions(req, res).catch(next); });
patient360Routes.post('/patients/:patientId/prescriptions', requireRole(...prescribingRoles), (req, res, next) => { patient360Controller.createPrescription(req, res).catch(next); });
patient360Routes.post('/prescriptions/:id/sign', requireRole(...prescribingRoles), (req, res, next) => { patient360Controller.signPrescription(req, res).catch(next); });
patient360Routes.get('/prescriptions/:id/pdf', requireRole(...clinicalRoles), (req, res, next) => { patient360Controller.prescriptionPdf(req, res).catch(next); });
