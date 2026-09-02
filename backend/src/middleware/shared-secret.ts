import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';

export function requireSharedSecret(expected: string | undefined, headerName = 'x-lead-ingest-secret') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!expected) return next(new HttpError(503, 'Lead intake is not configured'));
    const supplied = req.header(headerName) ?? '';
    const suppliedDigest = crypto.createHash('sha256').update(supplied).digest();
    const expectedDigest = crypto.createHash('sha256').update(expected).digest();
    if (!crypto.timingSafeEqual(suppliedDigest, expectedDigest)) {
      return next(new HttpError(401, 'Lead intake authentication failed'));
    }
    return next();
  };
}
