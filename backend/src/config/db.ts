import { PrismaClient } from '@prisma/client';
import type { ITXClientDenyList } from '@prisma/client/runtime/library';
import { withSoftDeleteFilter } from './soft-delete.js';

export { softDeleteModels } from './soft-delete.js';

export const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
  name: 'soft-delete',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        return query(withSoftDeleteFilter(model, operation, args));
      },
    },
  },
});

// Interactive transaction client of the extended client (use instead of Prisma.TransactionClient).
export type DbTransaction = Omit<typeof prisma, ITXClientDenyList>;
