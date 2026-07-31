# Revive Clinic CRM - System Progress and Remaining Roadmap

Date: 31 July 2026  
Audience: Developers taking over or continuing the CRM implementation  
Project root: `D:\Project\Office\Clinic-CRM\Clinic-CRM`

## 1. Executive summary

Revive Clinic CRM has moved from a generic CRM-style application toward a clinic-specific operating system. The current product direction is now centered around the real clinic journey:

```text
Enquiry
  -> Lead follow-up
  -> Appointment booking
  -> Client registration
  -> Check-in / queue
  -> Consultation
  -> Prescription
  -> Treatment planning
  -> Billing and payment
  -> Treatment sessions
  -> Follow-up
  -> Retention / recall
```

The system now has a clearer separation between:

- Sales/enquiry workflow: Leads and Follow-ups.
- Clinic operations workflow: Appointments, Daily Client Queue, Schedules & Rooms.
- Clinical workflow: Client Directory, Client 360, Doctor Workspace, treatments, prescriptions.
- Business workflow: Billing, reports, analytics, communication, WhatsApp integration.

Recent work focused heavily on simplifying the UI, removing confusing duplicate fields, cleaning role access, and making lead-to-appointment handoff clearer.

The automated testing pass on 31 July 2026 is currently green after one encoding bug fix. See:

```text
docs/automated-testing-report-2026-07-31.md
```

## 2. Current product architecture

The active workflow source of truth is:

```text
docs/clinical-crm-workflow.md
```

Developers should treat that file as the product contract for workflow decisions.

### Main frontend modules

| Module | Purpose | Current status |
| --- | --- | --- |
| Dashboard | Operational overview for today, appointments, leads, patients, follow-ups, analytics shortcuts | Functional, needs more data-mapping QA |
| Leads | Stores only patient enquiries and sales-stage data | Recently simplified |
| Follow-ups | Sales pipeline board for enquiry follow-up | Recently redesigned into simplified lead pipeline |
| Appointments | Main booking calendar and proposed-lead confirmation area | Functional, recently improved |
| Daily Client Queue | Same-day clinic flow for checked-in/waiting/consultation/completed clients | Functional |
| Schedules & Rooms | Room availability and daily room planning | Improved with busy time ranges |
| Client Directory | Longitudinal client records, not raw leads | Functional, data-mapping still needs QA |
| Client 360 | Full client profile: appointments, treatments, billing, prescriptions, profile, documents | Functional but needs deeper workflow integration |
| Doctor Workspace | Clinical work area for today’s clients | Functional, needs more polish |
| Communication | WhatsApp/communication centre | Functional skeleton; Meta setup still required |
| Tasks | Internal operational task list | Functional, simplified staff selection |
| Reports / Analytics | Admin-only analytics | Functional but needs data validation |
| Settings / Administration | Admin-only configuration | Simplified; several legacy options hidden/redirected |
| Developer integration tools | Developer-only integrations/system maintenance | Restricted to `DEVELOPER` role |

### Main backend modules/routes

Important backend areas:

- Auth and role access
- Branch access
- Leads
- Appointments
- Front desk / queue / schedules
- Patients and Patient 360
- Clinical records
- Billing
- Inventory
- WhatsApp
- Reports / analytics
- Audit / security

Backend follows the intended pattern:

```text
Route -> Controller -> Service -> Repository -> Database
```

Developers should keep business rules in service/policy layers, not in controllers.

## 3. Role and access model

The product has been simplified to practical clinic roles:

### Dr. Revive

Internal role: `ADMIN`

Expected access:

- Full CRM access
- Reports and analytics
- Administration/settings
- Client and clinical records
- Appointments and scheduling
- Communication

### Receptionist

Internal role: `RECEPTIONIST`

Expected access:

- Dashboard
- Leads
- Follow-ups
- Tasks
- Appointments
- Daily Client Queue
- Schedules & Rooms
- Client Directory
- Communication
- Operational client workflow

Receptionist should not access:

- Reports / Analytics
- Administration / Settings
- Developer integrations

### Developer

Internal role: `DEVELOPER`

Expected access:

- Hidden from clinic users
- Integration/system maintenance only
- Developer-only integration tab

## 4. Major completed progress

### 4.1 Local Prisma/backend setup stabilized

Earlier issues included:

- Missing `.env` values.
- Incorrect `DATABASE_URL`.
- PostgreSQL not running on `localhost:5432`.
- Prisma client enum import mismatch.

Current expectation:

- Backend expects PostgreSQL available using `DATABASE_URL`.
- Prisma migrate and seed must run before full local testing.
- Backend dev server runs on port `4000`.

### 4.2 Role model simplified

The system was moved away from many old role/account concepts.

Current product expectation:

- Clinic-facing users see Dr. Revive and Receptionist workflows.
- Developer role exists only for hidden integration/system maintenance work.
- Integration tab is developer-only.

Remaining developer note:

The Prisma enum still contains legacy roles for compatibility. Do not delete enum values casually; removing enum values requires a careful database migration and existing-data audit.

### 4.3 Sidebar and navigation simplified

Removed or redirected confusing modules from user-facing navigation:

- Waitlist replaced by Daily Client Queue.
- Lead scoring hidden/redirected.
- Automations hidden/redirected.
- Forms & Consents removed from primary UI flow.
- Integration hidden from clinic users.

### 4.4 Branch selector behavior improved

The main branch selector is now the primary clinic-wide selector. Duplicate branch selectors were removed from several screens.

Schedules & Rooms has its own room-branch filter because room planning needs direct access to Nashik Road and Sharanpur Road rooms regardless of the top navbar branch state.

### 4.5 Leads page simplified

Lead page improvements:

- Removed excess action buttons.
- Removed inline status changing controls from list rows.
- Simplified lead statuses.
- Added better analytical dashboard/filter intent.
- Kept leads focused on enquiry/sales data only.

User-facing lead status flow:

```text
New enquiry
Contacted
Follow-up required
Appointment proposed
Not interested
```

Internal statuses still map to older enum values for compatibility.

### 4.6 Follow-ups page converted to sales pipeline

The follow-up page was changed into a sales pipeline board with compact cards and drag/drop-style workflow.

Current stages:

```text
New enquiry
Contacted
Follow-up required
Appointment proposed
Not interested
```

Important behavior:

- `Appointment booked` is not a manual lead-board option.
- Booking should happen through the appointment workflow.
- When appointment is created, lead exits the active lead/follow-up workflow.

### 4.7 Proposed lead to appointment workflow added

Problem fixed:

Leads could be moved to `Appointment proposed`, but the Appointments page did not provide a way to confirm/book them.

Current behavior:

- Appointments page shows a “Lead appointment confirmations” section.
- Leads with `APPOINTMENT_PROPOSED` appear there.
- Receptionist clicks “Book appointment”.
- Appointment form opens pre-filled with lead data.
- Saving creates a real appointment using `leadId`.
- The lead/proposed list refreshes.

### 4.8 Appointment confirmation error UX improved

Problem fixed:

When confirming a proposed lead appointment failed, the UI only showed a plain technical-ish error.

Current behavior:

Booking failures show user-friendly resolution guidance.

Examples:

- Selected slot is not available.
- Branch needs attention.
- Treatment service is not available.
- Some appointment details are missing.

Helpful actions include:

- Try next 30 min.
- Choose another room.
- Switch to consultation.
- Select branch.

### 4.9 Staff assignment dropdowns removed from forms

User request:

Remove doctor, therapist, receptionist, practitioner, assistant selection options from forms.

Completed:

- Appointment form no longer asks for doctor/provider.
- Follow-up appointment booking modal no longer asks for doctor/provider.
- Treatment modal no longer asks for doctor/provider.
- Client 360 clinical composer no longer shows Dr/Practitioner picker.
- Consent signing no longer asks user to pick staff witness.
- Task creation no longer asks user to choose assignee.

Important implementation detail:

Some backend models still require staff/provider IDs. The frontend now auto-fills defaults where needed. Longer-term backend work should infer default provider/actor more cleanly.

### 4.10 Appointment treatment/service/package UI simplified

Earlier appointment booking had too many confusing fields:

- Visit purpose
- Service
- Treatment package
- Plan
- Equipment
- Room/chair
- Doctor/provider
- Therapist/receptionist

Completed simplification:

- Consultation hides treatment service selection.
- Consultation applies standard consultation time/rate.
- Treatment booking uses one combined treatment service/package selector.
- Room dropdown only shows available room options based on date/time.
- Equipment and extra room/chair selectors were removed from appointment form.

### 4.11 Schedules & Rooms improved

Completed:

- Dedicated room branch filter.
- Daily room board.
- Date selector added.
- Room cards now show busy time ranges.
- Seven-day schedule table now shows busy time and blocked duration.

Current room card now shows:

- Busy time range
- Client
- Status
- Service
- Total blocked duration including buffer

### 4.12 Daily Client Queue consolidated

Old pages:

- Today’s Queue
- Waitlist

Product decision:

Replace both with one Daily Client Queue page.

Current intended behavior:

- Big current-client card.
- List of all clients for selected day.
- Date filter/calendar selector.
- No 7-day window on this page.

### 4.13 Client Directory renamed and repurposed

Old concept:

Patient Directory mixed with leads and unclear clinical qualification.

Current concept:

Client Directory should show actual clients who entered clinic workflow:

- Appointment
- Checkup
- Consultation
- Treatment
- Procedure
- Prescription
- Invoice/payment

It should not be just raw leads.

Remaining work:

Audit all repository queries and seed/migration paths so older non-lead clinical data appears correctly without dummy data.

### 4.14 Client 360 improved

Work completed:

- Simplified profile actions.
- Removed top treatment/prescription duplicate action clutter.
- Added treatment edit/delete capability.
- Added appointment room-change option.
- Improved treatment/procedure/prescription dropdowns.
- Billing package invoice modal can load package masters.

Remaining work:

Client 360 still needs stronger cross-linking between:

- Appointment
- Consultation
- Treatment session
- Prescription
- Invoice/payment
- Package usage

### 4.15 Prescription branding

Completed:

Printed prescription output includes clinic branding:

- Revive Clinic name
- Logo
- Contact
- Location
- Timings
- Branch

Remaining:

Need verify final real clinic address/contact/timing content with clinic owner before production.

### 4.16 Packages/rates/medicine data

Work completed:

- Latest package/rate data from uploaded PDF was integrated into seeds and dropdowns.
- Appointment treatment service selection combines service/package options.
- Prescription medicine dropdowns added.

Remaining:

Need ongoing admin-safe way to update package masters without editing seed file.

### 4.17 Website form / CRM integration planning

Current situation:

- Temporary website is on Vercel.
- CRM is local only for now.
- Website forms cannot reliably call `localhost` CRM from public Vercel deployment.

Needed for real integration:

- Public API URL for CRM backend.
- HTTPS.
- CORS configured.
- Public lead intake endpoint.
- Spam/rate protection.

Reference:

```text
docs/website-form-integration.md
```

### 4.18 WhatsApp / Meta integration planning

Discussed and documented:

- Official Meta WhatsApp Cloud API setup.
- India-only client cost expectations.
- Not using marketing/authentication categories for now.
- Utility/service conversation use cases.
- Chatbot cost implications.

Reference:

```text
docs/whatsapp-cost-report.md
```

## 5. Automated QA status

Latest automated report:

```text
docs/automated-testing-report-2026-07-31.md
```

Commands executed:

```text
npm run test --workspace revive-crm-backend
npm run build --workspace revive-crm-backend
npm run lint --workspace revive-crm-backend
npm run typecheck --workspace revive-crm-frontend
npm run lint --workspace revive-crm-frontend
npm run build --workspace revive-crm-frontend
```

Current result:

- Backend tests: passed, 31/31
- Backend build: passed
- Backend lint: passed
- Frontend typecheck: passed
- Frontend lint: passed
- Frontend production build: passed after encoding fix

Bug found during testing:

- `patient-360-view.tsx` had invalid UTF-8 encoding.
- Fixed by normalizing touched TSX files to UTF-8.

## 6. Known issues and future work

### P1 - Appointment billing is not fully structured

Current state:

Appointment booking UI can show:

- Estimated rate
- Package/service rate
- Payment status
- Payment mode

Risk:

Some billing values are currently UI/notes level and not fully persisted as structured invoice/payment records.

Needed work:

Implement a real appointment-to-billing handoff:

```text
Appointment booked
  -> selected service/package has price
  -> create invoice or draft invoice
  -> if payment marked paid, create payment allocation
  -> Client 360 billing updates
  -> reports include revenue/payment data
```

Recommended backend changes:

- Extend appointment API contract intentionally, or
- Keep appointment API clean and create billing record in a separate endpoint.

### P1 - Full database smoke testing is missing

Current automated tests are mostly policy/unit/build checks.

Missing:

- Fresh PostgreSQL setup test.
- Prisma migrate/seed test.
- Authenticated API workflow test.
- Full lead-to-billing integration smoke test.

Needed test flow:

```text
1. Start test PostgreSQL
2. Run Prisma migrate
3. Run seed
4. Start backend
5. Login as Dr. Revive
6. Create lead
7. Move to appointment proposed
8. Book appointment
9. Check in
10. Create treatment
11. Create prescription
12. Create invoice/payment
13. Verify analytics/dashboard updates
```

### P1 - Browser E2E tests are missing

Need Playwright or equivalent.

Critical E2E scenarios:

- Dr. Revive login and role access
- Receptionist login and restricted access
- Create lead
- Move lead through follow-up board
- Proposed lead appears in Appointments
- Book appointment
- Busy room conflict shows clear fix options
- Daily queue stage movement
- Client 360 treatment/prescription creation
- Billing invoice/payment

### P1 - Client Directory data rules need backend audit

Expected:

Client Directory should show all real clients who have appointment/checkup/consultation/treatment/prescription/billing data.

Risk:

Older data may not appear if it is not linked to current patient/client repository rules.

Needed:

- Audit patient repository.
- Audit seed data.
- Add backfill migration/script for existing treatment/appointment/prescription/billing records.
- Do not add dummy data.

### P1 - Cross-module data mapping needs tightening

Critical mappings:

- Lead -> Appointment
- Appointment -> Client
- Appointment -> Queue
- Queue -> Consultation
- Consultation -> Prescription
- Treatment package -> Session usage
- Treatment -> Billing
- Invoice -> Payment
- Payment -> Reports
- Follow-up -> Client retention

Needed:

Add service-level invariants and tests to prevent disconnected records.

### P2 - Staff/provider defaulting should move to backend

Because user-facing staff selectors were removed, hidden/default provider IDs are currently handled partly in frontend.

Better backend design:

- Service layer should infer authenticated actor or branch default provider.
- If no default exists, return clear setup error.
- Avoid requiring UI to send hidden staff IDs.

Needed backend improvements:

- Branch default provider setting.
- Clinical service fallback logic.
- Task service fallback to current user.
- Consent witness fallback to authenticated actor or configured branch witness.

### P2 - Package/rate master management

Current:

Packages/rates are seeded from provided PDF data.

Needed:

- Admin UI to manage package masters.
- Versioning or audit for rate changes.
- Ability to deactivate old package rates without deleting history.
- Billing should preserve historical rate used at sale time.

### P2 - WhatsApp integration implementation

Planned:

- Official Meta Cloud API.
- Utility/service conversations only initially.
- Appointment confirmations.
- Appointment reminders.
- Follow-up reminders.
- Payment reminders.

Needed:

- Meta Business setup.
- Phone number setup.
- Access token and webhook verification.
- Template sync.
- Opt-in/consent handling.
- Webhook event storage.
- Retry/dead-letter job worker validation.

### P2 - Website forms integration

Needed:

- Public backend deployment URL.
- `NEXT_PUBLIC_CRM_API_URL` on website should point to public CRM backend API, not localhost.
- Lead creation endpoint from website.
- Source tracking: Website, Google Ads, Meta Ads.
- UTM/campaign capture.
- Spam protection/rate limit.

### P2 - Reports/analytics validation

Need verify dashboard/report calculations after real workflow changes:

- New enquiries
- Active leads
- Proposed appointments
- Booked appointments
- Check-ins
- No-shows
- Treatments in progress
- Revenue
- Pending payments
- Lead conversion
- Retention

### P2 - Communication centre simplification

Earlier direction:

- Keep communication as a single tab/section for users.
- Advanced templates/broadcasts/integrations should not confuse clinic users.

Needed:

- Re-check UI after Meta setup.
- Hide non-working template/broadcast actions unless configured.
- Keep developer-only diagnostics separate.

### P3 - Legacy routes cleanup

Some removed pages still exist as redirects for compatibility:

- `/automations`
- `/settings/lead-scoring`
- `/settings/forms-consents`
- `/waitlist`
- `/today-queue`
- `/whatsapp-templates`
- `/whatsapp-broadcasts`

This is acceptable short-term.

Later:

- Remove if no internal links/bookmarks depend on them.
- Or keep redirects permanently for safe upgrades.

## 7. Technical caution areas

### Prisma enum cleanup

Do not casually remove old enum values from Prisma schema.

Reason:

- Existing database rows may use old enum values.
- PostgreSQL enum removal is migration-sensitive.
- Prisma migrations can fail if old data is not backfilled first.

Recommended approach:

1. Add mapping layer first.
2. Backfill old statuses.
3. Verify no rows use deprecated values.
4. Then plan enum cleanup migration.

### Encoding and line endings

One frontend build failure happened because of invalid UTF-8 source encoding.

Recommendation:

- Keep all TS/TSX/MD files UTF-8.
- Avoid mixed encoding edits.
- Run `npm run build --workspace revive-crm-frontend` before handoff.

### Do not rely only on TypeScript

Typecheck and lint passed even when Next production build failed due to source encoding.

Always run:

```text
npm run build --workspace revive-crm-frontend
```

before production deployment.

## 8. Suggested next developer plan

### Step 1 - Stabilize local database workflow

- Confirm PostgreSQL local setup.
- Run Prisma migrate.
- Run seed.
- Confirm package masters and users exist.

### Step 2 - Add API smoke tests

Create a script for:

```text
login -> create lead -> appointment proposed -> appointment booking -> queue -> treatment -> invoice
```

### Step 3 - Fix appointment billing persistence

This is the highest-value product fix because clinic revenue/payment data must be reliable.

### Step 4 - Add E2E tests

Use Playwright.

Start with:

- Login
- Lead creation
- Appointment booking
- Room conflict
- Client 360 treatment creation

### Step 5 - Move hidden staff defaulting to backend

Remove frontend responsibility for hidden provider IDs.

### Step 6 - Validate Client Directory backfill

Ensure real existing treatment/appointment/consultation data appears in Client Directory.

### Step 7 - Prepare external integrations

After backend is publicly hosted:

- Website forms
- Meta WhatsApp API
- Google Ads
- Meta Ads

## 9. Recommended release checklist

Before giving this to clinic staff:

- Fresh DB migrate/seed tested.
- Dr. Revive login tested.
- Receptionist login tested.
- Branch selector tested.
- Lead workflow tested.
- Proposed appointment workflow tested.
- Appointment booking and room availability tested.
- Daily queue tested.
- Client Directory tested with real records.
- Treatment creation tested.
- Prescription print tested with final logo/contact/timing.
- Billing invoice/payment tested.
- Analytics values verified.
- WhatsApp disabled/hidden unless configured.
- Developer-only integrations verified.

## 10. Current project health

Current state: usable development build with major workflow improvements complete.

Automated check status: passing.

Production readiness: not yet complete.

Main blockers for production:

1. Billing/payment persistence from appointment/package workflow.
2. Full database/API smoke tests.
3. Browser E2E tests.
4. Client Directory data backfill/mapping verification.
5. Public backend deployment for website/WhatsApp integrations.

## 11. Key documentation files

Developers should read these in order:

1. `docs/clinical-crm-workflow.md`
2. `docs/automated-testing-report-2026-07-31.md`
3. `docs/architecture.md`
4. `docs/environment.md`
5. `docs/website-form-integration.md`
6. `docs/whatsapp-cost-report.md`
7. This file: `docs/system-progress-and-roadmap-2026-07-31.md`

## 12. Final note for the next developer

This project has been actively reshaped based on real clinic workflow feedback. Many old generic CRM concepts still exist in code or enums for compatibility, but the product direction is now clinic-first.

When deciding between keeping a technically flexible feature and simplifying the clinic workflow, prefer the simpler clinic workflow unless the user explicitly asks for advanced configuration.

The most important principle:

```text
Do not mix sales leads with clinical clients.
```

Leads belong to enquiry/follow-up. Clients belong to appointments, queue, consultation, treatment, billing, and retention.
