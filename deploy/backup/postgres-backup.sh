#!/bin/sh
set -eu
umask 077

backup_once() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="/backups/postgres/revive-crm-${timestamp}.dump"
  mkdir -p /backups/postgres
  pg_dump --format=custom --no-owner --no-privileges --file="$target"
  pg_restore --list "$target" >/dev/null
  find /backups/postgres -type f -name 'revive-crm-*.dump' -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
  (
    cd /backups/postgres
    sha256sum "$(basename "$target")" > "$(basename "$target").sha256"
  )
  echo "PostgreSQL backup completed: $target"
}

if [ "${1:-loop}" = "once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "PostgreSQL backup failed; retrying on the next interval" >&2
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
