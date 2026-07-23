# Phase 11 — Security, governance, and production operations

## Security controls

- TOTP MFA with encrypted secrets, one-time recovery codes stored only as bcrypt hashes, and session invalidation when MFA changes.
- Short-lived access tokens, hashed rotating refresh tokens, HTTP-only cookies, active-session listing/revocation, and logout-all.
- Exactly two effective access levels: `ADMIN` and `RECEPTIONIST`. Legacy staff job classifications may remain on historical records but are normalized to Receptionist in authentication tokens.
- Login success/failure monitoring, correlation IDs, immutable audit events, rate limiting, Helmet headers, strict CORS, and structured error logs without request bodies.
- Export purpose/filters/count/status evidence and a documented governance endpoint. Advertising conversion uploads require explicit consent and exclude medical data.

## Operations

- Public liveness: `GET /api/health`.
- Admin readiness view: `GET /api/security/health` (database latency, queues, degraded integrations, failed-login signal).
- Backup command: `backend/scripts/backup-postgres.sh <database-url> <explicit-output-directory>`.
- Restore drill: restore only into an empty disposable database with `backend/scripts/verify-restore.sh <dump> <disposable-url>`, then record evidence at `POST /api/security/backups`.
- Load smoke: `LOAD_TEST_URL=https://api.example.com LOAD_TEST_REQUESTS=1000 LOAD_TEST_CONCURRENCY=40 npm run load:smoke`.

## Deployment checklist

1. Use managed PostgreSQL with private networking, TLS, PITR, encrypted storage, daily backups, and quarterly restore drills.
2. Generate independent high-entropy JWT, file-access, webhook, and integration-encryption secrets in a secret manager.
3. Configure `BACKEND_PUBLIC_URL`, exact frontend origins, secure cookie domain, Meta webhook URLs, and the Google OAuth redirect URI.
4. Apply `prisma migrate deploy` before starting new application instances. Run one release canary and verify `/api/security/health`.
5. Run the backend and workers under a process supervisor with graceful restart, centralized JSON logs, alerting on HTTP 5xx/job dead letters/degraded integrations, and disk/CPU/database alarms.
6. Confirm object-storage encryption and lifecycle rules for clinical files; never use local ephemeral disk as the production record store.
7. Run backend tests, both production builds, a disposable-database migration rehearsal, provider sandbox tests, backup/restore verification, and the load smoke before go-live.
8. Review Admin accounts, Receptionist branch assignments, MFA adoption, stale sessions, webhook secrets, OAuth scopes, conversion consent, and export logs before launch.
