import { Router } from 'express';
import { adLeadController } from '../controllers/ad-lead.controller.js';
import { patientController } from '../controllers/patient.controller.js';
import { leadController } from '../controllers/lead.controller.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { requireSharedSecret } from '../middleware/shared-secret.js';
import { env } from '../config/env.js';

export const publicRoutes = Router();

publicRoutes.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

publicRoutes.get('/qr/:token', (req, res, next) => {
  patientController.getQrRegistration(req, res).catch(next);
});

publicRoutes.post('/qr/:token', (req, res, next) => {
  patientController.submitQrRegistration(req, res).catch(next);
});

publicRoutes.post('/ads/google', requireSharedSecret(env.GOOGLE_ADS_INGEST_SECRET), (req, res, next) => {
  adLeadController.createPublic({ ...req.body, platform: 'GOOGLE', rawPayload: req.body }, res).catch(next);
});

publicRoutes.post('/ads/meta', requireSharedSecret(env.META_ADS_INGEST_SECRET), (req, res, next) => {
  adLeadController.createPublic({ ...req.body, platform: 'META', rawPayload: req.body }, res).catch(next);
});

publicRoutes.post('/website-leads', rateLimit({ windowMs: 60 * 1000, max: 12, keyPrefix: 'website-leads' }), (req, res, next) => {
  leadController.createWebsiteLead(req, res).catch(next);
});
