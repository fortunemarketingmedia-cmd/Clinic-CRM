#!/usr/bin/env bash
set -Eeuo pipefail

backup_root="${BACKUP_HOST_PATH:-/srv/revive-crm/backups}"
latest_dump="$(find "$backup_root/postgres" -type f -name 'revive-crm-*.dump' -print | sort | tail -n 1)"
if [[ -z "$latest_dump" ]]; then
  echo "No PostgreSQL backup found" >&2
  exit 1
fi

(
  cd "$(dirname "$latest_dump")"
  sha256sum --check "$(basename "$latest_dump").sha256"
)
docker run --rm -v "$backup_root/postgres:/backups:ro" postgres:17.6-alpine \
  pg_restore --list "/backups/$(basename "$latest_dump")" >/dev/null

file_count="$(find "$backup_root/files/current" -type f | wc -l | tr -d ' ')"
echo "Backup verified: $(basename "$latest_dump"); encrypted object count: $file_count"
