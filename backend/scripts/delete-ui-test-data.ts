/**
 * Removes the synthetic records created by seed-ui-test-data.ts / seed-ui-test-billing.ts, and anything
 * hanging off them (found by following foreign keys). Synthetic rows are recognised by their
 * `@example.test` e-mail addresses; nothing else is touched.
 *   DUMMY_DATA_TARGET=dev npx tsx scripts/delete-ui-test-data.ts
 */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { assertDummyDataTarget } from './ui-test-guard.js';

const dbName = assertDummyDataTarget();
const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;

async function primaryKey(tx: Tx, table: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1`, table);
  return rows.length === 1 ? rows[0].column_name : null;
}

async function references(tx: Tx, table: string) {
  return tx.$queryRawUnsafe<Array<{ child: string; child_col: string; parent_col: string }>>(
    `SELECT kcu.table_name AS child, kcu.column_name AS child_col, ccu.column_name AS parent_col
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND ccu.table_name = $1`, table);
}

/** Deletes rows of `table` whose `column` is in `ids`, children first. */
async function purge(tx: Tx, table: string, column: string, ids: string[], depth = 0): Promise<void> {
  if (!ids.length || depth > 8) return;
  for (const ref of await references(tx, table)) {
    if (ref.parent_col !== column || ref.child === table) continue;
    const pk = await primaryKey(tx, ref.child);
    if (!pk) {
      await tx.$executeRawUnsafe(`DELETE FROM "${ref.child}" WHERE "${ref.child_col}" = ANY($1::text[])`, ids);
      continue;
    }
    const children = await tx.$queryRawUnsafe<Array<Record<string, string>>>(`SELECT "${pk}" AS id FROM "${ref.child}" WHERE "${ref.child_col}" = ANY($1::text[])`, ids);
    await purge(tx, ref.child, pk, children.map((row) => row.id), depth + 1);
    await tx.$executeRawUnsafe(`DELETE FROM "${ref.child}" WHERE "${ref.child_col}" = ANY($1::text[])`, ids);
  }
  await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "${column}" = ANY($1::text[])`, ids);
}

async function main() {
  const ids = async (sql: string) => (await prisma.$queryRawUnsafe<Array<{ id: string }>>(sql)).map((row) => row.id);
  const people = await ids(`SELECT id FROM "Person" WHERE "normalizedEmail" LIKE '%@example.test'`);
  const patients = await ids(`SELECT id FROM "Patient" WHERE email LIKE '%@example.test' OR "personId" IN (SELECT id FROM "Person" WHERE "normalizedEmail" LIKE '%@example.test')`);
  const leads = await ids(`SELECT id FROM "Lead" WHERE email LIKE '%@example.test' OR "personId" IN (SELECT id FROM "Person" WHERE "normalizedEmail" LIKE '%@example.test')`);
  const users = await ids(`SELECT id FROM "User" WHERE email LIKE '%@example.test'`);
  await prisma.$transaction(async (tx) => {
    await purge(tx, 'Patient', 'id', patients);
    await purge(tx, 'Lead', 'id', leads);
    await purge(tx, 'Person', 'id', people);
    await purge(tx, 'User', 'id', users);
  }, { timeout: 120_000, maxWait: 20_000 });
  console.log({ db: dbName, removed: { patients: patients.length, leads: leads.length, people: people.length, users: users.length } });
}

main().finally(() => prisma.$disconnect());
