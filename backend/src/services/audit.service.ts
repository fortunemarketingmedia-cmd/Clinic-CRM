import type { Prisma } from '@prisma/client';
import { auditRepository } from '../repositories/audit.repository.js';

export type AuditContext = {
  userId?: string;
  branchId?: string;
  ipAddress?: string;
  device?: string;
  correlationId: string;
};

export const auditService = {
  record(
    context: AuditContext,
    event: {
      action: string;
      entity: string;
      entityId?: string;
      previousValue?: Prisma.InputJsonValue;
      newValue?: Prisma.InputJsonValue;
    },
  ) {
    const { userId, branchId, ipAddress, device, correlationId } = context;
    return auditRepository.create({ userId, branchId, ipAddress, device, correlationId, ...event });
  },

  list(filters: { branchId?: string; entity?: string; entityId?: string; userId?: string; take: number }) {
    return auditRepository.list(filters);
  },
};
