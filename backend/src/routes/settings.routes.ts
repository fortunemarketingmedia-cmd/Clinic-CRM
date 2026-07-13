import { Role } from '@prisma/client';
import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth, requireRole(Role.ADMIN));

settingsRoutes.get('/', (req, res, next) => {
  settingsController.get(req, res).catch(next);
});

settingsRoutes.patch('/', (req, res, next) => {
  settingsController.update(req, res).catch(next);
});
