#!/bin/sh
set -eu
umask 077

mode="${1:?Select local or offsite backup}"
: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD}"

backup_once() (
  set -e
  case "$mode" in
    local)
      test -d /private-files
      test -n "$(find /backups/postgres -name '*.dump.sha256' -type f -print -quit)"
      # Allow space for the next database dump and snapshot before writing to the shared VPS disk.
      test "$(df -Pk /backups | awk 'NR == 2 {print $4}')" -ge "${MIN_BACKUP_FREE_KIB:-10485760}"
      if [ ! -f "$RESTIC_REPOSITORY/config" ]; then restic init --quiet; fi
      restic backup /private-files /backups/postgres --exclude '*.part' --host revive-crm --tag revive-crm --quiet
      ;;
    offsite)
      case "$RESTIC_REPOSITORY" in sftp:*) ;; *) echo 'Independent SFTP backup repository required' >&2; exit 1;; esac
      test -f /backups/.local-success
      password_file="$(mktemp)"
      trap 'rm -f "$password_file"' EXIT
      printf '%s\n' "${LOCAL_BACKUP_PASSWORD:?Set LOCAL_BACKUP_PASSWORD}" > "$password_file"
      restic copy --from-repo /backups/private-restic --from-password-file "$password_file" --quiet
      ;;
    *) exit 2;;
  esac
  restic forget --host revive-crm --tag revive-crm --keep-daily "${RESTIC_KEEP_DAILY:-14}" \
    --keep-weekly "${RESTIC_KEEP_WEEKLY:-8}" --keep-monthly "${RESTIC_KEEP_MONTHLY:-12}" --prune --quiet
  restic check --read-data-subset=5% --quiet
  marker="$(mktemp "/backups/.$mode-success.XXXXXX")"
  date -u +%FT%TZ > "$marker"
  mv "$marker" "/backups/.$mode-success"
)

# Calling a function in an OR-list suppresses errexit even in its subshell.
# Run the one-shot operation as a separate shell so a partial backup never advances the marker.
if [ "${2:-loop}" = once ]; then backup_once; exit; fi
while true; do
  /bin/sh "$0" "$mode" once || echo "$mode backup failed" >&2
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
