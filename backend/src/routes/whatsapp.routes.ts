import { Role } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { whatsappController as c } from '../controllers/whatsapp.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

export const whatsappRoutes = Router();
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

whatsappRoutes.get('/webhook', handle(c.verifyWebhook));
whatsappRoutes.post('/webhook', handle(c.receiveWebhook));
whatsappRoutes.use(requireAuth);

whatsappRoutes.get('/accounts', requireRole(Role.DEVELOPER), handle(c.listAccounts));
whatsappRoutes.post('/accounts', requireRole(Role.DEVELOPER), handle(c.setupAccount));
whatsappRoutes.post('/accounts/:id/test', requireRole(Role.DEVELOPER), handle(c.testAccount));
whatsappRoutes.post('/accounts/:id/disconnect', requireRole(Role.DEVELOPER), handle(c.disconnectAccount));
whatsappRoutes.get('/phone-numbers', handle(c.phoneNumbers));
whatsappRoutes.get('/templates', handle(c.templates));
whatsappRoutes.post('/templates', requireRole(Role.ADMIN, Role.RECEPTIONIST), handle(c.createTemplate));
whatsappRoutes.patch('/templates/:id', requireRole(Role.ADMIN, Role.RECEPTIONIST), handle(c.updateTemplate));
whatsappRoutes.post('/templates/sync/:accountId', requireRole(Role.DEVELOPER), handle(c.syncTemplates));
whatsappRoutes.get('/conversations', handle(c.conversations));
whatsappRoutes.post('/conversations', handle(c.startConversation));
whatsappRoutes.get('/conversations/:id', handle(c.conversation));
whatsappRoutes.patch('/conversations/:id', handle(c.updateConversation));
whatsappRoutes.post('/conversations/:id/messages', handle(c.sendMessage));
whatsappRoutes.post('/conversations/:id/internal-notes', handle(c.internalNote));
whatsappRoutes.get('/consents', handle(c.consents));
whatsappRoutes.post('/consents', handle(c.recordConsent));
whatsappRoutes.get('/automations', handle(c.automations));
whatsappRoutes.post('/automations', requireRole(Role.ADMIN, Role.RECEPTIONIST), handle(c.saveAutomation));
whatsappRoutes.get('/broadcasts', handle(c.broadcasts));
whatsappRoutes.post('/broadcasts', handle(c.createBroadcast));
whatsappRoutes.post('/broadcasts/:id/action', handle(c.broadcastAction));
whatsappRoutes.get('/webhook-events', requireRole(Role.DEVELOPER), handle(c.webhookEvents));
whatsappRoutes.get('/jobs', requireRole(Role.DEVELOPER), handle(c.jobs));
whatsappRoutes.post('/jobs/process', requireRole(Role.DEVELOPER), handle(c.processJobs));
whatsappRoutes.get('/failures', requireRole(Role.DEVELOPER), handle(c.failures));
whatsappRoutes.get('/logs', requireRole(Role.DEVELOPER), handle(c.legacyLogs));

// Backward-compatible send endpoint; it now queues an official Cloud API message.
whatsappRoutes.post('/', handle(c.sendMessage));
