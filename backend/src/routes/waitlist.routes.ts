import { Router } from 'express';
import { waitlistController } from '../controllers/waitlist.controller.js';
import { requireAuth } from '../middleware/auth.js';
export const waitlistRoutes = Router(); waitlistRoutes.use(requireAuth);
waitlistRoutes.get('/', (req, res, next) => waitlistController.list(req, res).catch(next));
waitlistRoutes.post('/', (req, res, next) => waitlistController.create(req, res).catch(next));
waitlistRoutes.patch('/:id', (req, res, next) => waitlistController.update(req, res).catch(next));
waitlistRoutes.post('/:id/book', (req, res, next) => waitlistController.book(req, res).catch(next));

