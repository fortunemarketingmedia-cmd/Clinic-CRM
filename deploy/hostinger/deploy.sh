#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${HOSTINGER_ENV_FILE:-$repo_root/deploy/hostinger/.env.hostinger}"
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
  METRICS_SECRET PAYMENT_GATEWAY_SECRET S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
)
for key in "${required_values[@]}"; do
  if [[ -z "$(env_value "$key")" ]]; then
    echo "Refusing to deploy: $key is missing or empty" >&2
    exit 1
  fi
done
if [[ "$(env_value MINIO_ROOT_USER)" == "$(env_value S3_ACCESS_KEY_ID)" ]] || \
   [[ "$(env_value MINIO_ROOT_PASSWORD)" == "$(env_value S3_SECRET_ACCESS_KEY)" ]]; then
  echo "Refusing to deploy: MinIO root and S3 application credentials must be independent" >&2
  exit 1
fi

"${compose[@]}" config --quiet
"${compose[@]}" pull postgres minio minio-init
"${compose[@]}" build --pull backend frontend migrate
"${compose[@]}" up -d postgres minio
"${compose[@]}" run --rm minio-init
"${compose[@]}" run --rm database-backup once
"${compose[@]}" run --rm file-backup once
"${compose[@]}" --profile tools run --rm migrate
"${compose[@]}" up -d --remove-orphans
"${compose[@]}" ps

echo "Release started. Verify HTTPS, login, patient documents, invoice print, and appointment notifications."
