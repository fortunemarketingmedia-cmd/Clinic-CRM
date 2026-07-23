import type { Request, Response } from 'express';
import { whatsappJobService } from '../services/whatsapp-job.service.js';
import { whatsappService } from '../services/whatsapp.service.js';
import { whatsappWebhookService } from '../services/whatsapp-webhook.service.js';
import { HttpError } from '../utils/http-error.js';
import { automationSchema, broadcastActionSchema, broadcastSchema, consentSchema, conversationStartSchema, conversationUpdateSchema, internalNoteSchema, processJobsSchema, templateSchema, templateUpdateSchema, whatsappAccountSchema, whatsappMessageSchema, whatsappQuerySchema } from '../validations/whatsapp.validation.js';

function actor(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return { id: req.user.id, role: req.user.role, ipAddress: req.ip, device: req.header('user-agent'), correlationId: req.correlationId };
}

export const whatsappController = {
  async verifyWebhook(req: Request, res: Response) { res.type('text/plain').send(await whatsappWebhookService.verifyChallenge(req.query['hub.mode'], req.query['hub.verify_token'], req.query['hub.challenge'])); },
  async receiveWebhook(req: Request, res: Response) { const result = await whatsappWebhookService.ingest(req.rawBody, req.header('x-hub-signature-256'), req.body); res.status(result.duplicate ? 200 : 202).json(result); },

  async listAccounts(req: Request, res: Response) { res.json({ data: await whatsappService.listAccounts(actor(req)) }); },
  async setupAccount(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.setupAccount(whatsappAccountSchema.parse(req.body), actor(req)) }); },
  async testAccount(req: Request, res: Response) { res.json({ data: await whatsappService.testAccount(req.params.id, actor(req)) }); },
  async disconnectAccount(req: Request, res: Response) { res.json({ data: await whatsappService.disconnectAccount(req.params.id, actor(req)) }); },
  async phoneNumbers(req: Request, res: Response) { res.json({ data: await whatsappService.listPhoneNumbers(typeof req.query.branchId === 'string' ? req.query.branchId : undefined, actor(req)) }); },

  async templates(req: Request, res: Response) { res.json({ data: await whatsappService.listTemplates(whatsappQuerySchema.parse(req.query), actor(req)) }); },
  async createTemplate(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.createTemplate(templateSchema.parse(req.body), actor(req)) }); },
  async updateTemplate(req: Request, res: Response) { res.json({ data: await whatsappService.updateTemplate(req.params.id, templateUpdateSchema.parse(req.body), actor(req)) }); },
  async syncTemplates(req: Request, res: Response) { res.json({ data: await whatsappService.syncTemplates(req.params.accountId, actor(req)) }); },

  async conversations(req: Request, res: Response) { res.json({ data: await whatsappService.listConversations(whatsappQuerySchema.parse(req.query), actor(req)) }); },
  async conversation(req: Request, res: Response) { res.json({ data: await whatsappService.getConversation(req.params.id, actor(req)) }); },
  async startConversation(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.startConversation(conversationStartSchema.parse(req.body), actor(req)) }); },
  async updateConversation(req: Request, res: Response) { res.json({ data: await whatsappService.updateConversation(req.params.id, conversationUpdateSchema.parse(req.body), actor(req)) }); },
  async sendMessage(req: Request, res: Response) { res.status(202).json({ data: await whatsappService.queueMessage(whatsappMessageSchema.parse({ ...req.body, conversationId: req.params.id ?? req.body.conversationId }), actor(req)) }); },
  async internalNote(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.addInternalNote(req.params.id, internalNoteSchema.parse(req.body), actor(req)) }); },

  async consents(req: Request, res: Response) { res.json({ data: await whatsappService.listConsents(typeof req.query.phone === 'string' ? req.query.phone : undefined, actor(req)) }); },
  async recordConsent(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.recordConsent(consentSchema.parse(req.body), actor(req)) }); },
  async automations(req: Request, res: Response) { res.json({ data: await whatsappService.listAutomations(typeof req.query.branchId === 'string' ? req.query.branchId : undefined, actor(req)) }); },
  async saveAutomation(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.saveAutomation(automationSchema.parse(req.body), actor(req)) }); },
  async broadcasts(req: Request, res: Response) { res.json({ data: await whatsappService.listBroadcasts(whatsappQuerySchema.parse(req.query), actor(req)) }); },
  async createBroadcast(req: Request, res: Response) { res.status(201).json({ data: await whatsappService.createBroadcast(broadcastSchema.parse(req.body), actor(req)) }); },
  async broadcastAction(req: Request, res: Response) { res.json({ data: await whatsappService.broadcastAction(req.params.id, broadcastActionSchema.parse(req.body), actor(req)) }); },

  async webhookEvents(req: Request, res: Response) { res.json({ data: await whatsappService.listWebhookEvents(typeof req.query.accountId === 'string' ? req.query.accountId : undefined, actor(req)) }); },
  async jobs(req: Request, res: Response) { res.json({ data: await whatsappService.listJobs(typeof req.query.status === 'string' ? req.query.status as never : undefined, actor(req)) }); },
  async processJobs(req: Request, res: Response) { actor(req); res.json({ data: await whatsappJobService.processDueJobs(processJobsSchema.parse(req.body).limit) }); },
  async failures(req: Request, res: Response) { res.json({ data: await whatsappService.listFailures(typeof req.query.accountId === 'string' ? req.query.accountId : undefined, actor(req)) }); },
  async legacyLogs(req: Request, res: Response) { res.json({ data: await whatsappService.listLogs(actor(req)) }); },
};
