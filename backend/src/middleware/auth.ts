import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.role === 'DEVELOPER') {
      const developerPaths = ['/api/auth', '/api/branches', '/api/integrations', '/api/whatsapp'];
      const requestPath = req.originalUrl.split('?')[0];
      if (!developerPaths.some((path) => requestPath.startsWith(path))) {
        return next(new HttpError(403, 'Developer accounts cannot access clinic records'));
      }
    }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
}

