# Revive Clinic CRM Go-Live Manual Checklist

These actions require infrastructure access, clinic policy decisions, or secret rotation and cannot be completed safely by source-code changes alone.

## 1. Secrets and account security

- Generate independent random values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `FILE_ENCRYPTION_KEY`, `FILE_ACCESS_SECRET`, `GOOGLE_ADS_INGEST_SECRET`, and `META_ADS_INGEST_SECRET` in an encrypted password manager/secret vault. Use at least 48 random bytes for JWT and signing secrets and exactly 32 random bytes (base64 encoded) for patient-file encryption.
- Do not copy values from `.env.example`, reuse one value for multiple variables, commit production `.env` files, or paste secrets into tickets/chat.
- Rotate the current placeholder JWT secrets before exposing the backend. This signs every user out.
- Force MFA re-enrollment for accounts whose TOTP secret was protected using the previous fallback key. Existing recovery codes must be replaced.
- Confirm HTTPS-only cookies and that `FRONTEND_URL`, `FRONTEND_URLS`, and `BACKEND_PUBLIC_URL` match the final domains. Keep `COOKIE_DOMAIN` empty for a host-only refresh cookie unless a reviewed requirement proves otherwise.
- Create production Admin/Receptionist accounts through an approved bootstrap process. Do not run the demo seed. Production seeding is now blocked unless an explicit one-time override is supplied.

## 2. Staff authorization decision

- Decide how doctors authenticate. Clinical encounters, prescriptions, and medical profiles currently require the `ADMIN` access level.
- If doctors must not be administrators, approve a separate clinical access level and permission matrix before launch. This requires a schema/API/frontend authorization migration and acceptance testing.
- Decide whether Inventory ships in the first release. Its backend remains deliberately unmounted because there is no production frontend and the current three-level access model has no inventory-specific permission. If it ships, approve who can view stock, adjust stock, approve purchase orders, and receive/transmit stock.

## 3. Hostinger VPS infrastructure

- Provision a supported Ubuntu Hostinger VPS, SSH-key-only non-root administration, DNS, UFW, Fail2ban, unattended security updates, Docker log rotation, disk alerts, and Hostinger snapshots.
- Confirm Compose exposes only 80/443; PostgreSQL, MinIO, backend, and frontend must have no public host port.
- Baseline the existing database's Prisma migration history before relying on `prisma migrate deploy`; the current local database predates the recorded migration chain.
- Run the included private MinIO storage with application-level AES-256-GCM file encryption, run `npm run storage:migrate:s3` for old files, and verify signed-link access before switching traffic.
- Replicate `/srv/revive-crm/backups` to a different provider/account. Complete and document a disposable PostgreSQL plus object-file restore before launch.
- Keep the current in-memory rate limiter only for a single backend process. Before adding a second replica, deploy Redis-backed shared rate limiting.

## 4. External integrations

- Configure the Google/Meta server-to-server caller to send `x-lead-ingest-secret` using its matching source secret. Never expose these secrets in browser JavaScript.
- Register live Meta/Google applications, webhook subscriptions, OAuth redirects, business verification, ad accounts, conversion actions/datasets, and least-privilege credentials.
- Test webhook signatures, duplicate-event handling, ad-lead attribution, WhatsApp templates, and failure/retry behavior in provider sandboxes.

## 5. Operations, compliance, and validation

- Send structured application logs and alerts to the selected monitoring provider; configure an on-call recipient and test a real alert.
- Perform a disposable database restore and object-storage restore. Record recovery time, recovery point, owner, and evidence.
- Approve retention/deletion periods for patient data, photos, consent records, audit logs, and backups with the clinic's legal/compliance owner.
- Complete penetration testing, privacy/legal review, and clinic user-acceptance testing using Admin, Receptionist, and the approved doctor workflow.
- Verify the Admin can query `/api/audit` and that sensitive operations produce expected audit records.
- Run production smoke tests: login/MFA, branch isolation, lead-to-patient conversion, appointment, prescription/PDF, upload/download, GST and non-GST invoice, full payment through every supported method, analytics, logout, and backup monitoring.

## Launch approval

Production traffic should start only after every item above has an owner, completion date, and evidence link. Record any accepted exception with risk owner and expiry date.
