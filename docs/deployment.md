# Hostinger local-storage deployment

The current release candidate uses the existing VPS, host Nginx, PostgreSQL, Redis, API, frontend, worker, ClamAV, a private Docker file volume and encrypted Restic backups. Existing websites and certificates retain their current Nginx configuration. Production object storage is local. The S3-compatible adapter supports an approved future Cloudflare R2 migration.

The deployment requires explicit approval. The live stack still uses its original file store. Copying files, changing database permissions, installing timers and switching traffic are live changes.

## Environment and capacity

Use the measurements and verdict in the [local VPS release report](audit/hostinger-local-release-2026-11-18.md). Reserve capacity for other hosted applications. ClamAV receives 4 GiB for signature reloads. API, worker and frontend use up to 1 GiB each. PostgreSQL uses 2 GiB, Redis 320 MiB, and backup jobs 512 MiB each.

Copy the environment example into the protected live checkout and replace its values through the secret manager. Keep mode 0600. POSTGRES_USER owns migrations. DATABASE_URL uses the restricted revive_runtime identity and a 12–15 connection pool. MIGRATION_DATABASE_URL uses the separate owner. The API and worker environment allowlists exclude the migration DSN and owner credentials.

Set FILE_STORAGE_PROVIDER=local and FILE_STORAGE_ROOT=/private-files. Preserve the existing FILE_ENCRYPTION_KEY. The patient_files named volume mounts into the API, worker, migration tools and read-only local backup. File and directory modes are 0600 and 0700. Runtime UID is 1000.

Keep PAYMENT_GATEWAY_ENABLED, EMAIL_ENABLED and WHATSAPP_ENABLED false until their providers are verified. Staff can record cash, UPI, card and bank payments manually. No gateway credential is required for this configuration.

## Independent backup prerequisite

Set LOCAL_BACKUP_PASSWORD to a separate strong repository password. Store it and the file-encryption key outside the VPS in the approved secret manager. Configure RESTIC_REPOSITORY as an independent SFTP repository and set a different RESTIC_PASSWORD. Mount a pinned-host-key SSH configuration and backup-only key at OFFSITE_SSH_DIR.

PostgreSQL dumps use gzip level 6. Restic deduplicates and encrypts the dumps and file volume. The local repository is /backups/private-restic. Offsite backup copies its authenticated snapshots into the independent repository. Initialize that repository only after its destination and host key are verified and approved.

    dc() { docker compose --env-file deploy/hostinger/.env.hostinger -f compose.production.yml "$@"; }
    dc --profile offsite run --rm --no-deps --entrypoint restic offsite-backup init

A folder or volume on the primary VPS cannot satisfy disaster recovery. Missing independent restore or key-recovery evidence blocks approval.

## Approved cutover

Run from the approved release checkout. Record previous application image digests and protected configuration. Keep the live Compose project name unchanged to preserve its PostgreSQL volume.

1. Pause clinic writes and outbound workers in the maintenance window. Preserve matching database and encrypted-file backups with verified offsite copies.
2. Copy existing private objects into patient_files using a separate protected migration environment and the original encryption key and key prefix. Never mount production files into test containers.
3. Apply migrations, grant the restricted role, verify the local file inventory, take the encrypted snapshot and start applications.
4. Verify both roles, clinical and financial records, original images, signed documents, malware rejection, private downloads, HTTPS, backup age and alert delivery before reopening traffic.

The file utility defaults to verification. It inventories referenced files, signatures and consent PDFs, authenticates encrypted bytes and available database hashes, preserves source objects and retains record associations. Prepare the migration image with the original private source connection and explicitly mounted destination volume.

    dc build migrate
    dc --profile tools run --rm --no-deps migrate node scripts/transfer-private-files.mjs to-local
    dc --profile tools run --rm --no-deps -e CONFIRM_FILE_MIGRATION=I_UNDERSTAND_PATIENT_FILES_WILL_BE_COPIED migrate node scripts/transfer-private-files.mjs to-local --copy
    dc --profile tools run --rm --no-deps migrate node scripts/transfer-private-files.mjs verify-local

Keep source credentials confined to the temporary migration environment. The API and worker remain on local storage.

    chmod 600 deploy/hostinger/.env.hostinger
    docker compose --env-file deploy/hostinger/.env.hostinger -f compose.production.yml config --quiet
    ./deploy/hostinger/deploy.sh

The script applies tracked migrations, runs restricted-role SQL, sets file-volume ownership, verifies referenced local files and takes a local encrypted snapshot before starting applications. It preserves old orphaned storage services and volumes. Remove those only through an approved cleanup after acceptance. Missing or corrupt referenced files stop deployment.

Migration order follows the earlier chain, then 20261117120000_patient_number_by_year, 20261117180000_financial_idempotency, 20261118120000_staff_session_version and 20261118140000_file_stored_size. These changes are additive. Existing stored-byte counts remain null until measured.

## Backups, monitoring and restore

    dc run --rm --no-deps database-backup once
    dc run --rm --no-deps file-backup once
    dc --profile offsite run --rm --no-deps offsite-backup once
    LOCAL_BACKUP_PASSWORD="$LOCAL_BACKUP_PASSWORD" BACKUP_HOST_PATH=/srv/revive-crm/backups ./deploy/hostinger/verify-backups.sh
    dc --profile offsite up -d offsite-backup

Backups run daily. Retention is 14 daily, eight weekly and 12 monthly Restic snapshots. Local and independent integrity checks complete before success markers advance. Dumps and snapshots require at least 10 GiB free space before writing to the shared VPS disk.

The monitor checks marker freshness, required containers, HTTPS and disk use above 75%. Install the supplied service and timer only during the approved deployment. Configure HEALTH_URL, BACKUP_HOST_PATH, HOSTINGER_ENV_FILE and the approved ALERT_WEBHOOK_URL in /etc/revive-crm/monitor.env.

    sudo install -m 0644 deploy/hostinger/revive-monitor.service deploy/hostinger/revive-monitor.timer /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now revive-monitor.timer
    sudo systemctl start revive-monitor.service

Verify an alert reaches its recipient. Configure independent external uptime monitoring, since a monitor on the VPS cannot report total VPS failure.

Restore into a new private directory and database. Retrieve the snapshot's dump and files, restore the PostgreSQL dump and verify table fingerprints and file downloads with the independently recovered encryption key.

    dc run --rm --no-deps --entrypoint restic file-backup snapshots --host revive-crm
    dc run --rm --no-deps --entrypoint restic file-backup restore latest --host revive-crm --target /backups/recovery-drill --verify

Repeat the drill from the independent repository and record elapsed recovery time.

## Staff recovery

Apply the session-version migration first. An authorized operator verifies employee identity, then resets the password using the documented command. Recovery revokes old API and refresh sessions, audits the event and preserves Receptionist MFA and branches. Passwords require 14 characters and at most 72 UTF-8 bytes.

    read -r -s -p 'New Receptionist password: ' RESET_RECEPTIONIST_PASSWORD
    export RESET_RECEPTIONIST_CONFIRM=RESET_EXISTING_PRODUCTION_RECEPTIONIST
    export RESET_RECEPTIONIST_EMAIL='staff@clinic.invalid'
    export RESET_RECEPTIONIST_PASSWORD
    dc run --rm --no-deps -e RESET_RECEPTIONIST_CONFIRM -e RESET_RECEPTIONIST_EMAIL -e RESET_RECEPTIONIST_PASSWORD backend npm run reset:receptionist-password
    unset RESET_RECEPTIONIST_PASSWORD RESET_RECEPTIONIST_EMAIL RESET_RECEPTIONIST_CONFIRM

Admin recovery uses RESET_ADMIN_CONFIRM=RESET_EXISTING_PRODUCTION_ADMIN, RESET_ADMIN_EMAIL, RESET_ADMIN_PASSWORD and npm run reset:admin-password. Only Admin recovery supports the separate explicit MFA-removal override. Deliver replacements through the clinic's secure credential channel.

## Future R2 migration

Local storage remains active. Future R2 uses FILE_STORAGE_PROVIDER=s3, the account's HTTPS R2 endpoint, region auto, the same key prefix, and S3_SERVER_SIDE_ENCRYPTION=none. Application AES-256-GCM encryption remains active.

    dc --profile tools run --rm --no-deps migrate node scripts/transfer-private-files.mjs to-r2
    dc --profile tools run --rm --no-deps -e CONFIRM_FILE_MIGRATION=I_UNDERSTAND_PATIENT_FILES_WILL_BE_COPIED migrate node scripts/transfer-private-files.mjs to-r2 --copy

The verified copy skips matching encrypted bytes and resumes without changing database associations. Rerun it while local uploads continue. Freeze writes during final inventory and copy, verify zero missing or failed objects, and switch only after approval. Retain local copies. Before rollback after R2 accepted new files, freeze writes and run the approved to-local copy, then verify the complete local inventory.

The R2 connection remains unverified until tested with an actual R2 account. [Cloudflare conditional operations](https://developers.cloudflare.com/r2/api/s3/conditional-operations/)

## Rollback

Pause writes and jobs and preserve the failed state and logs. Restore approved previous image digests and protected configuration and verify continuity. Keep additive database columns.

The new text-compression envelope requires the candidate decoder. An older application lacking it must use the matching pre-release database and file snapshot or an explicitly tested forward recovery. Reconcile writes created after the snapshot before switching restored data into service.

An application predating session-version checks requires JWT secret rotation during the approved rollback. Preserve the file-encryption key.

Before release, tag the recorded API, worker and frontend images for rollback. Put those three tags in a protected rollback Compose override under their matching service names. The following command uses the prior configuration and only replaces the application services, leaving the patched infrastructure and volumes in place.

    docker compose -p revive-crm --env-file "$PREVIOUS_ENV" -f "$PREVIOUS_COMPOSE" -f "$ROLLBACK_IMAGES" \
      up -d --no-deps --no-build backend worker frontend

Use a separate staging project or recovery server for data restoration. With its PostgreSQL admin configured, restore the selected matching backup into a new database.

    createdb revive_recovery_review
    pg_restore --exit-on-error --no-owner --no-privileges --dbname=revive_recovery_review "$VERIFIED_DUMP"
