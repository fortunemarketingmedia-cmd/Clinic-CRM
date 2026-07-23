import { Router } from 'express';
import { leadController } from '../controllers/lead.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const leadRoutes = Router();

leadRoutes.use(requireAuth);

leadRoutes.get('/', (req, res, next) => {
  leadController.list(req, res).catch(next);
});

leadRoutes.post('/', (req, res, next) => {
  leadController.create(req, res).catch(next);
});

leadRoutes.get('/duplicates/search', (req, res, next) => {
  leadController.duplicates(req, res).catch(next);
});

leadRoutes.get('/:id', (req, res, next) => {
  leadController.get(req, res).catch(next);
});

leadRoutes.get('/:id/timeline', (req, res, next) => {
  leadController.timeline(req, res).catch(next);
});

leadRoutes.get('/:id/score-history', (req, res, next) => {
  leadController.scoreHistory(req, res).catch(next);
});

leadRoutes.post('/:id/recalculate-score', (req, res, next) => {
  leadController.recalculateScore(req, res).catch(next);
});

leadRoutes.patch('/:id', (req, res, next) => {
  leadController.update(req, res).catch(next);
});

leadRoutes.delete('/:id', (req, res, next) => {
  leadController.delete(req, res).catch(next);
});
