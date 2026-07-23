import { Role } from '@prisma/client';
import { Router } from 'express';
import { personController } from '../controllers/person.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const personRoutes = Router();
personRoutes.use(requireAuth);
personRoutes.get('/', (req, res, next) => personController.list(req, res).catch(next));
personRoutes.get('/duplicates/search', (req, res, next) => personController.duplicates(req, res).catch(next));
personRoutes.post('/', (req, res, next) => personController.create(req, res).catch(next));
personRoutes.get('/:id', (req, res, next) => personController.get(req, res).catch(next));
personRoutes.post('/:id/merge', requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN), (req, res, next) => personController.merge(req, res).catch(next));

