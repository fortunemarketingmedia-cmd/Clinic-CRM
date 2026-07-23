import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { integrationService } from '../services/integration.service.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import {
  campaignSchema,
  conversionEventSchema,
  fieldMappingSchema,
  integrationConnectionSchema,
  integrationConnectionUpdateSchema,
  integrationQuerySchema,
  syncSchema,
} from '../validations/integration.validation.js';

function actor(req: Request) {
  if (!req.user) throw new HttpError(401, 'Authentication required');
  return { id: req.user.id, role: req.user.role };
}
function audit(req: Request) {
  return {
    userId: req.user?.id,
    ipAddress: req.ip,
    device: req.header('user-agent'),
    correlationId: req.correlationId,
  };
}
const stringQuery = (value: unknown) => (typeof value === 'string' ? value : undefined);

export const integrationController = {
  async connections(req: Request, res: Response) {
    res.json({
      data: await integrationService.listConnections(
        actor(req),
        integrationQuerySchema.parse(req.query),
      ),
    });
  },
  async createConnection(req: Request, res: Response) {
    res
      .status(201)
      .json({
        data: await integrationService.createConnection(
          integrationConnectionSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
  async updateConnection(req: Request, res: Response) {
    res.json({
      data: await integrationService.updateConnection(
        req.params.id,
        integrationConnectionUpdateSchema.parse(req.body),
        actor(req),
        audit(req),
      ),
    });
  },
  async testConnection(req: Request, res: Response) {
    res.json({
      data: await integrationService.testConnection(req.params.id, actor(req), audit(req)),
    });
  },
  async disconnect(req: Request, res: Response) {
    await integrationService.disconnect(req.params.id, actor(req), audit(req));
    res.status(204).send();
  },
  async googleOAuthUrl(req: Request, res: Response) {
    res.json({ data: await integrationService.googleOAuthUrl(req.params.id, actor(req)) });
  },
  async googleOAuthCallback(req: Request, res: Response) {
    const code = stringQuery(req.query.code);
    const state = stringQuery(req.query.state);
    if (!code || !state) throw new HttpError(400, 'Google OAuth code and state are required');
    await integrationService.googleOAuthCallback(code, state);
    res.redirect(`${env.FRONTEND_URL}/integrations?google=connected`);
  },
  async mappings(req: Request, res: Response) {
    res.json({ data: await integrationService.listMappings(stringQuery(req.query.connectionId)) });
  },
  async saveMapping(req: Request, res: Response) {
    res
      .status(201)
      .json({
        data: await integrationService.saveMapping(
          fieldMappingSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
  async events(req: Request, res: Response) {
    actor(req);
    res.json({ data: await integrationService.listEvents(stringQuery(req.query.connectionId)) });
  },
  async syncRuns(req: Request, res: Response) {
    actor(req);
    res.json({ data: await integrationService.listSyncRuns(stringQuery(req.query.connectionId)) });
  },
  async sync(req: Request, res: Response) {
    res
      .status(202)
      .json({
        data: await integrationService.startSync(
          req.params.id,
          syncSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
  async verifyWebhook(req: Request, res: Response) {
    res
      .type('text/plain')
      .send(
        await integrationService.verifyWebhook(
          req.params.id,
          stringQuery(req.query['hub.mode']),
          stringQuery(req.query['hub.verify_token']),
          stringQuery(req.query['hub.challenge']),
        ),
      );
  },
  async webhook(req: Request, res: Response) {
    const result = await integrationService.receiveWebhook(
      req.params.id,
      req.rawBody ?? Buffer.from(JSON.stringify(req.body)),
      req.body,
      req.header('x-hub-signature-256') ?? req.header('x-google-signature'),
    );
    res.status(result.duplicate ? 200 : 202).json(result);
  },
  async campaigns(req: Request, res: Response) {
    actor(req);
    res.json({
      data: await integrationService.listCampaigns({
        branchId: stringQuery(req.query.branchId),
        platform: stringQuery(req.query.platform) as 'META' | 'GOOGLE' | undefined,
      }),
    });
  },
  async createCampaign(req: Request, res: Response) {
    const input = campaignSchema.parse(req.body);
    res
      .status(201)
      .json({
        data: await integrationService.createCampaign(
          {
            ...input,
            audience: input.audience as Prisma.InputJsonValue | undefined,
            createdById: actor(req).id,
          },
          actor(req),
          audit(req),
        ),
      });
  },
  async conversions(req: Request, res: Response) {
    actor(req);
    res.json({
      data: await integrationService.listConversions(stringQuery(req.query.connectionId)),
    });
  },
  async createConversion(req: Request, res: Response) {
    res
      .status(202)
      .json({
        data: await integrationService.createConversion(
          conversionEventSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
};
