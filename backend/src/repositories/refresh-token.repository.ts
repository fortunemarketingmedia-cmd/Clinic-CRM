import { prisma } from '../config/db.js';

export const refreshTokenRepository = {
  create(data: {
    tokenHash: string;
    userId: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
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
  listForUser(userId: string) {
    return prisma.refreshToken.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } });
  },
  revokeById(userId: string, id: string) { return prisma.refreshToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } }); },
  touch(id: string) { return prisma.refreshToken.update({ where: { id }, data: { lastSeenAt: new Date() } }); },
};
