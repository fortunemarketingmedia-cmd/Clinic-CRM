import { Router } from 'express';
import { formsController } from '../controllers/forms.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const formRoutes = Router();
formRoutes.use(requireAuth);
formRoutes.get('/templates', (req, res, next) => { formsController.listFormTemplates(req, res).catch(next); });
formRoutes.post('/templates', (req, res, next) => { formsController.createFormTemplate(req, res).catch(next); });
formRoutes.patch('/templates/:id', (req, res, next) => { formsController.updateFormTemplate(req, res).catch(next); });
formRoutes.post('/submissions', (req, res, next) => { formsController.submitForm(req, res).catch(next); });
formRoutes.get('/patients/:patientId/submissions', (req, res, next) => { formsController.listSubmissions(req, res).catch(next); });

export const consentRoutes = Router();
consentRoutes.use(requireAuth);
consentRoutes.get('/templates', (req, res, next) => { formsController.listConsentTemplates(req, res).catch(next); });
consentRoutes.post('/templates', (req, res, next) => { formsController.createConsentTemplate(req, res).catch(next); });
consentRoutes.patch('/templates/:id', (req, res, next) => { formsController.updateConsentTemplate(req, res).catch(next); });
consentRoutes.post('/sign', (req, res, next) => { formsController.signConsent(req, res).catch(next); });
consentRoutes.get('/patients/:patientId', (req, res, next) => { formsController.listConsentRecords(req, res).catch(next); });
consentRoutes.post('/:id/withdraw', (req, res, next) => { formsController.withdrawConsent(req, res).catch(next); });
consentRoutes.get('/:id/pdf', (req, res, next) => { formsController.consentPdf(req, res).catch(next); });

export const fileRoutes = Router();
fileRoutes.get('/:id/content', (req, res, next) => { formsController.fileContent(req, res).catch(next); });
fileRoutes.use(requireAuth);
fileRoutes.get('/', (req, res, next) => { formsController.listFiles(req, res).catch(next); });
fileRoutes.post('/', (req, res, next) => { formsController.uploadFile(req, res).catch(next); });
