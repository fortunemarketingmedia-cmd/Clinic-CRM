#!/bin/sh
set -eu
umask 077

backup_once() {
  target="/backups/files/current"
  source="internal/$S3_BUCKET/$S3_KEY_PREFIX"
  error_file="/tmp/revive-object-backup-error"

  mkdir -p "$target"
  rm -f "$error_file"

  mc alias set internal "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null

  if mc mirror --overwrite --remove "$source" "$target" 2>"$error_file"; then
    rm -f "$error_file"
    echo "Encrypted object backup completed: $target"
    return 0
  fi

  if grep -q "Object does not exist" "$error_file"; then
    rm -rf "$target"
    mkdir -p "$target"
    rm -f "$error_file"
    echo "Encrypted object backup completed: source prefix is empty."
    return 0
  fi

  cat "$error_file" >&2
  rm -f "$error_file"
  return 1
}

if [ "${1:-loop}" = "once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "Encrypted object backup failed; retrying on the next interval" >&2
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
