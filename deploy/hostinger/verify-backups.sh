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
docker run --rm -v "$backup_root/postgres:/backups:ro" postgres:17.12-alpine@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7 \
  pg_restore --list "/backups/$(basename "$latest_dump")" >/dev/null

if [[ ! -f "$backup_root/.local-success" ]]; then
  echo 'No completed local encrypted snapshot found' >&2
  exit 1
fi
printf 'Database backup verified: %s\n' "$(basename "$latest_dump")"
printf 'Local snapshot last success: %s\n' "$(cat "$backup_root/.local-success")"
docker run --rm --network none -e RESTIC_REPOSITORY=/backups/private-restic \
  -e RESTIC_PASSWORD="${LOCAL_BACKUP_PASSWORD:?Set LOCAL_BACKUP_PASSWORD}" \
  -v "$backup_root:/backups" restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510 \
  check --read-data --quiet
