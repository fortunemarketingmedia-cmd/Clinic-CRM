import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

export const auditRepository = {
  create(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    previousValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    branchId?: string;
    ipAddress?: string;
    device?: string;
    correlationId: string;
  }) {
    return prisma.auditLog.create({ data });
  },

  list(filters: { branchId?: string; entity?: string; entityId?: string; userId?: string; take: number }) {
    return prisma.auditLog.findMany({
      where: { branchId: filters.branchId, entity: filters.entity, entityId: filters.entityId, userId: filters.userId },
      include: { user: { select: { id: true, name: true, email: true } }, branch: true },
      orderBy: { createdAt: 'desc' },
      take: filters.take,
    });
  },
};

