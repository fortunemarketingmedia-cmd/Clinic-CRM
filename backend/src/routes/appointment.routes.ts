import { Router } from 'express';
import { appointmentController } from '../controllers/appointment.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const appointmentRoutes = Router();

appointmentRoutes.use(requireAuth);

appointmentRoutes.get('/', (req, res, next) => {
  appointmentController.list(req, res).catch(next);
});

appointmentRoutes.post('/', (req, res, next) => {
  appointmentController.create(req, res).catch(next);
});

appointmentRoutes.get('/:id', (req, res, next) => {
  appointmentController.get(req, res).catch(next);
});

appointmentRoutes.patch('/:id', (req, res, next) => {
  appointmentController.update(req, res).catch(next);
});

appointmentRoutes.post('/:id/cancel', (req, res, next) => {
  appointmentController.cancel(req, res).catch(next);
});

appointmentRoutes.delete('/:id', (req, res, next) => {
  appointmentController.delete(req, res).catch(next);
});
