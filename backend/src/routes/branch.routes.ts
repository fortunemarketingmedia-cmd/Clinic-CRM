import { Router } from 'express';
import { branchController } from '../controllers/branch.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { Role } from '@prisma/client';

export const branchRoutes = Router();

branchRoutes.use(requireAuth);

branchRoutes.get('/', (req, res, next) => {
  branchController.list(req, res).catch(next);
});

branchRoutes.patch('/:id', requireRole(Role.ADMIN), (req, res, next) => {
  branchController.update(req, res).catch(next);
});
