import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: { windowMs: number; max: number }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (bucket.count >= options.max) {
      return next(new HttpError(429, 'Too many requests'));
    }

    bucket.count += 1;
    return next();
  };
}
