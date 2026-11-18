import { PrismaClient } from '@prisma/client';
import type { ITXClientDenyList } from '@prisma/client/runtime/library';
import { withSoftDeleteFilter } from './soft-delete.js';
import { env } from './env.js';

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

export async function verifyRuntimeDatabase() {
  const [role] = await prisma.$queryRaw<{ restricted: boolean }[]>`
    SELECT NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
      OR has_schema_privilege(current_user, 'public', 'CREATE')) AS restricted
    FROM pg_roles WHERE rolname = current_user`;
  if (!role || (env.NODE_ENV === 'production' && !role.restricted)) {
    throw new Error('The production application requires a restricted PostgreSQL role');
  }
}
