import { Router } from 'express';
import { Role } from '@prisma/client';
import { analyticsController } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const analyticsRoutes = Router();

analyticsRoutes.use(requireAuth, requireRole(Role.ADMIN));

analyticsRoutes.get('/', (req, res, next) => {
  analyticsController.overview(req, res).catch(next);
});

analyticsRoutes.get('/finance/export', (req, res, next) => {
  analyticsController.exportFinance(req, res).catch(next);
});

analyticsRoutes.post('/finance/export/email', (req, res, next) => {
  analyticsController.emailFinance(req, res).catch(next);
});

analyticsRoutes.get('/finance/export/recipients', (req, res, next) => {
  analyticsController.financeRecipients(req, res).catch(next);
});
