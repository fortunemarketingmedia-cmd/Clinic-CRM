# Platform stability pass

Date: 23 July 2026

## Implemented

- Database-aware readiness endpoint at `GET /api/health`; `GET /health` remains a lightweight liveness check.
- Graceful shutdown for HTTP, background workers, and Prisma connections.
- Provider, webhook, and frontend request timeouts so stalled services fail predictably.
- Global API throttling plus stricter per-IP-and-email login throttling with rate-limit headers.
- Consistent JSON errors for validation, malformed JSON, Prisma conflicts/not-found cases, and unknown routes. Responses include correlation IDs.
- Access tokens are kept in browser memory; the HttpOnly refresh cookie restores sessions. Legacy locally stored access tokens are removed automatically.
- React Query retries only safe transient query failures; mutations are never retried automatically.
- Global loading, not-found, and error states for the frontend.
- Fourteen targeted PostgreSQL indexes for lead, appointment, patient, clinical, attribution, and login-event workloads.

## Verification completed

- Backend TypeScript build and ESLint: passed.
- Backend automated tests: 31 passed, 0 failed.
- Frontend TypeScript, ESLint, and production build: passed; 29 routes generated.
- Existing disposable database: all 24 migrations applied and no Prisma schema drift.
- Empty-database rehearsal: all 24 migrations applied, seed completed, migration status current.
- Integrity audit: no duplicate normalized user emails, no invalid access levels, no orphaned user-branch links, and all 14 stability indexes present.
- Live API smoke checks: readiness, login, refresh rotation, Admin access, Receptionist restrictions, primary CRM modules, reports, integrations, removed billing/inventory routes, JSON 404s, malformed JSON handling, CORS, login throttling, and graceful shutdown passed.

## Deployment dependencies

External integrations still require real clinic credentials and provider-side setup before production use: Meta/WhatsApp, Google Ads/OAuth, storage, DNS/TLS, encrypted backups, monitoring, and restore testing. These cannot be proven through the local disposable environment.
