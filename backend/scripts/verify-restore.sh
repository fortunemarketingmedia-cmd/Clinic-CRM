#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <backup.dump> <empty-disposable-postgresql-url>" >&2
  exit 64
fi
backup_path="$1"
restore_url="$(node -e '
try {
  const url = new URL(process.argv[1]);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "statement_cache_size"]) url.searchParams.delete(key);
  process.stdout.write(url.toString());
} catch { console.error("Invalid PostgreSQL connection URL"); process.exit(64); }
' "$2")"
node -e '
try {
  const name = new URL(process.argv[1]).pathname;
  if (!/(?:_restore|_test|_uitest)$/.test(name)) throw new Error();
} catch { console.error("Restore target must be an explicitly disposable *_restore, *_test or *_uitest database"); process.exit(64); }
' "$restore_url"
table_count="$("${PSQL:-psql}" "$restore_url" -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');")"
if [[ "$table_count" != "0" ]]; then
  echo "Refusing to restore into a non-empty database" >&2
  exit 64
fi
if [[ ! -f "$backup_path" ]]; then
  echo "Backup file not found" >&2
  exit 66
fi
if [[ -f "$backup_path.sha256" ]]; then shasum -a 256 -c "$backup_path.sha256"; fi
"${PG_RESTORE:-pg_restore}" --exit-on-error --no-owner --no-privileges --dbname="$restore_url" "$backup_path"
"${PSQL:-psql}" "$restore_url" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS applied_migrations FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'
echo "Restore verification completed. Record the checksum and result in POST /api/security/backups."
