import type { Request, Response } from 'express';
import { securityService } from '../services/security.service.js';
import { HttpError } from '../utils/http-error.js';
import {
  backupVerificationSchema,
  exportLogSchema,
  mfaConfirmSchema,
  mfaDisableSchema,
} from '../validations/security.validation.js';
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
export const securityController = {
  async beginMfa(req: Request, res: Response) {
    res.json({ data: await securityService.beginMfa(actor(req), audit(req)) });
  },
  async confirmMfa(req: Request, res: Response) {
    res.json({
      data: await securityService.confirmMfa(
        mfaConfirmSchema.parse(req.body).code,
        actor(req),
        audit(req),
      ),
    });
  },
  async disableMfa(req: Request, res: Response) {
    await securityService.disableMfa(mfaDisableSchema.parse(req.body), actor(req), audit(req));
    res.status(204).send();
  },
  async sessions(req: Request, res: Response) {
    res.json({ data: await securityService.sessions(actor(req)) });
  },
  async revokeSession(req: Request, res: Response) {
    await securityService.revokeSession(req.params.id, actor(req), audit(req));
    res.status(204).send();
  },
  async loginEvents(req: Request, res: Response) {
    res.json({ data: await securityService.loginEvents(actor(req)) });
  },
  async exports(req: Request, res: Response) {
    res.json({ data: await securityService.exportLogs(actor(req)) });
  },
  async logExport(req: Request, res: Response) {
    res
      .status(201)
      .json({
        data: await securityService.logExport(
          exportLogSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
  async governance(req: Request, res: Response) {
    actor(req);
    res.json({ data: securityService.governance() });
  },
  async health(req: Request, res: Response) {
    res.json({ data: await securityService.health(actor(req)) });
  },
  async backups(req: Request, res: Response) {
    res.json({ data: await securityService.backupHistory(actor(req)) });
  },
  async recordBackup(req: Request, res: Response) {
    res
      .status(201)
      .json({
        data: await securityService.recordBackup(
          backupVerificationSchema.parse(req.body),
          actor(req),
          audit(req),
        ),
      });
  },
};
