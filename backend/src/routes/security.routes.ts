import { Router, type NextFunction, type Request, type Response } from 'express';
import { securityController as c } from '../controllers/security.controller.js';
import { requireAuth } from '../middleware/auth.js';
export const securityRoutes = Router();
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
securityRoutes.use(requireAuth);
securityRoutes.post('/mfa/setup', handle(c.beginMfa));
securityRoutes.post('/mfa/confirm', handle(c.confirmMfa));
securityRoutes.post('/mfa/disable', handle(c.disableMfa));
securityRoutes.get('/sessions', handle(c.sessions));
securityRoutes.delete('/sessions/:id', handle(c.revokeSession));
securityRoutes.get('/login-events', handle(c.loginEvents));
securityRoutes.get('/exports', handle(c.exports));
securityRoutes.post('/exports', handle(c.logExport));
securityRoutes.get('/governance', handle(c.governance));
securityRoutes.get('/health', handle(c.health));
securityRoutes.get('/backups', handle(c.backups));
securityRoutes.post('/backups', handle(c.recordBackup));
