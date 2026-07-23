# Revive Clinic CRM — Phase 0 Architecture Audit

Audit date: 2026-07-21

## 1. Current architecture summary

Revive Clinic CRM is a two-workspace TypeScript application. The frontend is a Next.js App Router application and the backend is an Express JSON API. The backend already follows a useful `route -> controller -> service -> repository -> Prisma` separation. PostgreSQL is the system of record. The frontend calls the API from client components through a shared fetch wrapper and uses TanStack Query for server state.

The existing application is a functional first version, but its core identity and lifecycle model is too tightly coupled for the requested clinic operating system. In particular, the lead owns identity fields, a patient is one-to-one with a lead, and appointments reuse the lead-status enum.

## 2. Current technology stack

| Layer | Detected implementation |
| --- | --- |
| Monorepo | npm workspaces (`frontend`, `backend`) |
| Frontend | Next.js 16, React 19, TypeScript 5.7 |
| UI | Tailwind CSS 3.4, local reusable components, Lucide, Framer Motion |
| Forms/data | React Hook Form, Zod 3.24, TanStack Query 5 |
| Backend | Node.js, Express 4.21, TypeScript/tsx |
| Database | PostgreSQL, Prisma 6 |
| Authentication | bcrypt, JWT access token, rotating refresh token cookie |
| Security middleware | Helmet, CORS allow-list, application rate limiter |
| Documents | PDFKit invoice generation |
| Test tooling | No test runner or test suite is currently configured |
| Queue/storage | No durable queue, worker, Redis, or object-storage adapter |

## 3. Existing database schema

Current models are `User`, `RefreshToken`, `Branch`, `Lead`, `AdLead`, `Appointment`, `Patient`, `TimelineEvent`, `MedicalProfile`, `Session`, `TreatmentPackage`, `Invoice`, `Payment`, `PatientFile`, `WhatsAppLog`, and singleton-style `ClinicSettings`.

Important current relationships:

- `Lead -> Patient` is one-to-one through `Patient.leadId @unique`.
- `Lead -> Appointment` is one-to-many.
- `Appointment.status` uses `LeadStatus`.
- Patient demographics are copied from Lead rather than held in a stable identity record.
- `Session` combines consultation, encounter, procedure, and follow-up concepts.
- `TreatmentPackage` stores session use as a mutable counter.
- `Invoice` has a single service-shaped total but already supports multiple `Payment` rows.
- `MedicalProfile` is overwritten in place and has no version history.
- `TimelineEvent` provides a useful cross-domain activity base but is mutable and is not a security audit log.

## 4. Existing page and route map

Frontend pages:

- `/login`
- `/dashboard`
- `/leads`
- `/appointments`
- `/patients`
- `/clients` (admin master-record view)
- `/invoices`
- `/analytics` (admin)
- `/settings` (admin)
- `/users`
- `/qr/[token]` (public registration)

The root page redirects into the authenticated application. Operational pages are mostly large client-side feature views rather than record-specific profile routes.

## 5. Existing APIs

The Express API exposes:

- `/api/auth`: login, refresh, logout, logout-all, current user
- `/api/users`: admin list/create/update/delete
- `/api/branches`: list and admin update
- `/api/leads`: list/create/get/update/delete, duplicate search, timeline
- `/api/appointments`: list/create/get/update/cancel/delete
- `/api/patients`: list/create/convert/get/update, medical profile, timeline, sessions, packages, files
- `/api/billing`: invoices, invoice payments, invoice PDF
- `/api/analytics`: overview metrics
- `/api/ad-leads`: list and manual conversion
- `/api/settings`: admin read/update
- `/api/whatsapp`: local logs, queue record, broadcast record
- `/api/public`: QR registration plus unauthenticated Google/Meta payload ingestion
- `/health`: application-only liveness response

Request validation is generally performed with Zod in controllers. API response envelopes are not fully standardised and pagination is not implemented.

## 6. Existing authentication and permissions

- Passwords are bcrypt hashes.
- Short-lived access JWTs are sent by the frontend in the `Authorization` header.
- Refresh JWTs are hashed in the database, stored in an HTTP-only cookie, and rotated on refresh.
- `logout-all` revokes the user's refresh tokens.
- Only `ADMIN` and `RECEPTIONIST` roles exist.
- Route-level role checks protect users/settings and some branch/WhatsApp actions.
- Receptionist branch protection relies on the caller supplying a `branchId`; there is no user-to-branch assignment table, so a receptionist can request any known branch.
- Access tokens are persisted in browser local storage, which increases exposure if an XSS defect occurs.
- There are no module/action/field permissions or clinical-data restrictions.

## 7. Existing integrations

- Google and Meta leads can be posted to public endpoints and stored as `AdLead` rows.
- These endpoints do not implement provider signature verification, webhook idempotency keys, reconciliation, or background retrieval.
- WhatsApp is currently a local message-log abstraction. It does not call the official Cloud API, receive webhooks, manage templates, or use a durable queue.
- WhatsApp credentials are stored in `ClinicSettings` as plaintext database fields and can be returned through settings APIs.
- There are no live Google Ads, Meta Ads, payment-gateway, email, SMS, storage, or accounting integrations.

## 8. Structural problems

1. Identity is duplicated across Lead and Patient; repeat enquiries would create duplicate people.
2. Patient-to-lead cardinality prevents multiple enquiries from belonging to one patient.
3. Lead, appointment, arrival, cancellation, and no-show states share one enum and cause cross-domain side effects.
4. Lead ownership and next-action invariants are not represented.
5. Branch access is a UI/request convention, not an enforced user entitlement.
6. Follow-up notes/dates are fields on Lead, not durable work records.
7. No dedicated Task, CallLog, immutable AuditLog, or medical-history version exists.
8. Appointment conflict detection uses a point-in-time equality model and lacks duration/practitioner/resource calendars.
9. Package usage is counter-based.
10. The public advertising ingestion endpoints are unauthenticated and non-idempotent.
11. Integration secrets are not isolated or encrypted.
12. Destructive deletes exist for operational records.
13. Several production pages are monolithic and there are no full record-profile routes.
14. There is no test harness, background worker, durable scheduler, observability adapter, or API documentation.

## 9. Missing modules

The requested platform still needs the dedicated Person/duplicate centre, lead ownership/scoring/transitions, follow-up and task workspaces, expanded RBAC, audit centre, waitlist, Patient 360, doctor workspace, encounters and locked notes, treatment plans/procedures, prescriptions, forms/consents, secure media, adverse events, proper packages and finance, inventory/procurement, communication centre, official provider integrations, jobs/workers, support, portal/online booking, feedback/reactivation, automation, and expanded analytics.

## 10. Proposed target architecture

Keep the current workspaces and backend layering. Evolve the backend into feature modules with shared platform services:

```text
HTTP route/controller
  -> validation + authenticated access context
  -> domain service / transaction boundary
  -> repository
  -> PostgreSQL

Domain service
  -> audit service
  -> timeline/activity service
  -> job outbox (later worker phases)
  -> integration adapter (later integration phases)
```

Foundation rules:

- `Person` is the stable identity; Lead and Patient reference it.
- A Person has many Leads and at most one Patient profile.
- Lead, Appointment, Encounter, Task, Package, Invoice, and Ticket keep independent statuses.
- `UserBranch` and central permission policies constrain every branch-scoped query and mutation.
- Critical multi-row changes use Prisma transactions.
- `AuditLog` is append-only at the application permission layer.
- Existing response fields remain available during the compatibility period.

## 11. Proposed database changes

Phase 1 introduces:

- `Person` with normalised mobile/email and consent/preference fields.
- Nullable/backfilled `Lead.personId`, `Lead.ownerId`, `Lead.nextAction`, `Lead.nextActionDueAt`, qualification/loss/conversion fields.
- `Patient.personId @unique` while retaining legacy `leadId` during compatibility.
- New CRM lead stages while retaining legacy enum values until all callers migrate.
- Independent `AppointmentStatus` and migration of existing appointment values.
- `FollowUp`, `Task`, `CallLog`, `AuditLog`, `MedicalProfileVersion`, and `UserBranch`.
- Expanded roles, indexes for operational queues, and relations to the central timeline.

Later phases will split `Session` into Encounter and ProcedureSession, introduce treatment plans, ledger-backed packages/inventory, invoice items/refunds, secure file metadata, consent versions, conversations, durable jobs, and integration event tables.

## 12. Migration and backfill strategy

1. Add enums/tables/columns without removing existing data.
2. Create one Person for each existing Patient, copying patient identity and connecting the patient's originating Lead.
3. Create Persons for remaining Leads, grouping only exact normalised mobile/email matches; do not fuzzy-merge automatically.
4. Backfill lead owners from `createdById`, next action from follow-up data (or `Initial contact`), and due date from `nextFollowupAt` (or creation time).
5. Map appointment statuses into the independent enum (`BOOKED -> SCHEDULED`, `NOT_ARRIVED -> NO_SHOW`, `POSTPONED -> RESCHEDULED`, and direct equivalents).
6. Seed `UserBranch` access conservatively: existing admins receive all branches; receptionist assignments must be reviewed rather than inferred as permanent entitlements.
7. Add constraints only after backfill validation queries succeed.
8. Keep legacy columns and enum members until frontend/API compatibility work is complete.
9. Roll back Phase 1 by dropping only new constraints/tables/columns and converting appointment status values back; no source rows are deleted.

## 13. New navigation structure

The final grouped sidebar follows the requested sections: Dashboard; CRM; Front Desk; Patients; Billing; Inventory; Patient Experience; Reports; Administration. During phased delivery, only implemented destinations are enabled; upcoming destinations are not linked to empty production pages.

Phase 1 adds CRM entries for Leads, Follow-ups, and Tasks, and Administration entries for Staff & Access and Audit Logs. Existing Appointments, Patients, Billing, Analytics, and Settings remain accessible.

## 14. Implementation phases

Use the eleven phases in the master brief. Each phase gets an additive migration, domain services, permission/audit coverage, API/UI work, automated checks, seed updates, and documentation. A phase does not advance until Prisma validation, TypeScript builds, lint, and its tests pass.

## 15. Risks and dependencies

- Production PostgreSQL data must be copied and the backfill rehearsed before applying constraints.
- Existing frontend status values require a compatibility translation while appointment status separates from lead status.
- Branch assignments require a business-approved staff-to-branch matrix.
- Fuzzy duplicate suggestions need a reviewed threshold; only exact normalised matches should ever auto-link.
- Official WhatsApp/Meta/Google work requires provider accounts, approved apps/templates, webhook URLs, credentials, and consent policy decisions.
- Durable scheduling requires a deployment choice (Redis-backed queue or PostgreSQL job table/worker).
- Secure photos/files require an object-storage provider, encryption policy, retention policy, and signed-URL support.
- Healthcare privacy, retention, consent wording, prescription rules, taxation, and audit retention require counsel/clinic approval before production launch.

## 16. Exact Phase 1 file plan

Existing files to change:

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/app.ts`
- `backend/src/types/express.d.ts`
- `backend/src/services/lead.service.ts`
- `backend/src/repositories/lead.repository.ts`
- `backend/src/validations/lead.validation.ts`
- `backend/src/services/patient.service.ts`
- `backend/src/repositories/patient.repository.ts`
- `backend/src/controllers/lead.controller.ts`
- `backend/src/routes/lead.routes.ts`
- `frontend/src/constants/roles.ts`
- `frontend/src/types/lead.ts`
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/modules/leads/leads-view.tsx`

New files planned:

- `backend/prisma/migrations/20260721120000_phase_1_foundation/migration.sql`
- `backend/src/utils/identity.ts`
- `backend/src/repositories/person.repository.ts`
- `backend/src/services/person.service.ts`
- `backend/src/validations/person.validation.ts`
- `backend/src/controllers/person.controller.ts`
- `backend/src/routes/person.routes.ts`
- `backend/src/repositories/follow-up.repository.ts`
- `backend/src/services/follow-up.service.ts`
- `backend/src/validations/follow-up.validation.ts`
- `backend/src/controllers/follow-up.controller.ts`
- `backend/src/routes/follow-up.routes.ts`
- `backend/src/repositories/task.repository.ts`
- `backend/src/services/task.service.ts`
- `backend/src/validations/task.validation.ts`
- `backend/src/controllers/task.controller.ts`
- `backend/src/routes/task.routes.ts`
- `backend/src/repositories/audit.repository.ts`
- `backend/src/services/audit.service.ts`
- `backend/src/routes/audit.routes.ts`
- `frontend/src/app/follow-ups/page.tsx`
- `frontend/src/app/tasks/page.tsx`
- `frontend/src/modules/follow-ups/follow-ups-view.tsx`
- `frontend/src/modules/tasks/tasks-view.tsx`
- `frontend/src/types/foundation.ts`

The list can narrow if a compatibility constraint makes a planned edit unnecessary, but Phase 1 will not silently expand into later clinical, billing, inventory, or integration phases.
