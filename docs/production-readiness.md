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

## Current Production Gaps

- PostgreSQL is not connected locally yet.
- Migrations are generated but not applied to a live database yet.
- Meta WhatsApp Business API delivery is represented by logs/templates, but live Meta credentials are not connected yet.
- File upload metadata is implemented, but production object storage is not connected yet.
- Request logging exists in development logs, but production log shipping/retention is not configured yet.
- Lead forms and appointment workflows are not complete yet.
