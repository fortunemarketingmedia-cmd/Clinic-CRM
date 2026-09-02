# Revive Clinic CRM

Internal clinic CRM and practice-management platform covering identity, CRM/front desk, Patient 360/clinical care, forms, consents, secure files, advertising integrations, automation, reporting, and security operations. Clinic-facing analytics covers leads, patients, appointments, follow-ups, branches, and financial records.

- `ADMIN`: cross-branch control, clinic configuration, automation, reports, forms, and staff access.
- `RECEPTIONIST`: branch-scoped clinic operations and operational reports.

These are the only effective login access levels. Historical staff job classifications are normalized to Receptionist permissions at authentication. There is no patient login or patient-facing role.

See [Phase 2 CRM and front-desk delivery](docs/phase-2-crm-front-desk.md) for the new APIs, migration rehearsal, and current boundaries.

See the [complete CRM operating guide](docs/crm-operating-guide.md) for the daily workflow, purpose of every page, Tasks versus Follow-ups, and data-visibility rules.

See [Phase 3 Patient 360 and clinical delivery](docs/phase-3-patient-360-clinical.md) for clinical permissions, note-locking rules, legacy backfills, APIs, and deployment checks.

See [Phase 4 forms, consents, and secure files](docs/phase-4-forms-consents-files.md) for template versioning, e-signatures, storage security, gallery behavior, marketing-consent rules, APIs, and verification evidence.

See [Phase 8 advertising integrations](docs/phase-8-advertising-integrations.md), [Phase 10 automation and reporting](docs/phase-10-automation-reporting.md), and [Phase 11 security and operations](docs/phase-11-security-operations.md). Phase 9 is intentionally excluded because this is a clinic-operated platform with no patient account.

## Structure

```text
revive-crm
├── frontend
├── backend
└── docs
```

## Build Order

1. Project setup
2. Authentication
3. Branch module
4. Users
5. Dashboard
6. Leads
7. Appointments
8. Patients
9. QR registration
10. Patient profile
11. Sessions
12. Files and consents
13. Advertising integrations
14. Automation and reporting
15. Security and production operations

## Core Rule

A lead is not a patient. A patient is created only after arrival, profile completion, or consultation.

## Production Standard

See [docs/production-readiness.md](docs/production-readiness.md) for the quality rules this project should follow as each phase is built.

For the complete Hostinger VPS stack—containers, private PostgreSQL/MinIO, encrypted patient files, automatic HTTPS, backups, database migrations, secure Admin bootstrap, and release steps—see [docs/deployment.md](docs/deployment.md).
