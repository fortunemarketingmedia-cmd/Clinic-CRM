import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header('x-correlation-id');
  req.correlationId = inbound && inbound.length <= 128 ? inbound : crypto.randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

