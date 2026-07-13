import type { NextFunction, Request, Response } from 'express';

export function uploadPlaceholder(_req: Request, _res: Response, next: NextFunction) {
  next();
}

