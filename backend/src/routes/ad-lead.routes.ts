import { Router } from 'express';
import { adLeadController } from '../controllers/ad-lead.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const adLeadRoutes = Router();

adLeadRoutes.use(requireAuth);

adLeadRoutes.get('/', (req, res, next) => {
  adLeadController.list(req, res).catch(next);
});

adLeadRoutes.post('/:id/convert', (req, res, next) => {
  adLeadController.convert(req, res).catch(next);
});
