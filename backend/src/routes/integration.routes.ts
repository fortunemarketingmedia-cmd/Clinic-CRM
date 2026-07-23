import { Router, type NextFunction, type Request, type Response } from 'express';
import { integrationController as c } from '../controllers/integration.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const integrationRoutes = Router();
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

integrationRoutes.get('/webhooks/:id', handle(c.verifyWebhook));
integrationRoutes.post('/webhooks/:id', handle(c.webhook));
integrationRoutes.get('/google/oauth/callback', handle(c.googleOAuthCallback));
integrationRoutes.use(requireAuth);
integrationRoutes.get('/connections', handle(c.connections));
integrationRoutes.post('/connections', handle(c.createConnection));
integrationRoutes.patch('/connections/:id', handle(c.updateConnection));
integrationRoutes.post('/connections/:id/test', handle(c.testConnection));
integrationRoutes.post('/connections/:id/disconnect', handle(c.disconnect));
integrationRoutes.get('/connections/:id/google-oauth-url', handle(c.googleOAuthUrl));
integrationRoutes.get('/mappings', handle(c.mappings));
integrationRoutes.post('/mappings', handle(c.saveMapping));
integrationRoutes.get('/events', handle(c.events));
integrationRoutes.get('/sync-runs', handle(c.syncRuns));
integrationRoutes.post('/connections/:id/sync', handle(c.sync));
integrationRoutes.get('/campaigns', handle(c.campaigns));
integrationRoutes.post('/campaigns', handle(c.createCampaign));
integrationRoutes.get('/conversions', handle(c.conversions));
integrationRoutes.post('/conversions', handle(c.createConversion));
