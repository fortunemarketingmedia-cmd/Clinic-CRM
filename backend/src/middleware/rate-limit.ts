import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';

const buckets = new Map<string, { count: number; resetAt: number }>();
let requestsSinceCleanup = 0;

export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  key?: (req: Request) => string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix ?? 'global'}:${options.key?.(req) ?? req.ip ?? 'unknown'}`;
    const now = Date.now();
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 500) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
      requestsSinceCleanup = 0;
    }
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('RateLimit-Limit', options.max);
      res.setHeader('RateLimit-Remaining', Math.max(0, options.max - 1));
      res.setHeader('RateLimit-Reset', Math.ceil((now + options.windowMs) / 1000));
      return next();
    }

    if (bucket.count >= options.max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return next(new HttpError(429, 'Too many requests'));
    }

    bucket.count += 1;
    res.setHeader('RateLimit-Limit', options.max);
    res.setHeader('RateLimit-Remaining', Math.max(0, options.max - bucket.count));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
    return next();
  };
}
