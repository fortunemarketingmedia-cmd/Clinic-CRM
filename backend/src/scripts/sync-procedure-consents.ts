import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { syncProcedureConsents } from '../data/procedure-consent-sync.js';

const prisma = new PrismaClient();

async function main() {
  const administrator = await prisma.user.findFirst({
    where: { accessLevel: 'ADMIN', status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!administrator) throw new Error('An active Admin account is required before procedure consents can be synced.');
  const result = await syncProcedureConsents(prisma, administrator.id);
  console.log(`Procedure consents synced: ${result.created} created, ${result.updated} updated, ${result.total} total.`);
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
