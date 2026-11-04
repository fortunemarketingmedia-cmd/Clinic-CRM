import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/tokens.js';

// An access token stays valid for its whole lifetime (15 minutes by default). Re-checking the account here means a
// deactivated, deleted or re-roled user loses access within a few seconds instead of when the token expires.
const accountCacheMs = 10_000;
const accountCache = new Map<string, { role: Role | null; checkedAt: number }>();

export function forgetUserAccess(userId: string) {
  accountCache.delete(userId);
}

async function currentRole(userId: string): Promise<Role | null> {
  const cached = accountCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < accountCacheMs) return cached.role;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, accessLevel: true } });
  const role = user && user.status === 'ACTIVE' && (user.accessLevel === 'ADMIN' || user.accessLevel === 'RECEPTIONIST') ? (user.accessLevel as Role) : null;
  if (accountCache.size > 5_000) accountCache.clear();
  accountCache.set(userId, { role, checkedAt: Date.now() });
  return role;
}

export async function resolveActiveUser(token: string) {
  const payload = verifyAccessToken(token);
  if (payload.role === 'DEVELOPER') return null;
  const role = await currentRole(payload.sub);
  return role ? { id: payload.sub, role, exp: payload.exp } : null;
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
