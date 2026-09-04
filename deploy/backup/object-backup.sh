#!/bin/sh
set -eu
umask 077

backup_once() {
  target="/backups/files/current"
  source="internal/$S3_BUCKET/$S3_KEY_PREFIX"

  mkdir -p "$target"

  mc alias set internal "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null

  if output="$(mc mirror --overwrite --remove "$source" "$target" 2>&1)"; then
    echo "Encrypted object backup completed: $target"
    return 0
  fi

  case "$output" in
    *"Object does not exist"*)
      rm -rf "$target"
      mkdir -p "$target"
      printf '%s\n' "No encrypted objects exist yet." > "$target/.empty-source"
      echo "Encrypted object backup completed: source prefix is empty."
      return 0
      ;;
    *)
      printf '%s\n' "$output" >&2
      return 1
      ;;
  esac
}

if [ "${1:-loop}" = "once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "Encrypted object backup failed; retrying on the next interval" >&2
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
