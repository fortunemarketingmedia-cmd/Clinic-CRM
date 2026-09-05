#!/bin/sh
set -eu

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"

backup_once() {
  restic snapshots >/dev/null 2>&1 || restic init
  restic backup /backups --tag revive-crm
  restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
  restic check --read-data-subset=5%
}

if [ "${1:-loop}" = "once" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "Encrypted offsite backup failed; retrying on the next interval" >&2
  sleep "${OFFSITE_BACKUP_INTERVAL_SECONDS:-86400}"
done
