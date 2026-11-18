#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <postgresql-url> <explicit-output-directory>" >&2
  exit 64
fi

database_url="$(node -e '
try {
  const url = new URL(process.argv[1]);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  for (const key of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "statement_cache_size"]) url.searchParams.delete(key);
  process.stdout.write(url.toString());
} catch { console.error("Invalid PostgreSQL connection URL"); process.exit(64); }
' "$1")"
output_directory="$2"
if [[ -z "$output_directory" || "$output_directory" == "/" || "$output_directory" == "." ]]; then
  echo "Refusing unsafe output directory" >&2
  exit 64
fi
mkdir -p "$output_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$output_directory/revive-$timestamp.dump"
"${PG_DUMP:-pg_dump}" --format=custom --no-owner --no-privileges --file="$backup_path" "$database_url"
shasum -a 256 "$backup_path" > "$backup_path.sha256"
echo "$backup_path"
