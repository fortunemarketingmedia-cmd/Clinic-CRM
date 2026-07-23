# Phase 4 — Forms, Consents, and Secure Files

Status: implemented and verified through a clean migration rehearsal, seed run, unit tests, production builds, and end-to-end API checks against an isolated PostgreSQL database. The migration has not been applied to a production database.

## Delivered

- Administrative form builder for every master-prompt form type, with text, number, date, choice, checkbox, signature, upload, image, and declaration fields.
- Required, hidden, read-only, conditional, choice-option, ordering, draft, publish, archive, and new-version controls.
- Immutable `FormTemplateVersion` snapshots; every submission points to the exact version completed.
- Published patient-registration forms power the public QR intake page while retaining the legacy fallback.
- Versioned consent builder with guardian, staff-witness, expiry, language, and publication rules.
- Canvas e-signatures, signer/device/IP metadata, immutable signed consent content, withdrawal history, and generated signed PDFs.
- Secure clinical-photo and document storage using opaque storage keys, private filesystem permissions, checksums, MIME/content validation, and five-minute HMAC access URLs.
- Clinical-only, care-team, administrative, and patient-visible file scopes with role-aware access.
- Before/after gallery metadata for visit date, treatment area, angle, annotations, clinical use, and marketing use.
- Side-by-side comparison and watermarked export. The export is generated from the originals without overwriting them.
- Marketing use requires an active, unexpired signed marketing consent record. Withdrawal immediately prevents new marketing-approved uploads.
- Legacy data-URL file rows are preserved and backfilled with secure-storage metadata; no permanent public URLs are returned by the new APIs.

## Main database additions

- `FormTemplate`, `FormField`, `FormTemplateVersion`, and `FormSubmission`
- `ConsentTemplate`, `ConsentTemplateVersion`, and `ConsentRecord`
- File type, visibility, photo angle, storage key, checksum, uploader, consent permissions, visit metadata, annotation, and original-file lineage on `PatientFile`
- Relations from patients, appointments, clinical encounters, procedures, branches, and users

The migration seeds a published 21-field patient-registration form and published general-treatment, photography, and marketing consent templates with immutable version-one snapshots.

## APIs

- `GET/POST /api/forms/templates`
- `PATCH /api/forms/templates/:id`
- `POST /api/forms/submissions`
- `GET /api/forms/patients/:patientId/submissions`
- `GET/POST /api/consents/templates`
- `PATCH /api/consents/templates/:id`
- `POST /api/consents/sign`
- `GET /api/consents/patients/:patientId`
- `POST /api/consents/:id/withdraw`
- `GET /api/consents/:id/pdf`
- `GET/POST /api/files`
- `GET /api/files/:id/content?token=...`

Existing `POST /api/patients/:patientId/files` remains compatible but now writes through the secure storage service and returns an expiring access URL.

## Frontend

- `/settings/forms-consents` — build, publish, archive, and version forms and consents.
- `/qr/[token]` — dynamically renders the published registration template.
- `/patients/[id]` — Forms & Consents, Photo Gallery, and Documents tabs in Patient 360.

## Deployment configuration

- `FILE_STORAGE_ROOT` optionally selects the private storage root. The default is `backend/storage/private`.
- `FILE_ACCESS_SECRET` optionally separates file-link signing from the JWT signing secret and must be at least 16 characters.
- The storage service is an adapter boundary. Production deployments can replace the private filesystem implementation with S3-compatible private object storage while keeping opaque keys and short-lived access semantics.
- The storage directory must remain outside any public web root and must be included in encrypted backups.

## Verification performed

- Replayed the Phase 4 migration over the Phase 3 schema with a legacy data-URL file fixture.
- Confirmed one registration template, 21 fields, one immutable form snapshot, three consent templates, and three consent snapshots.
- Ran the application seed successfully after migration.
- Verified required-field rejection, successful submission against version one, and publication of version two without changing the recorded submission version.
- Verified witnessed signing, PDF generation, secure upload, signed-link retrieval, token tamper rejection, marketing-consent enforcement, and withdrawal enforcement.
- Verified malformed image content is rejected before storage or PDF rendering.
- Passed Prisma validation, backend TypeScript build and lint, 16 backend policy tests, frontend typecheck and lint, and the 22-route production build.

## Phase boundary

Phase 5 builds billing and packages on this foundation. Inventory and procurement move to Phase 6: product catalogue, branch stock, batches and expiry, purchase orders, suppliers, consumption, transfers, adjustments, alerts, and stock audit trails.
