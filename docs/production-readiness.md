# Production Readiness Standards

Revive CRM should be built as a production system from the first version, even while the feature set stays focused.

## Engineering Rules

- Keep controller, service, repository, and database access separated.
- Validate every request body and query with Zod.
- Never create patients directly; patients must come from the lead conversion flow.
- Keep receptionist data branch-scoped.
- Keep admin-only features protected on both backend routes and frontend navigation.
- Add migrations for every database schema change.
- Store long-lived tokens only as hashes in the database.
- Use HTTP-only cookies for refresh tokens.
- Keep access tokens short lived.
- Run lint, typecheck, and builds before treating a phase as complete.

## Deployment Rules

- Frontend deploys to Vercel.
- Backend deploys to a VPS.
- PostgreSQL should be managed with migrations, backups, and restricted network access.
- Production secrets must never be committed.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be strong random values.
- `COOKIE_DOMAIN` and CORS must match the deployed frontend/backend domains.

## Environment-owned go-live work

- Provision managed PostgreSQL and production object storage; the repository cannot provision vendor infrastructure by itself.
- Register live Meta/Google apps, webhook subscriptions, OAuth redirect URLs, business verification, ad accounts, conversion datasets/actions, and least-privilege credentials.
- Connect structured logs to the clinic's selected monitoring/alerting provider and configure on-call destinations.
- Schedule encrypted backups, perform and record a disposable restore drill, and approve retention/deletion policy with the clinic's legal/compliance owner.
- Complete penetration testing, privacy/legal review, provider sandbox acceptance, and a clinic user-acceptance run before production traffic.
