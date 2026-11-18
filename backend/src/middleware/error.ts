import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';
import multer from 'multer';

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the configured upload limit' : 'Invalid file upload';
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message, correlationId: req.correlationId });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      issues: error.flatten(),
      correlationId: req.correlationId,
    });
  }

  if (error instanceof Error && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
    return res.status(401).json({ message: 'Invalid or expired token', correlationId: req.correlationId });
  }

  if (error instanceof HttpError) {
    return res
      .status(error.statusCode)
      .json({ message: error.message, correlationId: req.correlationId });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return res.status(409).json({ message: 'This record changed during your request. Refresh and try again.', correlationId: req.correlationId });
    if (error.code === 'P2002')
      return res.status(409).json({
        message: 'A record with these unique details already exists',
        correlationId: req.correlationId,
      });
    if (error.code === 'P2025')
      return res
        .status(404)
        .json({ message: 'The requested record was not found', correlationId: req.correlationId });
    if (error.code === 'P2003')
      return res.status(409).json({
        message: 'This record is referenced by another record and cannot be changed',
        correlationId: req.correlationId,
      });
  }

  if (error instanceof SyntaxError && 'body' in error)
    return res
      .status(400)
      .json({ message: 'Malformed JSON request body', correlationId: req.correlationId });

  console.error(
    JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      method: req.method,
      path: req.route?.path ?? 'unmatched',
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message: 'Unhandled request failure',
    }),
  );

  return res
    .status(500)
    .json({ message: 'Internal server error', correlationId: req.correlationId });
}
