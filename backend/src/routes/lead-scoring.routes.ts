import { Role } from '@prisma/client';
import { Router } from 'express';
import { leadScoringController } from '../controllers/lead-scoring.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
export const leadScoringRoutes = Router();
leadScoringRoutes.use(
  requireAuth,
  requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN),
);
leadScoringRoutes.get('/', (req, res, next) => leadScoringController.list(req, res).catch(next));
leadScoringRoutes.post('/', (req, res, next) => leadScoringController.create(req, res).catch(next));
leadScoringRoutes.post('/recalculate-all', (req, res, next) =>
  leadScoringController.recalculateAll(req, res).catch(next),
);
leadScoringRoutes.patch('/:id', (req, res, next) =>
  leadScoringController.update(req, res).catch(next),
);
