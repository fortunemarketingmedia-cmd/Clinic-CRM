import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

export async function resolveActiveUser(token: string) {
  const payload = verifyAccessToken(token);
  if (payload.role === 'DEVELOPER') return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { status: true, accessLevel: true, sessionVersion: true },
  });
  if (user?.status !== 'ACTIVE' || user.accessLevel !== payload.role || user.sessionVersion !== (payload.version ?? 0)) return null;
  return { id: payload.sub, role: payload.role, exp: payload.exp };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  let pending: Promise<Awaited<ReturnType<typeof resolveActiveUser>>>;
  try {
    pending = resolveActiveUser(token);
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
  pending
    .then((user) => {
      if (!user) return next(new HttpError(401, 'Account is not active'));
      req.user = { id: user.id, role: user.role };
      return next();
    })
    .catch((error: unknown) => {
      if (error instanceof Error && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return next(new HttpError(401, 'Invalid or expired token'));
      return next(error);
    });
}
