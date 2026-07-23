#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <backup.dump> <empty-disposable-postgresql-url>" >&2
  exit 64
fi
backup_path="$1"
restore_url="$2"
if [[ ! -f "$backup_path" ]]; then
  echo "Backup file not found" >&2
  exit 66
fi
if [[ -f "$backup_path.sha256" ]]; then shasum -a 256 -c "$backup_path.sha256"; fi
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$restore_url" "$backup_path"
psql "$restore_url" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS applied_migrations FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;'
echo "Restore verification completed. Record the checksum and result in POST /api/security/backups."
