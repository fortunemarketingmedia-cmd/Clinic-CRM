# Revive Clinic CRM production readiness audit

18 November 2026 IST · Audit branch `codex/production-readiness-audit` · Baseline `473bdc5`

## Executive verdict

**Not ready for production release.** The changes pass the isolated database and API checks and improve dashboard performance. Release still requires clinic acceptance on the final build, a staging rehearsal with the production storage, malware scanner and provider configuration, and verification of live backup and monitoring arrangements. The audit used local synthetic records. Production infrastructure and databases were outside the execution scope. The audit changes are uncommitted.

## Findings and remediation

| Severity | Finding | Change and evidence |
| --- | --- | --- |
| Critical | No critical finding was confirmed in the tested scope. | The scope and unverified paths below still apply. |
| High | Receptionists could read people outside their assigned branches, attach other-branch records to work items, and submit an authorized target branch while using an ad lead from a different branch. | Scoped people queries and nested relations, enforced relationship checks for tasks, follow-ups and waitlist, and checked source and destination branches. HTTP tests verified people reads, work-item relationships, appointment writes and selected cross-branch reads. |
| High | Work-item write responses included whole staff records. Financial information could also appear in nested data and timeline descriptions. | Replaced whole-staff reads with explicit fields. Added centralized credential filtering and receptionist financial redaction, including known financial timeline events and waitlist estimates. Billing, Finance and automation routes enforce administrator permissions. |
| High | Refresh and MFA recovery requests could race. MFA setup could replace an enabled factor through an existing access session. | Made refresh rotation transactional, claimed recovery codes once, and required an already enabled factor to be disabled through the existing verification flow before setup. HTTP tests covered parallel refresh and recovery claims, invalid and expired tokens, logout replay, and inactive accounts. |
| High | Simultaneous bookings and financial retries could create conflicting or duplicate writes. | Rechecked shared appointment slots and invoice balances under database locks. Added scoped invoice and payment idempotency keys plus client retry keys. Concurrent HTTP requests verified one room booking, one invoice and one payment where expected. |
| High | Webhook target checks relied on hostname strings and followed redirects. | Validated resolved addresses, pinned the DNS answer used by the HTTPS connection, and disabled redirects. Tests cover unsafe schemes, credentials, ports and address classes. A live provider connection was outside this test. |
| High | A worker killed during a job could leave it in RUNNING indefinitely. | Added expired lease recovery, a heartbeat and owner checks when recording completion or failure. An integration scenario covered reclaim and stale worker completion. External provider jobs still need staging replay tests. |
| Medium | Financial exports collected unrelated analytics and could include inconsistent summary and register scopes. Spreadsheet cells could interpret user text as a formula. | Used the same issued invoice register for the export summary and protected CSV fields. The API test covered CSV access and the report shape. A unit test covered formula and quote escaping. |
| Medium | Sensitive responses and browser query results could survive a session change. | Set private no-store on sensitive JSON and downloads. Clear the browser query cache on session transitions. Scrubbed URL identifiers from request logs and real-time invalidation events. |
| Medium | The dashboard fetched full analytics, including billing rows, then discarded most of it. Booking also recorded some leads as converted before a patient existed. | Added operational projections and grouped counters. Follow-up widgets now use persisted follow-up records. Booking now records the booked stage and preserves any actual conversion history. API tests checked database counts and booking state. |
| Medium | Redis rate increments and expiry happened in separate commands. | Made the operation atomic. In production, unavailable request protection returns 503. Login, public QR, authenticated traffic and the Redis primitive passed local tests. |
| Low | Patient detail bundled treatment, document and room-booking modules at initial render. | Deferred those panels and measured the initial production page scripts. Corrected the latest-visit card so future appointments do not appear as visits. Removed a dead appointment query and unused HTTP logger. |

Security review references. [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) · [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## Security and workflow verification

- **Authentication and authorization.** The HTTP suite checks 200 protected route declarations for anonymous denial and exercises receptionist branch lists and object reads, valid invoice creation denial, financial exports, origin rejection for cookie session requests, token expiry, login throttling and user-specific traffic limits. The [API inventory](api-inventory.md) lists 215 mounted declarations and 26 unmounted inventory declarations. The latter were retained pending confirmation of their intended product scope.
- **Bookings and records.** Synthetic tests checked appointment creation, cancellation, conflicting room requests, persisted lead stage, dashboard totals, people lookups, tasks and follow-ups. Website intake saved a consented lead in the selected branch, and QR registration converted a booked lead to a patient with a limited public response. Browser smoke covered Administrator and Receptionist login, dashboard, branch controls, patient search and detail, synthetic lead creation, Administrator Finance and receptionist Finance restriction. Desktop and narrow mobile layouts were exercised. The browser connection became unavailable for the final rebuild, so lazy-loaded panel interactions and the latest dashboard need a browser retest.
- **Consent, uploads and finance.** HTTP tests exercised a public consent link through signature, replay denial, countersign and protected PDF, plus encrypted file upload, retry, download, bad content and cross-branch denial. Synthetic invoice issuance, payment collection, stored balance and CSV export passed. Live object storage, malware scanning, payment provider callbacks, provider messaging, GST acceptance and complete prescription and treatment browser workflows remain unverified.
- **Dependencies.** The production npm audit reported zero findings after compatible updates. The full audit reported 19 high-severity development dependency paths, primarily transitive glob tooling. The shipped backend image excludes Next.js, React, tsx and compiled test files. TypeScript remains installed through the dependency graph. The Node 22.23.5 base image is pinned by digest. [Next.js advisory](https://github.com/advisories/GHSA-mfr8-8qww-v76h) · [Picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Local performance measurements

Each endpoint had two warm-up calls and ten measured HTTP requests on local Node 24.11.1 and PostgreSQL. Approximately 3,000 leads, 1,000 patients and 2,000 appointments were present. Integration and browser scenarios added seven leads and six appointments between measurements. The figures are directional, especially for endpoints whose queries did not change.

| HTTP operation | Median before | Median after | p95 before | p95 after |
| --- | ---: | ---: | ---: | ---: |
| Operational dashboard | 37.28 ms | 10.45 ms | 65.54 ms | 13.44 ms |
| Patient list | 3.46 ms | 2.21 ms | 7.21 ms | 2.55 ms |
| Lead list | 20.12 ms | 5.37 ms | 58.52 ms | 5.93 ms |
| Appointment calendar | 26.92 ms | 8.38 ms | 55.56 ms | 13.12 ms |
| Patient search | 7.47 ms | 5.78 ms | 14.32 ms | 6.97 ms |
| Full analytics | 26.83 ms | 19.62 ms | 33.94 ms | 40.88 ms |

- Dashboard JSON fell from **77,171 to 8,917 bytes**. Eight concurrent clients completed all 80 dashboard requests in **1,282 → 253 ms**. Process CPU time in that run was **2,743 → 671 ms** and end-of-run RSS **459.7 → 443.3 MiB**. CPU includes the in-process HTTP load client.
- The patient detail route's initial production scripts fell from **1,042,890 to 946,796 raw bytes** and **307,447 to 284,843 gzip bytes**. These counts measure assets referenced by the initial HTML, independent of cache warmth and browser rendering.
- Post-change sample query plans measured **0.98 ms** for a selective single-field patient name lookup and **2.05 ms** for the dashboard lead intake aggregate. PostgreSQL chose sequential scans on the small fixture. Existing trigram and branch indexes were retained. The full analytics p95 regressed in this small sample. Its broader query and larger payload remain a performance target.
- Matched before-and-after timings for booking writes, Finance-specific loads, user-visible dashboard paint and production query plans were unavailable. The local results do not establish VPS capacity or latency.

Raw results. [API baseline](before-performance.json) · [API after](after-performance.json) · [Bundle baseline](before-frontend-bundle.json) · [Bundle after](after-frontend-bundle.json)

## Database and infrastructure

The empty-database rehearsal applied the full Prisma migration chain. The live upgrade path was modeled by applying the additive invoice and payment idempotency migration to the populated synthetic audit database. It adds nullable fields and unique indexes, with no backfill or row deletion. Existing records remain readable by the previous application build. If production tables are substantially larger, rehearse lock time on a representative staging copy before scheduling the release.

The PostgreSQL backup and restore scripts passed on the populated synthetic fixture. The first attempted comparison overlapped with integration writes, which changed the source after the dump. The repeated comparison ran with writers stopped and matched counts and content fingerprints for all **100** tables. Local object storage was exercised by the upload test. Production snapshots, offsite object recovery, encryption-key recovery, backup age and recovery timing require a staging restore drill. [Restore evidence](backup-verification.json)

Compose rendering and shell syntax checks passed. Reviewed loopback port bindings, internal service networks, proxy headers, TLS configuration, connection limits, process permissions, worker health checks and backup retention. Both Docker images built successfully. The backend loaded its runtime dependencies as a non-root user, and the standalone frontend served its login route in a network-isolated container. Production still needs a staging check of the expected reverse-proxy chain, secure cookies, Redis loss and recovery, ClamAV, object store policy, shipping logs and alert delivery. The current worker container health check is process-based and needs job-lag and dead-job alerts at deployment.

## Automated results

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend regression suite | 71 | 0 | 0 |
| Frontend regression suite | 4 | 0 | 0 |
| Backend HTTP integration and authorization suite | 251 | 0 | 0 |
| Redis integration | 1 | 0 | 0 |
| **Total** | **327** | **0** | **0** |

Backend build, frontend production build and type check, lint, Compose validation and Git whitespace checks passed. The HTTP total includes the Node test runner's two parent cases. The new CI workflow provisions an isolated database and Redis for the same checks. GitHub Actions itself has not run on the uncommitted audit.

## Remaining release conditions

1. Recheck the final UI with both roles across the clinic's actual workflow, including treatment and prescription entry, real-time updates, queue transitions, mobile consent and financial printing. Confirm receptionist treatment and clinical record access with the clinic's policy owner. Validate the existing stored doctor-signature workflow and confirm who may apply and retrieve that signature.
2. Check that legacy books and reports reconcile after the change. Existing leads previously marked CONVERTED during booking were preserved. Review these historical rows before considering any backfill. Test refund, credit-note, gateway and billing status races separately. Financial record writes are deduplicated, while post-write timeline and audit operations remain separate from their database transaction.
3. Review the lifetime of existing QR registration links and introduce an approved expiry and replay policy compatible with printed and previously shared links. Public consent already uses a separate expiring, single-use token.
4. Rehearse live provider delivery, production topology, object restore and payment reconciliation. Treat worker retries as at-least-once and verify provider idempotency keys before enabling any outbound job.
5. Limit untrusted build inputs and track the development-only dependency findings. The authenticated endpoints exercised in this audit cover selected workflows and branch relationships, leaving additional records and input combinations for staging security tests.

## Release and rollback checklist

1. Review the audit diff and approve a release commit. Record its SHA, the previous deployment SHA and image digests. Keep local fixtures, generated assets, environment files, dumps and review screenshots outside the release.
2. Create a staging environment with production-equivalent TLS, Redis, database settings, ClamAV and private encrypted storage. Keep outbound integrations on test accounts. Run the automated suites, browser acceptance and benchmark against staging. Verify successful health checks and alerts for a stopped worker, stale backup and unhealthy dependency.
3. Take a fresh database backup and object snapshot with the clinic writes paused or otherwise coordinated. Check checksums, verify offsite copies and confirm access to the encryption keys. Restore into a disposable staging environment and record how long recovery takes.
4. Confirm that the backup supports rollback and check migration timing. On the approved VPS, validate Compose with the protected environment file and use the repository's [deployment script](../../deploy/hostinger/deploy.sh) following the existing [deployment guide](../deployment.md). Apply the additive migration before starting the updated backend. Capture migration and container health results before opening traffic.
5. Smoke-test HTTPS, both roles, a valid receptionist invoice rejection, branch isolation, queue, encrypted download, printing and worker backlog. Watch login errors, 5xx responses, database pool activity, disk usage and job age during the release window.
6. If application checks fail, stop the new worker, preserve logs and redeploy the previous approved application images. Keep the additive columns in place. If a data restore is required, stop writes and jobs, preserve the failed-state database and object copies, restore a matched database and object snapshot into isolation, reconcile changes made after the snapshot, then switch traffic only after explicit recovery approval.

To reproduce local checks, set `AUDIT_DATABASE_URL` to a fresh loopback PostgreSQL database ending in `_uitest`. Run `npm run audit:setup -w backend` followed by `npm run test:integration -w backend`. Use matching PostgreSQL client binaries for `backend/tests/audit-backup.ts`. Run backups with the synthetic source idle. Set `AUDIT_REDIS_URL` to the disposable loopback Redis on port 16379 before `npm run test:redis -w backend`.
