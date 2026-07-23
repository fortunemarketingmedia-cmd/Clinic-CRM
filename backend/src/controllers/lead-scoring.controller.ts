import type { Request, Response } from 'express';
import { leadScoringService } from '../services/lead-scoring.service.js';
import {
  scoringRuleSchema,
  updateScoringRuleSchema,
} from '../validations/lead-scoring.validation.js';
import { auditService } from '../services/audit.service.js';
export const leadScoringController = {
  async list(_req: Request, res: Response) {
    res.json({ data: await leadScoringService.listRules() });
  },
  async create(req: Request, res: Response) {
    const data = await leadScoringService.createRule(scoringRuleSchema.parse(req.body));
    await auditService.record(
      {
        userId: req.user?.id,
        ipAddress: req.ip,
        device: req.header('user-agent'),
        correlationId: req.correlationId,
      },
      { action: 'LEAD_SCORING_RULE_CREATED', entity: 'LeadScoringRule', entityId: data.id },
    );
    res.status(201).json({ data });
  },
  async update(req: Request, res: Response) {
    const data = await leadScoringService.updateRule(
      req.params.id,
      updateScoringRuleSchema.parse(req.body),
    );
    await auditService.record(
      {
        userId: req.user?.id,
        ipAddress: req.ip,
        device: req.header('user-agent'),
        correlationId: req.correlationId,
      },
      { action: 'LEAD_SCORING_RULE_UPDATED', entity: 'LeadScoringRule', entityId: data.id },
    );
    res.json({ data });
  },
  async recalculateAll(_req: Request, res: Response) {
    res.json({ data: await leadScoringService.recalculateAll() });
  },
};
