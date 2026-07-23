import { Router, type NextFunction, type Request, type Response } from 'express';
import { reportController as c } from '../controllers/report.controller.js';
import { requireAuth } from '../middleware/auth.js';
export const reportRoutes = Router();
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
reportRoutes.use(requireAuth);
reportRoutes.get('/dashboard', handle(c.dashboard));
reportRoutes.get('/crm', handle(c.crm));
reportRoutes.get('/appointments', handle(c.appointments));
reportRoutes.get('/clinical', handle(c.clinical));
reportRoutes.get('/marketing', handle(c.marketing));
