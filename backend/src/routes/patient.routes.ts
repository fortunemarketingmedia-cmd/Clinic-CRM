import { Router } from 'express';
import { clinicalController } from '../controllers/clinical.controller.js';
import { patientController } from '../controllers/patient.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const patientRoutes = Router();

patientRoutes.use(requireAuth);

patientRoutes.get('/', (req, res, next) => {
  patientController.list(req, res).catch(next);
});

patientRoutes.post('/', (req, res, next) => {
  patientController.create(req, res).catch(next);
});

patientRoutes.post('/convert', (req, res, next) => {
  patientController.convertLead(req, res).catch(next);
});

patientRoutes.get('/:id', (req, res, next) => {
  patientController.get(req, res).catch(next);
});

patientRoutes.get('/:id/timeline', (req, res, next) => {
  patientController.timeline(req, res).catch(next);
});

patientRoutes.patch('/:id', (req, res, next) => {
  patientController.update(req, res).catch(next);
});

patientRoutes.put('/:id/medical-profile', (req, res, next) => {
  patientController.upsertMedicalProfile(req, res).catch(next);
});

patientRoutes.get('/:id/sessions', (req, res, next) => {
  clinicalController.listSessions(req, res).catch(next);
});

patientRoutes.post('/:id/sessions', (req, res, next) => {
  clinicalController.createSession(req, res).catch(next);
});

patientRoutes.get('/:id/packages', (req, res, next) => {
  clinicalController.listPackages(req, res).catch(next);
});

patientRoutes.post('/:id/packages', (req, res, next) => {
  clinicalController.createPackage(req, res).catch(next);
});

patientRoutes.get('/:id/files', (req, res, next) => {
  clinicalController.listFiles(req, res).catch(next);
});

patientRoutes.post('/:id/files', (req, res, next) => {
  clinicalController.createFile(req, res).catch(next);
});
