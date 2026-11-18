import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/** Cookie-authenticated session mutations must not be initiated by an untrusted web origin. */
export function trustedSessionOrigin(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.header('origin');
  if (
    (origin && !env.FRONTEND_ORIGINS.includes(origin)) ||
    (req.header('sec-fetch-site') === 'cross-site' && !origin)
  ) {
    return next(new HttpError(403, 'Untrusted request origin'));
  }
  next();
}
