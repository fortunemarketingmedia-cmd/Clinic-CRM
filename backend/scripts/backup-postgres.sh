#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <postgresql-url> <explicit-output-directory>" >&2
  exit 64
fi

database_url="$1"
output_directory="$2"
if [[ -z "$output_directory" || "$output_directory" == "/" || "$output_directory" == "." ]]; then
  echo "Refusing unsafe output directory" >&2
  exit 64
fi
mkdir -p "$output_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$output_directory/revive-$timestamp.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$backup_path" "$database_url"
shasum -a 256 "$backup_path" > "$backup_path.sha256"
echo "$backup_path"
