import './audit-environment.js';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const sourceUrl = new URL(process.env.DATABASE_URL!);
const restoreUrl = new URL(sourceUrl);
const restoreName = 'revive_audit_restore_' + crypto.randomBytes(6).toString('hex') + '_uitest';
restoreUrl.pathname = '/' + restoreName;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = '/postgres';
const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
const source = new PrismaClient();
// Generated from fixed text and hexadecimal bytes, with no user-controlled identifier.
await admin.$executeRawUnsafe('CREATE DATABASE "' + restoreName + '"');
await fs.mkdir('tmp/audit-backup', { recursive: true, mode: 0o700 });
const dumped = spawnSync(
  'bash',
  ['scripts/backup-postgres.sh', sourceUrl.toString(), 'tmp/audit-backup'],
  { encoding: 'utf8', env: process.env },
);
if (dumped.status) throw new Error('Backup script failed; inspect the local verification log');
const backup = dumped.stdout.trim().split('\n').at(-1)!;
const restored = spawnSync('bash', ['scripts/verify-restore.sh', backup, restoreUrl.toString()], {
  encoding: 'utf8',
  env: process.env,
});
if (restored.status) throw new Error('Restore script failed; inspect the local verification log');
const restore = new PrismaClient({ datasources: { db: { url: restoreUrl.toString() } } });
const tables = await source.$queryRaw<
  Array<{ tablename: string }>
>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
let verified = 0;
for (const { tablename } of tables) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tablename)) throw new Error('Unsafe table');
  const sql = `SELECT md5(COALESCE(string_agg(row::text, ',' ORDER BY row::text), '')) AS digest, count(*)::int AS count FROM (SELECT to_jsonb(t) AS row FROM "${tablename}" t) rows`;
  const a = await source.$queryRawUnsafe(sql);
  const b = await restore.$queryRawUnsafe(sql);
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Restore mismatch: ${tablename}`);
  verified++;
}
const result = {
  database: 'dedicated local synthetic audit database',
  tablesVerified: verified,
  backupBytes: (await fs.stat(backup)).size,
  sha256: crypto
    .createHash('sha256')
    .update(await fs.readFile(backup))
    .digest('hex'),
  result: 'PASS',
};
await fs.writeFile(
  '../docs/audit/backup-verification.json',
  JSON.stringify(result, null, 2) + '\n',
);
console.log(result);
await Promise.all([source.$disconnect(), restore.$disconnect(), admin.$disconnect()]);
