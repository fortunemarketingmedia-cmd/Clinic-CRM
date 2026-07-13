import { Role } from '@prisma/client';
import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const userRoutes = Router();

userRoutes.use(requireAuth, requireRole(Role.ADMIN));

userRoutes.get('/', (req, res, next) => {
  userController.list(req, res).catch(next);
});

userRoutes.post('/', (req, res, next) => {
  userController.create(req, res).catch(next);
});

userRoutes.patch('/:id', (req, res, next) => {
  userController.update(req, res).catch(next);
});

userRoutes.delete('/:id', (req, res, next) => {
  userController.delete(req, res).catch(next);
});
