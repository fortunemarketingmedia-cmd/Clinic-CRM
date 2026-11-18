#!/usr/bin/env bash
set -euo pipefail

repo_root="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
backup_root="${BACKUP_HOST_PATH:-/srv/revive-crm/backups}"
failed=0
for kind in database local offsite; do
  marker="$backup_root/.$kind-success"
  if [ ! -f "$marker" ] || [ -z "$(find "$backup_root" -maxdepth 1 -name ".$kind-success" -mmin -1500 -print)" ]; then
    echo "ALERT $kind backup missing or stale" >&2
    failed=1
  fi
done
used="$(df -Pk "$backup_root" | awk 'NR == 2 {gsub(/%/, "", $5); print $5}')"
if [ "$used" -ge 75 ]; then echo 'ALERT backup disk exceeds 75%' >&2; failed=1; fi
if [ -r /proc/meminfo ]; then
  if ! awk '/MemTotal:/ {total=$2} /MemAvailable:/ {available=$2} END {exit !(available > total / 10)}' /proc/meminfo; then
    echo 'ALERT host memory available below 10%' >&2
    failed=1
  fi
  if ! awk -v cores="$(getconf _NPROCESSORS_ONLN)" '{exit !($2 < cores * 2)}' /proc/loadavg; then
    echo 'ALERT sustained host load exceeds two tasks per core' >&2
    failed=1
  fi
fi
if ! curl --fail --silent --show-error --max-time 10 "${HEALTH_URL:?Set HEALTH_URL}" >/dev/null; then
  echo 'ALERT CRM HTTPS readiness failed' >&2
  failed=1
fi
if ! services="$(docker compose --env-file "${HOSTINGER_ENV_FILE:-$repo_root/deploy/hostinger/.env.hostinger}" -f "$repo_root/compose.production.yml" ps --all --format '{{.Service}} {{.State}} {{.Health}}')"; then
  failed=1
else
  for service in backend frontend worker postgres redis clamav database-backup file-backup offsite-backup; do
    if ! printf '%s\n' "$services" | awk -v name="$service" '$1 == name && $2 == "running" && $3 != "unhealthy" {found=1} END {exit !found}'; then
      echo "ALERT $service missing or unhealthy" >&2
      failed=1
    fi
  done
fi
if ! docker compose --env-file "${HOSTINGER_ENV_FILE:-$repo_root/deploy/hostinger/.env.hostinger}" -f "$repo_root/compose.production.yml" exec -T backend \
  node --input-type=module -e 'import {PrismaClient} from "@prisma/client"; const p=new PrismaClient(); try { const failed=await p.durableJob.count({where:{OR:[{status:"DEAD"},{status:{in:["QUEUED","RETRY"]},runAt:{lt:new Date(Date.now()-900000)}},{status:"RUNNING",lockExpiresAt:{lt:new Date()}}]}}); if(failed)process.exitCode=1; } finally {await p.$disconnect();}' >/dev/null 2>&1; then
  echo 'ALERT worker backlog, dead job or database query failed' >&2
  failed=1
fi
if [ "$failed" -ne 0 ]; then
  logger -p user.err 'Revive CRM backup or service readiness alert'
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl --fail --silent --show-error --max-time 10 -H 'Content-Type: application/json' \
      --data '{"text":"Revive CRM backup, disk or service check failed. Inspect protected server logs."}' "$ALERT_WEBHOOK_URL" >/dev/null
  fi
fi
exit "$failed"
