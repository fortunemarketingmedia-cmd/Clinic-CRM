import { Router, type NextFunction, type Request, type Response } from 'express';
import { automationController as c } from '../controllers/automation.controller.js';
import { requireAuth } from '../middleware/auth.js';
export const automationRoutes = Router();
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
automationRoutes.use(requireAuth);
automationRoutes.get('/', handle(c.list));
automationRoutes.get('/executions', handle(c.executions));
automationRoutes.get('/:id', handle(c.get));
automationRoutes.post('/', handle(c.create));
automationRoutes.patch('/:id', handle(c.update));
automationRoutes.post('/:id/test', handle(c.test));
