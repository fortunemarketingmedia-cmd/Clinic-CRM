# Revive Clinic CRM final release verification

18 November 2026 IST · `codex/production-readiness-audit` · Baseline `473bdc5`

**Verdict: NOT READY.** The rebuilt application passed the local HTTPS rehearsal. Production Compose still references an unavailable MinIO client image and an archived MinIO server release with published high-severity vulnerabilities. The rehearsal used a cached server and client on an isolated network. The production storage path requires a supported, patched implementation and a clean-host restore rehearsal. [MinIO security advisories](https://github.com/minio/minio/security/advisories) · [MinIO release history](https://github.com/minio/minio/releases)

No release commit was created. The audit branch remains available for review. Public HTTPS checks were read-only. All writes, configuration changes, service interruptions and restores ran against disposable local services and synthetic records.

## Verification results

| Check | Pass | Fail | Scope |
| --- | ---: | ---: | --- |
| Backend regression | 72 | 0 | Complete backend suite. |
| Frontend regression | 4 | 0 | Complete frontend suite. |
| HTTP integration and authorization | 253 | 0 | Includes 200 anonymous denials and the test runner's two parent cases. |
| Redis integration | 2 | 0 | Atomic increment and TTL across independent clients, plus unreachable-server handling. |
| **Automated regression total** | **331** | **0** | **Zero skipped.** |
| Isolated HTTPS HTTP rehearsal | 8 | 0 | Secure headers and cookies, CORS and CSRF, valid invoice denial, branch isolation, ClamAV, secure upload and download, SMTP capture, oversized payload rejection, website intake and QR registration through reschedule and cancellation. |
| Chrome on the rebuilt production frontend | 26 | 0 | Administrator at desktop width and Receptionist at 390 px. Login, refresh, logout, persistent lead creation and search, Master Records, appointments, queue, follow-ups, patient panels and protected documents. Administrator Finance, Analytics, Reports and medicine catalog. Receptionist Finance, medicine catalog and other-branch profile denials. |
| Administrator recovery | 1 | 0 | Operator reset accepted the replacement password and rejected the prior password and refresh cookie. |

Backend TypeScript build, backend and frontend lint, frontend TypeScript and production build, Compose validation, Nginx syntax, shell syntax and Git whitespace checks passed. The backend, frontend, migration and worker images built. The local TLS proxy served both applications from one origin. The production example uses separate hosts. The scanner ran under AMD64 emulation on the ARM64 workstation. Chrome reported one expected 403 during the other-branch check and zero uncaught page errors. The public login and API health endpoints each returned 200 with successful certificate validation. Entering prescriptions and treatment records, financial printing, pagination controls and the complete loading and failure-state matrix still need browser acceptance.

## Findings fixed during the final rehearsal

- **Malware scanning.** The JSON/base64 upload path accepted the inert ClamAV test string. Base64 files now pass content validation and scan before storage. The rebuilt stack rejected the test string with 400 and accepted and downloaded a clean synthetic document through its signed capability.
- **QR registration.** Registration marked every appointment for the lead completed, including future bookings. Registration now preserves appointment state. The new regression checks the appointment remains scheduled, and the rebuilt stack accepted both rescheduling and cancellation afterward. Historical appointment states were preserved. Clinic reconciliation is required for records affected by the former behavior.
- **Gateway callbacks.** Concurrent signed callbacks previously could overwrite the verified record, including the status of a non-gateway payment. The transaction now locks the payment and event, rejects conflicting or reused events and checks invoice allocations under the invoice lock. Signed success, signed failure, invalid signature, concurrent conflict and an idempotent retry passed with synthetic payment data. A completed provider payment with a changed invoice balance returns 409 and requires operator reconciliation before release of a real integration.
- **Worker and scanner connectivity.** A separate outbound network now allows integration calls and ClamAV signature updates. ClamAV loaded updated signatures in the rehearsal. A malformed job previously returned normally and was marked completed. It now uses the retry and terminal failure path. The actual worker retained both a malformed job and an expired-lease job as `DEAD` with two attempts, a recorded error and no completion time. Durable jobs use PostgreSQL. Redis supports rate limiting and cache operations.
- **Redis disconnect and proxy logging.** A failed reconnect called `destroy()` on an already closed client and terminated the backend. The reconnect cleanup now checks client state. The repeat outage drill returned 503 for readiness and an API request, then returned 200 after Redis recovered, with zero backend restarts. The Nginx example's access log records a route family and request ID with status and timing. A synthetic path token and query were absent from the local proxy output.
- **Infrastructure patches.** PostgreSQL 17.12, Redis 7.4.11 and ClamAV 1.4.6 are pinned by digest. The populated rehearsal PostgreSQL volume restarted on the updated image and the application passed its checks. Nginx now specifies 429 when its request limit is reached. [PostgreSQL 17.12 release notes](https://www.postgresql.org/docs/release/17.12/) · [Redis 7.4 release notes](https://redis.io/docs/latest/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/redisce-7.4-release-notes/) · [ClamAV release announcements](https://blog.clamav.net/)

## Authentication, roles and lead totals

Administrator and Receptionist sign-in, cookie refresh, logout and refresh replay denial passed across browser or HTTP checks. Earlier-issued access tokens can remain valid until expiry after password recovery. The operator reset is Administrator-only. A verified receptionist recovery path remains a release requirement. The production refresh cookie was `HttpOnly`, `Secure` and `SameSite=Lax`. Foreign-origin cookie refresh received 403. The proxy rejected a body above 12 MiB with 413. The regression suite also checks token expiry, concurrent refresh reuse and MFA recovery-code replay.

A schema-valid invoice request for an existing patient in the receptionist's assigned branch returned **403** under Receptionist and **201** under Administrator. Receptionist invoice, payment, estimate, restricted export and cross-branch tests passed. The role and record checks used synthetic data. A complete clinic clinical-access review remains open.

The original Nashik Road comparison was rechecked read-only for **19 October through 17 November 2026 IST**. The database contained **24** leads in scope, including **3** converted, **21** unconverted and **0** deleted. The Dashboard card counts unconverted leads and the intake total includes all 24. Both values match their definitions. [Original API reconciliation](../final-verification-2026-11-17.md)

## Database and object recovery

An empty PostgreSQL database applied the whole migration chain. The populated rehearsal database restarted on PostgreSQL 17.12, and the earlier upgrade rehearsal applied the additive idempotency migration to an existing synthetic dataset. With app writes and jobs paused, the final PostgreSQL backup passed checksum and catalog checks. It restored into a separate local database in **3.88 seconds**, with matching row counts and content fingerprints for **all 100 tables**. The scheduled file mirror and one-shot object backup produced ten encrypted objects. A synthetic document from the mirror restored byte-for-byte into a private recovery bucket. The rehearsal key decrypted it to the expected content, and an incorrect key failed authentication. The local timing excludes retrieval from offsite and any reconciliation or cutover. [Earlier populated migration and database restore evidence](production-readiness-2026-11-18.md#database-and-infrastructure)

## Performance

The previous local HTTP benchmark measured dashboard p95 at **65.54 → 13.44 ms**, response size at **77,171 → 8,917 bytes**, and eight-client dashboard completion at **1,282 → 253 ms** across 80 calls. Initial patient-detail scripts fell from **307,447 to 284,843 gzip bytes**. See the earlier report for lead, patient search and appointment measurements and the underlying evidence. [Earlier HTTP and bundle measurements](production-readiness-2026-11-18.md#local-performance-measurements)

The original full Analytics HTTP p95 increase from **33.94 to 40.88 ms** was based on ten samples per build and different fixture counts. The follow-up alternated both repository implementations on the same local synthetic dataset with 3,051 leads, 1,014 patients, 2,042 appointments, nine invoices and seven payments. Each implementation was warmed up before measurement.

| Analytics repository measurement | Samples per build | Baseline p50 / p95 | Audit p50 / p95 |
| --- | ---: | ---: | ---: |
| Serial | 80 | 13.58 / 28.87 ms | 13.98 / 29.07 ms |
| Eight concurrent calls | 120 | 62.96 / 82.63 ms | 60.50 / 68.13 ms |

The paired query test did not reproduce a material p95 increase. It measured the data layer and had a small financial fixture. Pay-period Finance load, repeated end-to-end Analytics HTTP timings, production resource ceilings and user-visible rendering timing remain unverified.

## Open release gates

| Gate | Status | Required evidence |
| --- | --- | --- |
| Clean-host production Compose with supported object storage | **Failed** | Obtain a vetted patched S3-compatible server and backup client, verify the existing object data and access policy, and repeat clean pulls, application smoke and recovery. The cached MinIO copy was confined to the local rehearsal. |
| Provider payments and messaging | **Blocked** | Test gateway transaction and callback delivery, real vendor retries and reconciliation with gateway sandbox credentials. Test WhatsApp templates and reminders with a provider test account. Local SMTP confirmed a Finance PDF to a capture inbox. Clinic email delivery, appointment notification delivery and external credentials remain unverified. |
| Recovery and workflow acceptance | **Incomplete** | Verify a supported receptionist recovery process, clinic clinical permissions, stored doctor-signature use, full browser mutation flows and post-refresh results. Existing public registration links still have no expiry and allow repeat submissions. Establish a compatible expiry and replay policy and verify it before approving that path for production use. |
| Live Hostinger configuration and operations | **Unverified** | Verify actual deployed image digests, reverse-proxy chain, restricted application database identity, backup automation and offsite restore, encryption-key custody, logging, uptime, and delivery of worker, disk, dependency and stale-backup alerts. The repository's example uses the same PostgreSQL identity for bootstrap and runtime. Verify or separate these privileges before production approval. |
| Dependency and infrastructure security | **Incomplete** | Production npm audit reported zero vulnerabilities. The full npm audit reported 19 high-severity development dependency paths rooted in a Picomatch advisory, with no patched Picomatch version available from the registry during verification. The archived MinIO findings remain a release blocker. [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) |

## Release sequence after the gates pass

1. Obtain explicit release approval, create the reviewed release commit, and record its SHA, the running deployment SHA and the compatible prior and new image digests. Rerun the release candidate from a clean checkout on the target architecture with the approved object storage. Keep the deployment evidence with the release.
2. During the approved maintenance window, pause traffic and workers. Back up PostgreSQL and encrypted objects while writes are paused. Verify checksums, offsite copies and access to the encryption keys. Preserve the pre-upgrade database and object snapshot before recreating dependencies. Rehearse recovery onto an isolated database and bucket.
3. Pull the approved pinned services, build or load the reviewed backend, worker, frontend and migration images and run `docker compose --env-file <protected-env> -f compose.production.yml config --quiet`. Bring up the patched PostgreSQL, Redis, ClamAV and storage. For PostgreSQL 17.12, review the upstream instructions against the installed extensions and index types before the upgrade. Verify backup tooling against the upgraded server. [PostgreSQL upgrade notes](https://www.postgresql.org/docs/release/17.12/#RELEASE-17-12-MIGRATION)
4. Keep app traffic and outbound jobs paused. Run `docker compose --env-file <protected-env> -f compose.production.yml --profile tools run --rm migrate`. Confirm the tracked migration order. `20261117120000_patient_number_by_year` precedes the additive `20261117180000_financial_idempotency`. Take a fresh post-migration backup. Start the candidate applications using the reviewed [Hostinger deployment script](../../deploy/hostinger/deploy.sh) and [deployment guide](../deployment.md). When using the script for the full sequence, complete the pre-upgrade backup first and use the migrate step within the script once.
5. Check HTTPS, login and refresh for both roles, valid receptionist invoice denial, branch isolation, queue, file scanning and download, finance printing, provider sandbox results, backup age and worker backlog. Observe logs, errors, connection pools and resource metrics before reopening clinic traffic and enabling outbound jobs.
6. For an application rollback, keep writes paused, stop the candidate worker, retain the logs and start the prior approved app images by digest against the compatible database schema. Keep additive columns in place. Verify both roles and critical records before reopening traffic. For data recovery, preserve the failed state, restore the matched pre-upgrade dump and object snapshot into isolation with the recoverable key, reconcile post-snapshot writes, and switch traffic after recovery approval. Keep already-patched infrastructure on its verified supported version through an application rollback.

Temporary browser and staging inputs stayed outside the source tree. Existing local UI review screenshots, fixture setup scripts and the standalone signature PNG remain untracked. Exclude these from the eventual release diff.
