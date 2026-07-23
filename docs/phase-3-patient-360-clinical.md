# Phase 3 — Patient 360 and Clinical

Status: implemented and verified against an isolated PostgreSQL migration fixture. The migration has not been applied to a production database.

## Reused

- The unified `Person` and branch-access foundation from Phase 1.
- Phase 2 appointment lifecycle, doctor/therapist assignment, services, rooms, equipment, timeline, and immutable audit log.
- Existing `MedicalProfile`, `MedicalProfileVersion`, `Session`, embedded session prescriptions, packages, invoices, payments, and patient files.
- Existing Express layering, Zod validation, TanStack Query, application shell, and design-system components.

## Refactored safely

- Existing `Session` rows are preserved and backfilled into structured draft `ClinicalEncounter` records through `legacySessionId`.
- Structured prescription arrays on legacy sessions are preserved as draft `Prescription` and `PrescriptionItem` records.
- The historical session and patient endpoints remain available for backward compatibility.
- Receptionist and other non-clinical roles receive a redacted Patient 360 response and can no longer access session or clinical-file endpoints.
- Patient status has its own lifecycle enum and is not coupled to user-account status.
- Clinical notes become immutable after signing; further documentation is recorded through timestamped addendums.

## Database additions

- `ClinicalEncounter` and `ClinicalEncounterAddendum`
- `ClinicalTemplate`
- `TreatmentPlan` and `TreatmentPlanItem`
- `ProcedureSession`
- `Medicine`, `Prescription`, and `PrescriptionItem`
- Patient registration source, assigned doctor, primary concern, active status, last visit, and next visit
- Expanded medical profile fields and critical-alert support
- Independent encounter, treatment-plan, procedure, prescription, consent, acceptance, and patient lifecycle enums

The migration also installs SOAP, dermatology, hair-loss, laser, and aesthetic starter templates plus three medicine-master examples. These are configuration records, not hardcoded clinical decisions.

## Clinical rules

- New encounters and treatment plans begin as drafts.
- Draft or completed encounters can be signed by their doctor or an authorised clinic administrator.
- Signing writes signer/time metadata and locks the original content.
- Locked notes reject direct updates; authorised users must add an addendum.
- Treatment plans use guarded lifecycle transitions.
- Completed procedure sessions require verified consent.
- Completing a procedure linked to a treatment-plan item increments that item transactionally.
- Doctors may create and sign only prescriptions attributed to themselves; clinic administrators can perform supervised administrative signing.
- Clinical reads and mutations enforce branch entitlements and write audit events.

## APIs

- `GET /api/clinical/doctor-workspace`
- `GET /api/clinical/medicines`
- `GET /api/clinical/templates`
- `GET /api/clinical/patients/:patientId/360`
- `GET/POST /api/clinical/patients/:patientId/encounters`
- `PATCH /api/clinical/encounters/:id`
- `POST /api/clinical/encounters/:id/sign`
- `POST /api/clinical/encounters/:id/addendums`
- `GET/POST /api/clinical/patients/:patientId/treatment-plans`
- `PATCH /api/clinical/treatment-plans/:id`
- `GET/POST /api/clinical/patients/:patientId/procedure-sessions`
- `GET/POST /api/clinical/patients/:patientId/prescriptions`
- `POST /api/clinical/prescriptions/:id/sign`
- `GET /api/clinical/prescriptions/:id/pdf`

## Frontend routes

- `/patients/[id]` — Patient 360 header, medical alerts, complete timeline, medical version history, appointments, encounters, plans, procedures, prescriptions, packages, billing, files, and clinical quick actions.
- `/doctor-workspace` — today’s clinical queue, waiting patients, incomplete notes, plan reviews, and critical medical alerts.
- `/patients` retains the legacy operational patient workflow and now links to Patient 360.

## Migration rehearsal

1. Apply all Phase 0–2 migrations to an isolated copy first.
2. Apply `20260721200000_phase_3_patient_360_clinical`.
3. Confirm each legacy `Session` has exactly one `ClinicalEncounter` with a matching `legacySessionId`.
4. Compare the number and contents of legacy JSON prescription items with the backfilled prescription items.
5. Verify patient primary concern, registration source, assigned doctor, last visit, and next visit backfills.
6. Test signing a draft note, verify direct editing returns HTTP 409, and then add an addendum.
7. Confirm non-clinical roles receive no medical profile, encounters, procedures, prescriptions, or clinical files.
8. Confirm a clinician assigned only to one branch receives HTTP 403 for another branch.

## Phase boundary

Phase 4 will add the form/consent builder, e-signatures, signed PDFs, secure object-storage workflows, before/after gallery, and granular marketing permissions. Phase 3 stores attachment references and consent-verification state but does not pretend those Phase 4 capabilities already exist.
