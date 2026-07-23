import { Router } from 'express';
import { taskController } from '../controllers/task.controller.js';
import { requireAuth } from '../middleware/auth.js';
export const taskRoutes = Router();
taskRoutes.use(requireAuth);
taskRoutes.get('/', (req, res, next) => taskController.list(req, res).catch(next));
taskRoutes.post('/', (req, res, next) => taskController.create(req, res).catch(next));
taskRoutes.patch('/:id', (req, res, next) => taskController.update(req, res).catch(next));

