#!/bin/sh
set -eu
umask 077

backup_once() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  target="/backups/postgres/revive-crm-${timestamp}.dump"
  mkdir -p /backups/postgres
  test "$(df -Pk /backups | awk 'NR == 2 {print $4}')" -ge "${MIN_BACKUP_FREE_KIB:-10485760}"
  pg_dump --format=custom --compress=gzip:6 --no-owner --no-privileges --file="$target.part"
  mv "$target.part" "$target"
  pg_restore --list "$target" >/dev/null
  find /backups/postgres -type f -name 'revive-crm-*.dump' -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
  for checksum in /backups/postgres/*.dump.sha256; do
    test ! -f "$checksum" || test -f "${checksum%.sha256}" || rm "$checksum"
  done
  (
    cd /backups/postgres
    sha256sum "$(basename "$target")" > "$(basename "$target").sha256"
  )
  date -u +%FT%TZ > /backups/.database-success
  echo "PostgreSQL backup completed: $target"
}

if [ "${1:-loop}" = "once" ]; then
  backup_once
  exit 0
fi

while true; do
  /bin/sh "$0" once || echo "PostgreSQL backup failed; retrying on the next interval" >&2
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
