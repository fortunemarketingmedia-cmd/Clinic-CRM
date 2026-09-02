#!/bin/sh
set -eu
umask 077

backup_once() {
  target="/backups/files/current"
  mkdir -p "$target"
  mc alias set internal "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
  mc mirror --overwrite --remove "internal/$S3_BUCKET/$S3_KEY_PREFIX" "$target"
  echo "Encrypted object backup completed: $target"
}

if [ "${1:-loop}" = "once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "Encrypted object backup failed; retrying on the next interval" >&2
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
