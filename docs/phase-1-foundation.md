# Phase 1 Foundation

Status: implemented in code; database migration must be rehearsed against a production-data copy before deployment.

## Delivered

- Stable `Person` identity with normalised contact lookup and repeat-enquiry linking.
- One Person to many Leads and one optional Patient profile.
- Correct CRM stages plus a compatibility window for legacy lead stage values.
- Independent appointment lifecycle and historical status mapping.
- Lead owner, next action, due date, score, qualification, loss, disqualification, and conversion fields.
- Stage policy enforcing owner/next-action invariants and required terminal-stage reasons.
- Dedicated Follow-up and Task records and authenticated queue APIs.
- User-to-branch assignments with central branch access checks for new work queues.
- Expanded role enum and restricted medical-profile mutation.
- Medical-profile snapshots on every authenticated profile update.
- Append-only audit records for authentication, people, leads, follow-ups, and tasks.
- Grouped navigation with live Follow-ups, Tasks, and Audit Log pages.

## API additions

All routes require bearer authentication unless stated otherwise.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/people` | Search/list central identities |
| POST | `/api/people` | Create a person after exact-match checking |
| GET | `/api/people/duplicates/search` | Exact normalised contact lookup |
| GET | `/api/people/:id` | Person, enquiries, and patient link |
| POST | `/api/people/:id/merge` | Admin safe merge; refuses two-patient conflicts |
| GET | `/api/follow-ups` | Branch/assignee/status/due-date queue |
| POST | `/api/follow-ups` | Create follow-up |
| POST | `/api/follow-ups/:id/complete` | Complete with a required resolution |
| GET | `/api/tasks` | Branch/assignee/status/due-date queue |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update/complete task |
| GET | `/api/audit-logs` | Restricted audit history |

Existing Lead APIs remain available. Lead creation now links an existing exact-match Person instead of rejecting repeat enquiries. Appointment APIs now return the independent `AppointmentStatus` values.

## Migration rehearsal

1. Restore a recent production backup into an isolated PostgreSQL database.
2. Record row counts for User, Branch, Lead, Patient, Appointment, Invoice, Payment, Session, and PatientFile.
3. Apply migrations with `npx prisma migrate deploy` from `backend`.
4. Verify every Patient has `personId` and its originating Lead has the same `personId`.
5. Verify every Lead has `personId`, `ownerId`, `nextAction`, and `nextActionDueAt`.
6. Review exact-mobile groupings; the migration does not perform fuzzy or silent merges.
7. Verify Appointment mapping: booked becomes scheduled, arrived becomes checked-in, postponed becomes rescheduled, and not-arrived becomes no-show.
8. Verify all existing users have branch assignments, then narrow staff access using an approved branch matrix.
9. Compare the recorded row counts; no source operational rows should decrease.
10. Run backend tests/build/lint and the frontend production build against the migrated copy.

## Rollback

Rollback is a controlled SQL migration, not `migrate reset`:

1. Stop application writes and take a fresh backup.
2. Convert `Appointment.status` back to `LeadStatus` with the inverse mapping.
3. Drop new foreign keys, indexes, foundation tables, and additive columns.
4. Drop the new standalone enums. Retain the added `LeadStatus`/`Role` enum values because PostgreSQL enum-value removal requires a type rebuild and provides no operational benefit.
5. Deploy the previous application version and compare source-table row counts.

Do not use destructive reset commands on production or a database containing clinic records.

## Known Phase 1 boundaries

- Merge refuses records when both Persons already own Patient profiles; that needs a reviewed clinical/financial merge transaction and undo ledger.
- Legacy Lead status values remain readable during the frontend/API transition.
- Existing older modules still need the branch-access policy applied endpoint by endpoint; the new People/work/audit foundation is ready for that refactor.
- Appointment resource conflicts still use the existing point-slot algorithm. Duration/practitioner/resource calendars belong to Phase 2.
- Integration webhooks, queues, encrypted secrets, official WhatsApp, clinical encounters, package ledger, and finance/inventory splits are later phases.

