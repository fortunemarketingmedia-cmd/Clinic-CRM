# Hostinger VPS production deployment

The production stack is designed for one Ubuntu Hostinger VPS. Docker Compose runs Caddy, the Next.js frontend, Express backend, PostgreSQL, private MinIO object storage, database migrations, and daily backups. Only TCP 80/443, UDP 443, and the chosen SSH port are public. PostgreSQL, MinIO, and application container ports stay on private Docker networks.

This is a production baseline, not a claim that deployment has no operational risk. DNS, secrets, provider accounts, restore testing, clinic acceptance, and ongoing monitoring require the deployment owner.

## 1. Size and prepare the VPS

Use Ubuntu 24.04 LTS (22.04 LTS is also supported), at least 4 vCPU, 8 GB RAM, and enough NVMe capacity for the database, patient files, backups, and 40% free headroom. Enable Hostinger snapshots, but do not treat a snapshot on the same provider as the only backup.

Create a non-root sudo user with an SSH key, disable password/root SSH login after verifying key access in a second terminal, and run:

```sh
sudo SSH_PORT=22 DEPLOY_USER="$USER" ./deploy/hostinger/bootstrap-ubuntu.sh
```

If SSH uses another port, supply it above. Log out and back in afterward. The script installs Docker, Compose, UFW, Fail2ban, unattended security updates, opens only SSH/HTTP/HTTPS, and creates `/opt/revive-crm` plus `/srv/revive-crm/backups`.

Merge `deploy/hostinger/docker-daemon.json.example` into `/etc/docker/daemon.json` to cap container logs; do not overwrite existing daemon settings blindly. Restart Docker during a maintenance window.

## 2. DNS and firewall

Keep the existing `www.reviveskinclinics.in` website unchanged. Add these two DNS A records at its current DNS provider and point both at the CRM VPS public IP:

- `crm.reviveskinclinics.in` — frontend
- `api.crm.reviveskinclinics.in` — backend

Remove any public DNS record for MinIO or PostgreSQL. Caddy obtains and renews TLS certificates automatically once DNS resolves and ports 80/443 reach the VPS.

## 3. Install the repository and secrets

Put the approved repository checkout in `/opt/revive-crm`. On the VPS only:

```sh
cd /opt/revive-crm
cp deploy/hostinger/.env.hostinger.example deploy/hostinger/.env.hostinger
chmod 600 deploy/hostinger/.env.hostinger
```

Replace every placeholder. Generate each security value independently; never reuse output:

```sh
openssl rand -base64 48  # JWT/signing/ingest secrets
openssl rand -base64 32  # FILE_ENCRYPTION_KEY and integration encryption
```

`FILE_ENCRYPTION_KEY` is the master key for patient documents. Back it up separately in an encrypted password manager or secret vault. Losing it makes stored patient files unrecoverable; leaking it requires a controlled key rotation and file re-encryption.

The PostgreSQL password appears both as `POSTGRES_PASSWORD` and URL-encoded inside `DATABASE_URL`. MinIO root credentials must be different from the S3 application credentials; startup creates a prefix-scoped, non-admin application identity automatically. Leave `COOKIE_DOMAIN` empty so the refresh cookie stays host-only, and use the exact HTTPS frontend/API URLs everywhere else.

Validate interpolation without printing the rendered config into support chats:

```sh
docker compose --env-file deploy/hostinger/.env.hostinger -f compose.production.yml config --quiet
```

## 4. First deployment

Run:

```sh
./deploy/hostinger/deploy.sh
```

The release script validates secret-file permissions and Compose configuration, pulls infrastructure images, builds the applications, starts PostgreSQL and MinIO, makes the file bucket private and versioned, takes a pre-migration backup, runs `prisma migrate deploy`, and starts the complete stack.

Inspect status and logs:

```sh
docker compose --env-file deploy/hostinger/.env.hostinger -f compose.production.yml ps
docker compose --env-file deploy/hostinger/.env.hostinger -f compose.production.yml logs --tail=200 backend frontend caddy database-backup file-backup
```

Do not run `prisma migrate reset`, `prisma db push`, or the demo seed in production.

## 5. Create the initial Admin

Run this once with a unique password, then remove the command from shell history if the shell retained it:

```sh
BOOTSTRAP_ADMIN_CONFIRM=CREATE_INITIAL_PRODUCTION_ADMIN \
BOOTSTRAP_ADMIN_NAME='Clinic Administrator' \
BOOTSTRAP_ADMIN_EMAIL='admin@reviveskinclinics.in' \
BOOTSTRAP_ADMIN_PASSWORD='unique-password-from-your-password-manager' \
BOOTSTRAP_BRANCH_NAME='Main Clinic' \
BOOTSTRAP_BRANCH_ADDRESS='Clinic address' \
BOOTSTRAP_BRANCH_PHONE='Clinic phone' \
docker compose --env-file deploy/hostinger/.env.hostinger -f compose.production.yml run --rm backend npm run bootstrap:admin
```

The command refuses to overwrite an existing account. Enroll MFA immediately.

## 6. Existing patient-file migration

Back up `backend/storage/private`, use the same production file-encryption key and MinIO settings, then run the controlled migration. It encrypts each file with AES-256-GCM before upload, records the plaintext SHA-256 in private metadata, skips verified matches, and never deletes the source:

```sh
cd backend
CONFIRM_FILE_MIGRATION=I_UNDERSTAND_PATIENT_FILES_WILL_BE_UPLOADED npm run storage:migrate:s3
```

Verify representative before/after photos, documents, prescriptions, consent PDFs, and invoices before removing the old source copy.

## 7. Backups and restore readiness

The `backup` service creates a verified PostgreSQL custom-format dump every 24 hours, retains 14 days by default, and mirrors encrypted MinIO objects to `/srv/revive-crm/backups/files/current`. Check it with:

```sh
sudo BACKUP_HOST_PATH=/srv/revive-crm/backups ./deploy/hostinger/verify-backups.sh
```

This local backup is not enough for a VPS failure. Sync `/srv/revive-crm/backups` at least daily to an encrypted destination in another provider/account and alert if it is stale. Also enable Hostinger snapshots. Before launch, restore the newest dump and file mirror into a disposable staging system and record the recovery time and evidence. Never discover whether backups restore during a real incident.

## 8. Release and rollback procedure

For every release:

1. Review and commit the intended changes; require CI to pass.
2. Pull the approved commit on the VPS.
3. Run `./deploy/hostinger/deploy.sh`; it takes a pre-migration backup.
4. Confirm both HTTPS endpoints, `/api/health`, login/MFA, appointment, upload/download, prescription/PDF, invoice print, and notifications.
5. Keep the previous Git commit and images available until acceptance is complete.

Application rollback is a checkout/build of the previous approved commit. Database rollback is not automatic: prefer additive, backward-compatible migrations. Restore a database only through the tested recovery procedure because it discards newer records.

## 9. Monitoring and maintenance

At minimum, alert on HTTPS failure, `/api/health` failure, container restart loops, backup age/failure, HTTP 5xx spikes, disk above 75%, memory pressure, certificate errors, and integration-job failures. Hostinger monitoring alone does not understand application health, so configure an external uptime/alert destination.

Monthly: install/reboot for security updates in a maintenance window, review audit logs and users, verify backups, check disk growth, and test one critical workflow. Quarterly: perform a disposable restore drill and dependency/security review.

The remaining human-owned launch items are tracked in [`go-live-manual-checklist.md`](./go-live-manual-checklist.md).
