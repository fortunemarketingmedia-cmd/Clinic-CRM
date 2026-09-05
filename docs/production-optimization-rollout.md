# Production optimization rollout

This release changes uploads, list pagination, patient numbering, caching, background work, backups, and observability. Apply it during a short maintenance window and take a verified database and object backup first.

## Required production configuration

Add the new values shown in `deploy/hostinger/.env.hostinger.example`:

- `REDIS_PASSWORD` and the matching URL-encoded password in `REDIS_URL`
- `METRICS_SECRET`
- `MAX_UPLOAD_BYTES=10485760`
- `MAX_IMAGE_PIXELS=64000000`

Keep `CLAMAV_HOST` empty and `FILE_SCAN_REQUIRED=false` until the malware-scanning profile is deliberately enabled. To enable it, start Compose with `--profile malware-scan`, set `CLAMAV_HOST=clamav`, verify the scanner is healthy, and then set `FILE_SCAN_REQUIRED=true`.

Configure the offsite Restic variables before enabling the `offsite` profile. Restic encrypts every snapshot and retains 14 daily, 8 weekly, and 12 monthly snapshots.

## Deployment order

1. Run the existing database and object backups and verify their checksums.
2. Update the production environment file with all required values.
3. Build the new images.
4. Start PostgreSQL and Redis. PostgreSQL must restart with `pg_stat_statements` preloaded.
5. Run `docker compose --env-file deploy/hostinger/.env.hostinger --profile tools run --rm migrate`.
6. Start the API, worker, frontend, and backup services.
7. Verify `/api/health` reports database and storage ready and Redis ready.
8. Verify the worker is running and the existing-image optimization queue is decreasing.
9. Upload one JPEG, PNG, PDF, and Office document. Confirm the original opens, image derivatives appear, and unauthorized file URLs fail.
10. Run the authenticated smoke test against representative read endpoints.

The first migration adds the file metadata, safe search indexes, metrics extension, and atomic patient-number sequence. The second migration queues derivative creation for existing clinical images. The third ensures Nashik Road exists and grants both live branches to every active Admin and Receptionist. Originals are never replaced.

After deployment, sign in once as the Admin and once as the Receptionist. Confirm the header branch selector offers both `Sharanpur Road` and `Nashik Road`, and confirm Master Records, notification counts, due reminders, and task/follow-up completion remain scoped to the selected branch.

## Reverse proxy

`deploy/nginx/revive-crm.conf.example` contains the recommended upload limits, timeouts, compression, private API proxy, and immutable caching for hashed Next.js assets. Compare it with the live Nginx configuration; do not overwrite certificate paths blindly. Validate with `nginx -t` before reload.

## Monitoring

Scrape `GET /metrics` using `Authorization: Bearer <METRICS_SECRET>`. Alert on:

- API 5xx rate above 1% for five minutes
- p95 normal API latency above 500 ms
- upload failures or dead background jobs
- Redis/PostgreSQL/MinIO health failure
- container restarts or disk usage above 75%
- database or file backup age above 26 hours

Keep metrics and logs free of patient names, phones, file names, and clinical content.

## Performance verification

Run:

```bash
LOAD_TEST_URL=https://api.crm.reviveskinclinics.in \
LOAD_TEST_ACCESS_TOKEN='<temporary-admin-access-token>' \
LOAD_TEST_PATHS='/api/branches,/api/patients?pageSize=50,/api/leads?pageSize=50' \
LOAD_TEST_REQUESTS=500 LOAD_TEST_CONCURRENCY=20 \
node backend/scripts/load-smoke.mjs
```

Capture p50, p95, p99, error rate, CPU, RAM, PostgreSQL connections, and slow-query plans before increasing concurrency. Never load-test patient-writing endpoints on production.

## Backup and restore

The local object mirror remains a fast current copy. The optional Restic service provides encrypted, deduplicated, historical offsite snapshots. Test a restore into an isolated database and MinIO prefix before declaring the backup system complete.

## Operational caveats

- Enabling ClamAV needs approximately 1 GB of additional RAM. Leave it disabled on an undersized VPS and use an external scanning service instead.
- Redis is used for cache and rate-limit state only; durable jobs remain in PostgreSQL.
- Never expose Redis, PostgreSQL, MinIO, Prometheus metrics, or ClamAV publicly.
