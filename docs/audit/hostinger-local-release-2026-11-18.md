# Revive Clinic CRM local-storage release report

18 November 2026 IST · codex/production-readiness-audit · baseline 473bdc5

**NOT READY.** The local-storage candidate passed the isolated production-build rehearsal. No approved independent backup repository or alert destination was available, so an offsite restore and alert delivery could not be verified. The live storage cutover and runtime role change remain pending deployment approval. This report supersedes the managed-object-storage proposal in the earlier verification reports.

## Architecture and VPS capacity

Host Nginx serves the CRM frontend and Node API over HTTPS while preserving the other sites. Docker Compose runs the API, frontend, worker, PostgreSQL, Redis, ClamAV, and backup services. The worker uses PostgreSQL for durable jobs and Redis supports cache and rate limiting. PostgreSQL and Redis stay on a private network. The primary patient file store is a private named Docker volume. The release uses no external production object-storage service.

| Resource | Actual VPS observation | Candidate limit or plan |
| --- | --- | --- |
| CPU | 4 cores | Per-container caps. Database 2, API/worker/frontend 1.5 each, scanner 1.0, Redis 0.5 and backups 0.5–0.75. Shared capacity allows bursts. |
| RAM | 15.62 GiB total, 13.59 GiB available, zero swap | Approximately 10.8 GiB in combined container limits. Scanner 4 GiB, PostgreSQL 2 GiB, app services 1 GiB each, Redis 320 MiB and three 512 MiB backup limits. |
| Disk | 200G non-rotational virtual disk. Filesystem 193 GiB, 9.4 GiB used, 184 GiB available, 5% used | Backup floor 10 GiB, disk alert at 75%. Capacity is shared with other applications. |
| Existing footprint | CRM PostgreSQL dump directory 7.4 MiB, file mirror 280 KiB, legacy object volume 556 KiB | Confirm growth and backup retention from live utilization after an approved release. |

Read-only Docker samples showed live frontend, API and worker at about 64, 125 and 122 MiB, PostgreSQL at 53 MiB, Redis at 13 MiB and ClamAV at 964 MiB under its current 1 GiB cap. Other website containers were running and were left alone. A previous rehearsal reproduced an OOM at that scanner cap. The 4 GiB candidate reservation follows the upstream reload recommendation. [ClamAV Docker guidance](https://docs.clamav.net/manual/Installing/Docker.html#memory-ram-requirements)

Live checkout is /srv/apps/projects/revive-crm. The existing database uses revive-crm_postgres_data and the old file store uses revive-crm_minio_data. Keep both intact through cutover and rollback acceptance. Earlier read-only inspection confirmed healthy public HTTPS, a database dump that passed checksum and catalog verification, a subsequent successful file backup after a failure, and a PostgreSQL superuser as the live API identity. No independent restore evidence was available. [Earlier VPS observations](final-blockers-2026-11-18.md#hostinger-read-only-verification)

## Database and security

The candidate grants ordinary table reads and writes plus sequence usage to revive_runtime and denies schema creation and access to Prisma migration history. It caps that role at 40 connections. Separate owner credentials apply migrations, and the API and worker allowlists exclude them. At startup both services reject a privileged database identity. Staging authenticated through the restricted role, denied create-table and migration-history probes, and rejected the owner identity. PostgreSQL 17.12 ran from the pinned image. Staging sampled 14 database connections during the load rehearsal.

The staging suite verified receptionist financial denial, branch isolation, cookie refresh, logout, versioned session revocation, operator recovery and rate limiting. A valid Receptionist invoice request returned 403 and the same Admin workflow returned 201. The production-build application denied anonymous downloads and denied a receptionist from another branch. It revalidates actor and branch permissions at download time. The URL route and file IDs remain stable.

Local uploads spool multipart data into private temporary storage, enforce file size and type, and scan before storage. Base64 uploads remain bounded and are scanned too. The application encrypts stored bytes using authenticated AES-256-GCM and uses exclusive atomic file publication. The named volume is separate from public paths. Original file sizes and stored sizes are recorded separately. Downloads verify the encrypted content in private tmpfs before streaming it to the browser. The image worker and compatibility adapter still use bounded buffers. Production keys remain operator-managed.

| Synthetic file test | Result |
| --- | --- |
| Repetitive text document | 80,000 original bytes, 350 encrypted stored bytes. Download and restore returned exactly the original bytes. |
| 1200×800 clinical PNG | All 606,499 original bytes preserved. The worker produced 320 px, 800 px and 1200 px WebP derivatives at 5,456, 14,106 and 22,468 bytes. All decoded. |
| Signed PDFs, originals and unsupported media | Signed PDFs and originals remain byte-for-byte intact. No blanket PDF conversion or unsupported video transcoding was added. |
| Inert EICAR test file | Rejected by the actual ClamAV service. |
| Key and persistence | Wrong key rejected. An authenticated file downloaded correctly after a full Compose stop and start. The VPS itself was not rebooted. |

Resume-safe transfer tools inventory database-referenced files and consent assets, verify original hashes and encryption, copy exact ciphertext without overwriting a different object, and verify the destination. The staging local inventory matched all 15 keys at the restore checkpoint and all 29 keys after the final browser run. Future R2 activation preserves database references and authenticated routes. No real R2 copy or live legacy-store cutover was performed. [Cloudflare R2 conditional writes](https://developers.cloudflare.com/r2/api/s3/conditional-operations/)

## Backup, recovery and monitoring

Daily PostgreSQL custom-format gzip dumps are checksummed and retained for 14 days. Restic takes encrypted deduplicated snapshots of the dumps and patient file volume. Scheduled backup health markers update only after the backup and repository checks complete. Retention and disk-floor settings protect the shared filesystem. The production deployment script requires a reachable independent SFTP repository and completes an offsite copy before starting the candidate.

The isolated restore used a quiesced database and worker. Restic restored and verified 23 files. PostgreSQL restored to a different database and matched counts and content fingerprints for all 100 tables. The dump restore took 3.65 seconds on synthetic data and excludes retrieval and clinic cutover. The restored compressed document decrypted and decompressed to its original contents with the correct key. Redis interruption returned 503, then readiness recovered to 200 with zero backend restarts.

The candidate monitor checks HTTPS, missing and stale backup markers, container health, disk usage, memory, load and worker backlog. The staging negative check exited 1 and reported the missing offsite backup. It also reported the staging host's disk threshold. The supplied five-minute systemd timer has not been installed on the live VPS. Real alert delivery, independent storage retention, secret custody and external outage monitoring are unverified.

## Final build and functional verification

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend regression | 74 | 0 | 0 |
| Frontend regression | 4 | 0 | 0 |
| HTTP integration and authorization | 256 | 0 | 0 |
| Redis integration | 2 | 0 | 0 |
| **Automated total** | **336** | **0** | **0** |

The isolated acceptance runs passed 35 browser checks and six targeted HTTPS checks, plus image-worker, staff-recovery, Redis-outage, backup-restore and restart checks. Browser coverage included representative Admin desktop and Receptionist mobile workflows, each role's alternate viewport dashboard, lead creation, patient records, scheduling, prescriptions, public consent, treatments and sittings, private downloads, billing pagination, print-frame loading and manual collections. Physical printer output and a real VPS reboot remain unverified.

Backend and frontend type checks and lint, production Docker images, Compose validation, shell syntax and whitespace checks passed. Production npm audit reported zero findings. The full npm audit reported 19 high-severity development dependency paths. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Performance

The local container rehearsal used Nginx TLS, a restricted PostgreSQL runtime role, and 3,005 leads, 1,003 patients and 2,001 appointments. Each endpoint used 20 measured requests after two warm-up requests. Timings are local HTTP results rather than live VPS measurements.

| Endpoint | p50 ms | p95 ms |
| --- | ---: | ---: |
| Dashboard | 29.01 | 52.52 |
| Patient list | 24.78 | 46.53 |
| Patient search | 21.66 | 31.63 |
| Leads | 32.36 | 36.05 |
| Appointments | 33.99 | 49.72 |
| Analytics | 60.02 | 114.46 |
| Patient profile | 42.86 | 58.72 |

Eight clients completed 64 dashboard requests in 1.03 seconds with zero failures. The response was about 7.9 KB. The backend sampled 213 MiB, PostgreSQL 140 MiB, worker 96 MiB and scanner 982 MiB in the container rehearsal. The branch retains the earlier dashboard query and frontend lazy-loading improvements. [Earlier baseline and bundle measurements](production-readiness-2026-11-18.md#local-performance-measurements)

## Integrations and final release checklist

The candidate disables gateway payments, email sending and WhatsApp sending explicitly. Manual payment entry remains available and passed browser acceptance. Local callback tests still verify signature failures, replay protection and idempotency with synthetic inputs. No real provider settlement, mail delivery, WhatsApp templates, or vendor retries were claimed. These optional integrations can remain disabled for a manual-payment launch.

1. Verify the independent SFTP repository with separate credentials and perform an offsite database, file and key recovery drill. Confirm real alert delivery.
2. Review the exact candidate diff and approve the protected release. Record previous images and keep the existing PostgreSQL and object volumes.
3. Take matched backups with writes paused. Copy the existing encrypted objects only after approval. Verify every database-referenced file and preserve the source.
4. Apply the additive migrations, switch to the restricted runtime database identity, run the deployment preflight and take an independent encrypted backup before opening traffic.
5. Verify both roles, HTTPS, downloads, scanning, documents, manual payments, monitoring and backup age. Reopen traffic only after acceptance.
6. If rollback is needed, preserve the failed state, use the previous approved images and protected configuration, verify file continuity, and reconcile writes against the matched snapshot.

The command-by-command procedure, recovery and rollback commands are in the [deployment runbook](../deployment.md). The changes are uncommitted. Existing untracked UI screenshots, fixture scripts and the standalone signature asset were preserved outside the release scope. No live file migration, configuration change, deployment, push or merge took place.
