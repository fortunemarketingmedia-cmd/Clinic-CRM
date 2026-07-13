# Revive Clinic CRM

First-version CRM scaffold for Revive Clinic, built around two roles:

- `ADMIN`: full control across both branches.
- `RECEPTIONIST`: day-to-day operations with branch toggle access, without analytics, settings, users, or system configuration.

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
12. Billing
13. Packages
14. Files
15. WhatsApp
16. Analytics
17. Settings

## Core Rule

A lead is not a patient. A patient is created only after arrival, profile completion, or consultation.

## Production Standard

See [docs/production-readiness.md](docs/production-readiness.md) for the quality rules this project should follow as each phase is built.
