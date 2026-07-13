import { Role } from '@prisma/client';
import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const whatsappRoutes = Router();

whatsappRoutes.use(requireAuth);

whatsappRoutes.get('/', requireRole(Role.ADMIN), (req, res, next) => {
  whatsappController.list(req, res).catch(next);
});

whatsappRoutes.post('/', (req, res, next) => {
  whatsappController.create(req, res).catch(next);
});

whatsappRoutes.post('/broadcast', requireRole(Role.ADMIN), (req, res, next) => {
  whatsappController.broadcast(req, res).catch(next);
});
