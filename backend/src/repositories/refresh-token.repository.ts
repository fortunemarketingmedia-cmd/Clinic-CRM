import { HttpError } from '../utils/http-error.js';
import { prisma, type DbTransaction } from '../config/db.js';

type Session = { userId: string; version: number; role: 'ADMIN' | 'RECEPTIONIST' };
type RefreshRecord = { tokenHash: string; userId: string; userAgent?: string; ipAddress?: string; expiresAt: Date };

async function lockCurrentSession(tx: DbTransaction, session: Session) {
  const [account] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE id = ${session.userId} AND status = 'ACTIVE'
      AND "accessLevel" = ${session.role}::"AccessLevel" AND "sessionVersion" = ${session.version} FOR UPDATE`;
  if (!account) throw new HttpError(401, 'Session is no longer valid');
}

export const refreshTokenRepository = {
  rotate(previousHash: string, data: RefreshRecord, session: Session) {
    return prisma.$transaction(async (tx) => {
      await lockCurrentSession(tx, session);
      const claimed = await tx.refreshToken.updateMany({ where: { tokenHash: previousHash, userId: data.userId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
      if (claimed.count !== 1) throw new HttpError(401, 'Invalid refresh token');
      return tx.refreshToken.create({ data });
    });
  },
  create(data: RefreshRecord, session: Session) {
    return prisma.$transaction(async (tx) => {
      await lockCurrentSession(tx, session);
      return tx.refreshToken.create({ data });
    });
  },

  findActiveByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
  },

  findByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({ where: { tokenHash }, select: { userId: true, revokedAt: true, user: { select: { sessionVersion: true } } } });
  },

  revokeByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  revokeAllForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },
  endAllSessions(userId: string) {
    return prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } }, select: { id: true } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  },
  listForUser(userId: string) {
    return prisma.refreshToken.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } });
  },
  revokeById(userId: string, id: string) { return prisma.refreshToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } }); },
  touch(id: string) { return prisma.refreshToken.update({ where: { id }, data: { lastSeenAt: new Date() } }); },
};
