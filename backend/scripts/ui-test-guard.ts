/**
 * Safety check shared by the synthetic-data scripts.
 * - Always allowed on databases whose name ends in `_uitest`.
 * - On a local development database it additionally needs DUMMY_DATA_TARGET=dev.
 * - Never runs against production or a non-local host.
 */
export function assertDummyDataTarget() {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://x/none');
  const dbName = url.pathname.replace('/', '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run synthetic-data scripts with NODE_ENV=production.');
  if (dbName.endsWith('_uitest')) return dbName;
  if (local && process.env.DUMMY_DATA_TARGET === 'dev') return dbName;
  throw new Error(`Refusing to touch "${dbName}". Use a *_uitest database, or a local database with DUMMY_DATA_TARGET=dev.`);
}
