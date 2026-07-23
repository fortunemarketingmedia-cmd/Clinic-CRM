import { Router } from 'express';
import { followUpController } from '../controllers/follow-up.controller.js';
import { requireAuth } from '../middleware/auth.js';
export const followUpRoutes = Router();
followUpRoutes.use(requireAuth);
followUpRoutes.get('/', (req, res, next) => followUpController.list(req, res).catch(next));
followUpRoutes.post('/', (req, res, next) => followUpController.create(req, res).catch(next));
followUpRoutes.post('/:id/complete', (req, res, next) => followUpController.complete(req, res).catch(next));

