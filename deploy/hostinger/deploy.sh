#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${HOSTINGER_ENV_FILE:-$repo_root/deploy/hostinger/.env.hostinger}"
export HOSTINGER_ENV_FILE="$env_file"
compose=(docker compose --env-file "$env_file" -f "$repo_root/compose.production.yml")

if [[ ! -f "$env_file" ]]; then
  echo "Missing production environment file: $env_file" >&2
  exit 1
fi
if [[ "$(stat -c '%a' "$env_file")" != "600" ]]; then
  echo "Refusing to deploy: chmod 600 $env_file" >&2
  exit 1
fi
if grep -Eiq 'replace-with|generate-|example\.com' "$env_file"; then
  echo "Refusing to deploy: the environment file still contains example or placeholder values" >&2
  exit 1
fi

env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}
required_values=(
  DATABASE_URL REDIS_URL FILE_ENCRYPTION_KEY INTEGRATION_ENCRYPTION_KEY FILE_ACCESS_SECRET
  JWT_ACCESS_SECRET JWT_REFRESH_SECRET GOOGLE_ADS_INGEST_SECRET META_ADS_INGEST_SECRET
  METRICS_SECRET WEBSITE_LEAD_INGEST_SECRET DB_RUNTIME_PASSWORD MIGRATION_DATABASE_URL LOCAL_BACKUP_PASSWORD RESTIC_REPOSITORY RESTIC_PASSWORD
)
for key in "${required_values[@]}"; do
  if [[ -z "$(env_value "$key")" ]]; then
    echo "Refusing to deploy: $key is missing or empty" >&2
    exit 1
  fi
done
if [[ "$(env_value FILE_STORAGE_PROVIDER)" != local || "$(env_value FILE_STORAGE_ROOT)" != /private-files ]]; then
  echo 'Configure the private local volume before deploying this release' >&2
  exit 1
fi
if [[ "$(env_value DATABASE_URL)" == "$(env_value MIGRATION_DATABASE_URL)" ]]; then
  echo 'Runtime and migration roles must be separate' >&2
  exit 1
fi
if [[ "$(env_value RESTIC_REPOSITORY)" != sftp:* || "$(env_value LOCAL_BACKUP_PASSWORD)" == "$(env_value RESTIC_PASSWORD)" ]]; then
  echo 'An independent SFTP repository with its own backup password is required' >&2
  exit 1
fi

"${compose[@]}" config --quiet
"${compose[@]}" pull postgres redis clamav file-backup
"${compose[@]}" --profile offsite run --rm --no-deps --entrypoint restic offsite-backup snapshots --quiet
"${compose[@]}" build --pull backend frontend migrate worker
"${compose[@]}" up -d postgres
"${compose[@]}" run --rm database-backup once
"${compose[@]}" --profile tools run --rm migrate
DB_RUNTIME_PASSWORD="$(env_value DB_RUNTIME_PASSWORD)" "${compose[@]}" exec -T -e DB_RUNTIME_PASSWORD postgres \
  sh -c 'psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$repo_root/deploy/hostinger/runtime-role.sql"
"${compose[@]}" --profile tools run --rm --no-deps migrate \
  sh -c 'chown -R 1000:1000 /private-files && find /private-files -type d -exec chmod 0700 {} + && find /private-files -type f -exec chmod 0600 {} +'
"${compose[@]}" --profile tools run --rm --no-deps migrate \
  node scripts/transfer-private-files.mjs verify-local
"${compose[@]}" run --rm --no-deps file-backup once
"${compose[@]}" --profile offsite run --rm --no-deps offsite-backup once
"${compose[@]}" --profile offsite up -d --wait
"${compose[@]}" ps

echo "Release started. Verify HTTPS, login, patient documents, invoice print, and appointment notifications."
