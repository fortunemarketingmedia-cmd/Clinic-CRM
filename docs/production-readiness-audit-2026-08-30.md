# Revive Clinic CRM — Full Production-Readiness Audit

**Date:** 30 August 2026
**Scope:** Full repository (`backend/` Express + Prisma + PostgreSQL, `frontend/` Next.js 16) — security, authentication/authorization, API wiring, database, integrations, file handling, and frontend functionality.
**Method:** Direct source review of every route/controller/service/middleware file, the Prisma schema, frontend API client and module views, plus a live run of `tsc`, `eslint`, and `npm test` on both apps.

## Remediation update — 2 September 2026

The repository findings in this dated audit have since been remediated where source changes were possible: production placeholder secrets are rejected, independent encryption/file secrets are required, patient files use authenticated AES-256-GCM encryption, the audit API is mounted, direct patient creation was removed, public ad intake is secret-protected, active authorization branches use the current access levels, production demo seeding is blocked, and automated tests pass. A Hostinger VPS Compose stack now provides private PostgreSQL/MinIO, automatic TLS, health checks, secure Admin bootstrap, daily backups, deployment scripts, and CI verification.

Items that still require the deployment owner remain in [`go-live-manual-checklist.md`](./go-live-manual-checklist.md): the Hostinger VPS/DNS, real secrets and provider accounts, migration baselining, file migration, offsite backup and restore evidence, monitoring, doctor/inventory policy decisions, legal review, penetration testing, and clinic acceptance.

**Important note on scope:** this audit covers everything on disk right now, including **uncommitted changes**. `git status` shows ~29 modified files not yet committed (touching `auth.service.ts`, `patient.service.ts`, `patient-360` routes, and more) — commit or review these deliberately before treating any "current state" finding below as final.

---

## How to read this

Findings are grouped by severity:

- **🔴 Critical** — fix before any production traffic. Either an active security hole or something that will break in production as configured.
- **🟠 High** — fix before launch. Real risk or a meaningful gap between documented intent and actual behavior.
- **🟡 Medium** — should fix soon after launch, or before scaling past a single server/clinic.
- **🟢 Low / cleanup** — code hygiene, dead code, minor UX rough edges.
- **✅ Confirmed solid** — deliberately called out so you know what NOT to worry about.

---

## 🔴 Critical — fix before going live

### 1. JWT secrets are still the literal placeholder values
`backend/.env` currently has:
```
JWT_ACCESS_SECRET=replace-with-access-secret
JWT_REFRESH_SECRET=replace-with-refresh-secret
```
These are the exact strings shipped in `backend/.env.example`. Anyone who has ever seen this repo's example file (which is committed to git) can forge valid access and refresh tokens for **any user, including ADMIN**, without ever touching your database. This is the single most important thing to fix — it defeats the entire auth system.

**Fix:** generate two independent high-entropy secrets (e.g. `openssl rand -base64 48`) before any deployment, and never reuse the example values even in local dev if the machine is ever exposed.

### 2. MFA secret encryption silently falls back to a key derived from the JWT secrets
In `backend/src/services/auth.service.ts`:
```ts
const secret = decryptIntegrationSecret(
  user.mfaSecretCiphertext,
  env.INTEGRATION_ENCRYPTION_KEY ?? `${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`,
);
```
`INTEGRATION_ENCRYPTION_KEY` is **not set** in your current `.env` at all. Combined with finding #1, this means any TOTP secrets currently encrypted at rest are protected by a key derived from two publicly-known placeholder strings — i.e., not protected at all. The same fallback pattern also appears for `FILE_ACCESS_SECRET` (falls back to `JWT_ACCESS_SECRET`) in `file-storage.service.ts`.

**Fix:** set `INTEGRATION_ENCRYPTION_KEY` (32+ random chars) and `FILE_ACCESS_SECRET` explicitly in every environment. Once secrets are rotated, any existing MFA secrets/recovery codes encrypted under the old fallback key need to be re-issued (force MFA re-enrollment), not just re-encrypted, since the old key material was never truly secret.

### 3. Two fully-built backend modules are never wired into the app
`backend/src/app.ts` mounts every route file **except**:
- `audit.routes.ts` (`GET /api/audit` — the audit-log viewer, gated for ADMIN)
- `inventory.routes.ts` (full inventory/procurement module: controller, service, repository, validations all exist)

Both have complete controllers, services, repositories, and validation — they're just missing an `app.use('/api/...', ...)` line. Practically:
- **Nobody, not even an Admin, can currently view the audit trail through the API**, even though `audit.service`/`auditService.record(...)` is actively writing audit events all over the codebase (patient import, lead changes, prescriptions, etc.). You're collecting the data but have no way to read it back.
- Inventory management is entirely dead code today — no route reaches it, and there's no frontend page for it either.

**Fix:** either mount `auditRoutes` at `/api/audit` (it's needed — you're already relying on audit records for compliance per `docs/phase-11-security-operations.md`) and decide deliberately whether inventory ships now or gets removed to reduce surface area/maintenance burden.

---

## 🟠 High — fix before launch

### 4. `POST /api/patients` bypasses the documented "no direct patient creation" rule and has no branch check
Your own `docs/production-readiness.md` states: *"Never create patients directly; patients must come from the lead conversion flow."* But `patient.routes.ts` exposes:
```ts
patientRoutes.post('/', (req, res, next) => { patientController.create(...) });
```
with **no role restriction** — any authenticated user (Admin or Receptionist) can call it — and it calls `patientService.createPatient()` directly (this appears to be the clinic-QR walk-in self-registration path, `createFromClinicQr`). Two separate problems:
- It contradicts the documented single-path-of-truth rule, which matters for data integrity and lead attribution.
- Unlike `POST /api/patients/import` (which calls `accessService.assertBranchAccess(...)`), this endpoint never checks that the caller's branch matches `input.branchId`. A Receptionist scoped to Branch A can pass `branchId: <Branch B>` and create a patient there. This directly contradicts *"Keep receptionist data branch-scoped."*

**Fix:** confirm whether this route should exist at all (if it's meant only for the QR kiosk flow, that flow should hit a dedicated public/kiosk-scoped endpoint, not a general authenticated one), and add `assertBranchAccess` regardless.

### 5. Public lead-intake endpoints have no shared secret / anti-spam protection
`/api/public/ads/google`, `/api/public/ads/meta`, and `/api/public/website-leads` accept unauthenticated POSTs validated only by Zod schema shape, with a shared 60 requests/minute/IP limit. There's no webhook signature, API key, or CAPTCHA on these three (note: the real Meta/Google **webhook** endpoints in `integration.controller.ts` *do* correctly verify `x-hub-signature-256`/`x-google-signature` — this finding is only about the three public lead-capture endpoints, which are a different thing). Anyone who finds your website's form endpoint can flood your CRM with fake leads, skewing attribution reports and burning receptionist time.

**Fix:** add a per-source shared secret/HMAC header for the ads endpoints (these should only ever be called server-to-server by your own website/landing page, not directly by a browser), and consider a honeypot field or lower per-IP ceiling for `website-leads`.

### 6. Legacy roles referenced in route guards can never be satisfied by any real token
`AccessLevel` (what's actually issued in JWTs) has only `ADMIN | RECEPTIONIST | DEVELOPER`, but the `Role` enum in the schema still carries 14 values (`ORGANISATION_OWNER`, `CLINIC_ADMIN`, `AUDITOR`, `DOCTOR`, `THERAPIST`, `INVENTORY_MANAGER`, …), and several routes still guard with the old broader lists:
- `audit.routes.ts`: `requireRole(ADMIN, ORGANISATION_OWNER, CLINIC_ADMIN, AUDITOR)`
- `lead-scoring.routes.ts`: `requireRole(ADMIN, ORGANISATION_OWNER, CLINIC_ADMIN)`
- `person.routes.ts` (merge): same three

Because no user's token can ever actually carry `ORGANISATION_OWNER`/`CLINIC_ADMIN`/`AUDITOR` (those values no longer exist on `AccessLevel`), these checks are functionally identical to `requireRole(ADMIN)` today — **not a security hole**, but it's confusing dead branches that make the authorization model harder to reason about and easy to get wrong in a future edit (someone could reasonably assume `AUDITOR` grants audit access and be surprised it doesn't). `patient-360.routes.ts` already got cleaned up correctly (`clinicalRoles = [Role.ADMIN] as const`) — the other three files should get the same treatment.

**Fix:** grep for every `requireRole(` call and reduce each list to only values that exist in `AccessLevel`.

### 7. Clinical charting (encounters, prescriptions, treatment plans) is Admin-only — confirm this matches who actually logs in as a doctor
`patient-360.routes.ts` locks every clinical route to `[Role.ADMIN]`. Per your own docs, *"Legacy staff job classifications may remain on historical records but are normalized to Receptionist in authentication tokens"* — meaning a doctor's login almost certainly issues a `RECEPTIONIST` access-level token today. If that's the case, **doctors cannot open patient encounters, write prescriptions, or sign clinical notes** through the app at all; only whoever holds the single Admin account can. Worth a five-minute sanity check against how your clinic actually logs doctors in before launch — if doctors are meant to be Admins operationally, that's fine and this is not a bug, just worth confirming explicitly rather than discovering it live.

### 8. Seeded default credentials
`backend/prisma/seed.ts` creates:
```
admin@reviveclinic.local / DrRevive@12345
receptionist@reviveclinic.local / Reception@12345
```
Fine for local dev. **Dangerous if `prisma:seed` is ever run against a production database** without immediately rotating both passwords — these are printed in plain text in a file that will exist in your deployment artifact.

**Fix:** add to your go-live checklist: never run the seed script against prod, or if you do (e.g., to bootstrap the first Admin), force a password change / delete the receptionist seed account immediately after.

---

## 🟡 Medium

### 9. Rate limiting is in-process memory only
`middleware/rate-limit.ts` stores counters in a plain `Map` inside the Node process. This works correctly for a single backend instance (your current VPS deployment target) but:
- Resets on every deploy/restart (a bad actor mid-lockout gets a fresh window on restart).
- Will silently stop working correctly the moment you run more than one backend instance/replica behind a load balancer (each instance tracks its own counts, so effective limits multiply by instance count).

Not urgent for a single-VPS launch; becomes a real gap the moment you scale horizontally. Consider Redis-backed limiting (`rate-limit-redis` or similar) before adding a second instance.

### 10. Local disk file storage for clinical documents/consents/prescriptions
`file-storage.service.ts` writes uploaded files to local disk (`storage/private/`) with good hygiene (mode `0600`, path-traversal guard, magic-byte content validation, signed short-lived access tokens) — the code quality here is genuinely good. But your own `docs/production-readiness.md` and `docs/phase-11-security-operations.md` already flag this correctly: **local disk is not durable** on most VPS setups (no redundancy, lost on instance replacement, not backed up unless you specifically script it). This is clinical/legal data (consent PDFs, prescriptions, treatment photos) — treat migrating to encrypted object storage (S3-compatible) as a hard launch blocker, not a nice-to-have, given what's stored here.

### 11. `dead code`: `middleware/upload.ts` (`uploadPlaceholder`) is unused
Defined but never imported anywhere. Actual uploads go through JSON body + base64 (`fileStorageService.writeBase64`), which is a deliberate and reasonable design (keeps everything behind the same Zod validation pipeline) — just delete the unused placeholder file to avoid confusing future readers into thinking `multer` is in play somewhere.

### 12. Cannot verify `npm test` in this environment
I ran `npm run build` (passed, 0 errors) and `npm run lint` (passed, 0 warnings) for both backend and frontend directly on your machine — those are trustworthy. `npm test` failed here with an `esbuild` platform mismatch (`@esbuild/darwin-arm64` present, Linux binary needed) — that's an artifact of the sandboxed Linux shell this audit ran commands through, **not a code defect**. Please run `cd backend && npm test` yourself in a normal Terminal window to get a real pass/fail signal before launch; I could not verify it.

---

## 🟢 Low / cleanup

- One native `window.prompt(...)` is used for "Withdrawal reason" on a consent record (`patient-forms-files-panel.tsx`). Works, but native browser prompts render inconsistently across embedded webviews/PWAs and can't be styled — low priority to replace with your existing `Modal` component.
- `backend/prisma/schema.prisma` is 3,582 lines with 14 `Role` enum values but only 3 ever issued — consider trimming unused enum values in a future migration once you're certain no historical data references them (`grep`-check first).
- `package.json` scripts reference `npm@10.9.8` with a notice that `12.0.2` is available — not urgent, but worth a planned bump + smoke test.

---

## ✅ Confirmed solid (don't waste time re-auditing these)

- **Password handling:** bcrypt with proper salt rounds, generic "Invalid email or password" on both wrong-password and unknown-email (no user enumeration).
- **MFA:** correct TOTP implementation (HMAC-SHA1, 30s step, ±1 window tolerance, `timingSafeEqual` comparison), one-time recovery codes stored as bcrypt hashes and consumed on use.
- **Refresh tokens:** rotated on every use, stored server-side only as SHA-256 hashes, revoked on logout/logout-all, HttpOnly cookie — access tokens are correctly kept in memory only on the frontend (confirmed `localStorage` is actively purged of any legacy token).
- **CORS:** explicit origin allowlist (no wildcard), checked against `FRONTEND_ORIGINS`, `credentials: true` set correctly alongside it.
- **Headers:** `helmet()` applied globally.
- **Error handling:** centralized handler never leaks stack traces or request bodies in production responses; Prisma constraint errors are translated to clean 4xx responses; correlation IDs on every error for support/debugging.
- **File upload validation:** real magic-byte content sniffing per MIME type (including a hand-rolled PNG chunk/zlib validator) — not just trusting the `Content-Type` header. Path-traversal guarded. Files written `0600`. Access is via short-lived HMAC-signed tokens, not raw auth-gated fetches, so file links can be safely embedded/shared for a bounded window.
- **Webhook verification:** the actual Meta/Google integration webhooks correctly check signatures before processing (`x-hub-signature-256` / `x-google-signature`), separate from the (less protected) public lead-capture endpoints in finding #5.
- **Login throttling:** dedicated stricter limiter on `/api/auth/login` (12 attempts / 15 min, keyed by IP+email) on top of the global API limiter.
- **Database:** sensible indexing (14+ targeted composite indexes on hot paths — lead search, appointment scheduling conflicts, follow-up due dates), correct `onDelete: Cascade` on ownership relations.
- **TypeScript/lint:** both backend and frontend compile and lint completely clean as of this audit, on your actual machine.
- **Frontend:** every button/handler I sampled across leads, follow-ups, patients, forms/consents, prescriptions, and invoicing wires to a real mutation with loading/disabled/error states — no fake or no-op buttons found. React Query configured to retry only safe GETs, never mutations.
- **Graceful shutdown:** SIGTERM/SIGINT drain in-flight integration jobs before closing DB connections — good for zero-downtime deploys.

---

## Suggested fix order before "go live"

1. Rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, set `INTEGRATION_ENCRYPTION_KEY` and `FILE_ACCESS_SECRET` explicitly (#1, #2). Force MFA re-enrollment for any existing accounts after rotation.
2. Decide on audit-log route (mount it) and inventory module (ship or delete) (#3).
3. Fix or lock down `POST /api/patients` branch-scoping (#4).
4. Add a shared secret to the three public lead-intake endpoints (#5).
5. Clean up legacy role lists in `audit.routes.ts`, `lead-scoring.routes.ts`, `person.routes.ts` (#6).
6. Confirm doctor login/role assumption for clinical routes matches reality (#7).
7. Add a written go-live step: never seed prod, or immediately rotate seeded passwords (#8).
8. Run `npm test` yourself locally and confirm it's green (#12).
9. Everything in `docs/production-readiness.md`'s "Environment-owned go-live work" section (managed Postgres, object storage, monitoring, backup/restore drill, pen test) — that list was already accurate before this audit and nothing above changes it.

This is a genuinely well-built system for its stage — the architecture (controller/service/repository/validation separation), auth design, and file-handling code are all above the bar I usually see in a pre-launch audit. The findings above are real but fixable in a few focused days, not a rebuild.
