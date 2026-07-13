import { Router } from 'express';
import { adLeadController } from '../controllers/ad-lead.controller.js';
import { patientController } from '../controllers/patient.controller.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const publicRoutes = Router();

publicRoutes.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

publicRoutes.get('/qr/:token', (req, res, next) => {
  patientController.getQrRegistration(req, res).catch(next);
});

publicRoutes.post('/qr/:token', (req, res, next) => {
  patientController.submitQrRegistration(req, res).catch(next);
});

publicRoutes.post('/ads/google', (req, res, next) => {
  adLeadController.createPublic({ ...req.body, platform: 'GOOGLE', rawPayload: req.body }, res).catch(next);
});

publicRoutes.post('/ads/meta', (req, res, next) => {
  adLeadController.createPublic({ ...req.body, platform: 'META', rawPayload: req.body }, res).catch(next);
});
