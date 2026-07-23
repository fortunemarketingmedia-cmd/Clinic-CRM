# Phase 2 — CRM and Front Desk

Status: implemented in code; migration rehearsal remains required before deployment.

## Reused

- Existing Express route/controller/service/repository layering.
- Phase 1 Person, Lead, FollowUp, Task, TimelineEvent, AuditLog, UserBranch, and independent AppointmentStatus foundations.
- Existing appointment calendar and lead workspace.
- Existing branch selector, TanStack Query client, and reusable UI components.

## Refactored

- Appointment conflicts now compare occupied time intervals and buffers across doctors, therapists, rooms/resources, and equipment instead of only exact timestamps.
- Appointment status updates now use explicit transition rules and lifecycle timestamps.
- Confirmed appointments are marked no-show only after their end time, not at their start time.
- Appointment deletion is now a soft operational cancellation; source rows are retained.
- Lead and appointment queries enforce user-to-branch assignments.
- Branch lists are filtered to assigned branches for non-global roles.
- The existing lead list links to a full record profile.

## Database additions

- Explainable lead scoring: `LeadScoringRule`, `LeadScoreHistory`, `LeadScoreCategory`.
- Configurable appointment service definitions with duration, buffer, booking notice, cancellation window, and advance-payment settings.
- Branch resources for rooms, equipment, treatment chairs, and other bookable assets.
- Staff weekly schedules and date-range exceptions for breaks, leave, holidays, and blocked periods.
- Waitlist records with preference windows, status, notification/response tracking, and appointment linkage.
- Appointment practitioner/resource assignments, end time, operational timestamps, and cancellation/no-show/reschedule reasons.

The migration backfills appointment end times to 30 minutes, creates the shared Consultation service, creates four room resources per branch, maps historical `roomNumber` values, and inserts non-clinical default scoring rules.

## APIs

### Lead scoring

- `GET/POST /api/lead-scoring-rules`
- `PATCH /api/lead-scoring-rules/:id`
- `GET /api/leads/:id/score-history`
- `POST /api/leads/:id/recalculate-score`

### Front desk

- `GET/POST /api/front-desk/services`
- `GET/POST /api/front-desk/resources`
- `GET /api/front-desk/staff`
- `GET/POST /api/front-desk/schedules`
- `POST /api/front-desk/schedule-exceptions`
- `GET /api/front-desk/availability`
- `GET /api/front-desk/today-queue`
- `GET /api/front-desk/schedule-appointments`

### Waitlist

- `GET/POST /api/waitlist`
- `PATCH /api/waitlist/:id`
- `POST /api/waitlist/:id/book`

## Frontend routes

- `/leads/[id]` — full lead summary, score explanation, attribution, work counts, timeline, and guarded stage changes.
- `/today-queue` — Expected → Arrived → Waiting → With Doctor → Treatment → Billing → Completed.
- `/waitlist` — add, notify, accept, and book suitable entries.
- `/schedules` — practitioner availability and seven-day room/resource bookings.
- `/settings/lead-scoring` — administrator scoring-rule configuration.

The existing `/appointments` form now supports service duration, buffer, doctor, therapist, room/chair, and equipment assignments.

## Security and audit

- Lead, appointment, queue, waitlist, schedule, and resource reads validate branch entitlements.
- Lead-scoring rules are restricted to organisation/clinic administrators.
- Service/resource configuration is restricted to administrators; branch managers can configure schedules and exceptions for permitted branches.
- Scoring-rule, service, resource, schedule, exception, waitlist, appointment, and lead lifecycle mutations create audit events.

## Migration rehearsal

1. Complete the Phase 1 rehearsal first.
2. Apply `20260721170000_phase_2_crm_front_desk` to an isolated production-data copy.
3. Confirm every existing appointment has `endAt = appointmentAt + 30 minutes`.
4. Confirm all historical room bookings point to the corresponding branch room without changing `roomNumber`.
5. Compare appointment, lead, patient, invoice, payment, and file row counts before and after.
6. Run an overlap test for the same doctor, therapist, room, and equipment; each must return HTTP 409.
7. Verify adjacent appointments without buffers are accepted and appointments inside a buffer are rejected.
8. Review staff schedules and branch assignments before enabling online or receptionist booking.
9. Verify lifecycle transitions and reason requirements using a non-production branch.

## Remaining boundaries

- Duration-aware conflicts cover the configured resources introduced here; capacity-based group rooms are not yet modelled.
- Waitlist notification state is available, but actual WhatsApp delivery belongs to Phase 7.
- Appointment reminder jobs and cancellation/reschedule automation require the durable worker phase.
- Patient 360, doctor workspace, encounters, treatment plans, procedures, prescriptions, and clinical note locking begin in Phase 3.

