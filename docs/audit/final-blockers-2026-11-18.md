# Revive Clinic CRM final blocker verification

18 November 2026 IST · `codex/production-readiness-audit` · baseline `473bdc5`

**Not ready for production.** The candidate removes MinIO from the production Compose stack and implements Receptionist account recovery. The live VPS still uses its existing MinIO installation. The managed storage cutover, provider sandbox checks, and live offsite recovery and alerting require further evidence. Production inspection was read-only. All application writes, file restores and account resets used synthetic records on isolated local services.

## Release gates

| Gate | Result | Evidence and remaining work |
| --- | --- | --- |
| S3-compatible file lifecycle | **PASS in staging** | Production app containers reached a freshly pulled SeaweedFS 4.53 server over TLS. Anonymous access was denied. ClamAV denied the inert EICAR string. The app uploaded and returned exact clean bytes through a signed link. AWS CLI used an independent read-only identity, which was denied upload. The recovered object matched the encrypted bytes. The correct AES-256-GCM key decrypted it and the wrong key failed. The application identity was denied read access to the recovery bucket. |
| Managed production object storage | **BLOCKED** | Production Compose now connects to a private managed S3 bucket, with Amazon S3 as the default endpoint and support for a configured HTTPS S3 endpoint. No dedicated managed staging bucket credentials were available. Verify bucket versioning, prefix IAM, server-side encryption, offsite retention and recovery using the approved bucket. Existing production objects require an approved copy and checksum comparison before switching the application. [Amazon S3 security practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html) · [SeaweedFS 4.53](https://github.com/seaweedfs/seaweedfs/releases/tag/4.53) |
| Payments | **BLOCKED for provider verification** | Local tests verified signed success and failure, invalid signatures, conflicting callbacks, replay, invoice idempotency and cash collection. The repository uses a signed callback contract. The gateway provider, its checkout and sandbox credentials were unavailable. Actual payment authorization, provider webhook retries, settlement and reconciliation remain open. |
| Email and WhatsApp | **BLOCKED for provider verification** | The live backend reports SMTP settings configured and WhatsApp credentials empty. The live SMTP credentials were excluded from testing. The earlier capture-inbox rehearsal covers an internal email path. Real email and WhatsApp delivery, templates, retries, bounce handling and provider failure remain unverified. |
| Staff recovery and session authorization | **PASS in regression and staging** | The Receptionist recovery command requires an active Receptionist and preserves MFA and branch assignments. It replaces the password, advances the stored session version and revokes refresh tokens in the same transaction. The old password, access token and refresh cookie returned 401. The new password succeeded and Finance remained 403. The assigned branch returned 200 and the other branch returned 403. Role-mismatched access tokens were rejected in regression. |

## Final build and regressions

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend unit | 72 | 0 | 0 |
| Frontend unit | 4 | 0 | 0 |
| HTTP integration and authorization | 255 | 0 | 0 |
| Redis integration | 2 | 0 | 0 |
| **Total** | **333** | **0** | **0** |

TypeScript, frontend and backend lint, frontend production build, Docker app and migration image builds, Compose interpolation, shell syntax and Git whitespace checks passed. Production npm audit reported **0** findings. The full audit reported **19** development dependency paths at high severity. The baseline audit traces these to Picomatch. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

The scanner's 1 GiB memory cap caused an out-of-memory kill during a concurrent signature reload in staging. The candidate now allocates 4 GiB and includes a scanner readiness probe in `/api/health`. A forced signature reload on the rebuilt stack kept readiness at 200 and recorded zero scanner OOMs and restarts. The live container's configured cap remains 1 GiB. [ClamAV container memory guidance](https://docs.clamav.net/manual/Installing/Docker.html#memory-ram-requirements)

## HTTPS staging and browser acceptance

| Check | Passed | Failed | Evidence |
| --- | ---: | ---: | --- |
| HTTPS HTTP smoke | 8 | 0 | Separate HTTPS origins. Cookie flags, CORS and CSRF, 413 request limit, schema-valid Receptionist invoice denial, ClamAV rejection, signed download, website intake, and QR registration through reschedule and cancellation. |
| Chrome acceptance | 35 | 0 | Admin and Receptionist at desktop and 390 px. Login and refresh, lead save and search, records, appointments, queue, follow-ups, and access denials. Added Admin prescriptions and PDF download, treatment and saved manual sitting, mobile public consent and invalid-link handling, invoice pagination, cash payment, print frame, and Receptionist consultation booking. |
| Recovery drills | 4 | 0 | Receptionist reset, Redis outage, PostgreSQL restore and managed-S3-compatible object recovery. |

Chrome's other-branch negative test returned the expected 403. Browser printing reached the invoice PDF and print frame. Physical printer output and clinic user acceptance remain open. The HTTP smoke covered rescheduling and cancellation. A full browser visual matrix for every workflow and clinic device remains outstanding.

The database restored to a separate synthetic database with matching row counts and content fingerprints across **100 tables**. The object mirror captured **19 encrypted objects** and the selected object restored byte-for-byte to a separate private bucket. The Redis outage returned 503 on readiness and API requests, then returned to 200 with zero backend restarts. No cached object service or simulated provider was used to establish a real integration pass.

## Hostinger read-only verification

| Check | Result | Observation on 18 November 2026 |
| --- | --- | --- |
| Public login and API health | **PASS** | Both returned HTTP 200 with successful TLS certificate verification. |
| Core CRM containers and host resources | **PASS at inspection** | CRM frontend, backend, worker, ClamAV, PostgreSQL, Redis and legacy object store were healthy with zero restarts. Root disk was 5% used. About 13.6 GiB of 15.6 GiB RAM was available. No CRM Docker ports were globally published. |
| Live PostgreSQL backup schedule and dump readability | **PASS** | 24-hour schedule with 14-day retention. Latest completed dump was **17 November 2026 10:07:43 UTC** and passed checksum and `pg_restore --list`. A live copy was neither transferred nor restored. |
| Live object backups | **PASS for recent sync; earlier failure recorded** | 24-hour schedule. Latest logged success was **17 November 2026 10:07:43 UTC**. A file backup failure was logged **16 November 2026 10:07:42 UTC**. The mounted mirror contained four files. A live snapshot pair and encryption-key recovery were not verified. |
| Production runtime configuration | **FAIL** | The backend connects to PostgreSQL with a superuser role. Live PostgreSQL 17.6, Redis 7.4.1 and archived MinIO images remain deployed. The candidate pins patched PostgreSQL and Redis and removes MinIO from the active Compose definition. A restricted runtime database identity and separate migration DSN require an approved production change. |
| Offsite backup, Hostinger snapshots, uptime monitoring and alert delivery | **UNVERIFIED** | No CRM offsite backup container was running. No matching monitoring service or timer was visible from the inspected host account. External control-plane schedules, alert recipients and delivery require access to their dashboards or owner-provided evidence. |

## Deployment and rollback checklist

1. Complete the open provider and browser checks and review the exact release diff. Obtain explicit approval to commit and deploy. Record the release and rollback image digests and the running deployment SHA.
2. Provision the private managed staging and production buckets and separate S3 identities. Verify policy using allowed and denied requests. Verify offsite backup, encryption-key custody and restore before approving changes to the live store. [Storage and backup configuration](../deployment.md#3-install-the-repository-and-secrets)
3. Review PostgreSQL upgrade notes. Prepare the restricted runtime identity and the separate `MIGRATION_DATABASE_URL`. Rehearse reconnect, migration and rollback with both database identities on synthetic data. [PostgreSQL 17.12 release notes](https://www.postgresql.org/docs/release/17.12/)
4. In the approved maintenance window, pause clinic writes and outbound jobs. Take matching database and object backups and verify offsite copies. Copy production objects to the approved bucket only with explicit approval. Compare inventories and checksums and confirm downloads with the original encryption key. Preserve the existing MinIO volume.
5. Validate production Compose and apply tracked migrations in order. `20261117120000_patient_number_by_year` precedes `20261117180000_financial_idempotency`, then `20261118120000_staff_session_version`. Start the approved app images only after migration and storage preflight complete. Confirm HTTPS, both roles, Receptionist invoice 403, downloads, scans, backed-up file marker, provider settlement and alert delivery before reopening traffic.
6. For rollback, pause writes and jobs, preserve logs, restore the prior approved app configuration and image digests and verify storage continuity. Reconcile writes received by the new bucket before switching storage back. Leave additive columns in place. If reverting to an app that predates session version checks, rotate the JWT signing secrets during the approved rollback to invalidate older sessions. Keep the data-encryption key unchanged. [Hostinger runbook](../deployment.md#8-release-and-rollback-procedure)

The branch remains uncommitted. No production data, credentials, server configuration or deployment state was changed.
