import { Role } from '@prisma/client';
import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const auditRoutes = Router();
auditRoutes.use(requireAuth, requireRole(Role.ADMIN, Role.ORGANISATION_OWNER, Role.CLINIC_ADMIN, Role.AUDITOR));
auditRoutes.get('/', (req, res, next) => auditController.list(req, res).catch(next));

