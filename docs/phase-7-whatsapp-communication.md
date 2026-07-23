# Phase 7 — WhatsApp Communication Centre

Status: implemented and verified through a clean 19-migration replay, complete seed, policy tests, production builds, and an end-to-end HTTP exercise against an isolated PostgreSQL database and local Meta API simulator. No production database or live Meta account was changed.

## Delivered

- Official Meta WhatsApp Business Cloud API adapter; no browser automation, unofficial gateway, or hardcoded provider message content.
- Authenticated-encrypted storage for access tokens, app secrets, and webhook verify tokens using AES-256-GCM. Production account setup is blocked unless `INTEGRATION_ENCRYPTION_KEY` is explicitly configured.
- Account and branch phone-number setup, connection test, provider template sync, token expiry metadata, quality/messaging-limit metadata, disconnect state, and failure visibility.
- Signature-verified webhook verification and ingestion with SHA-256 idempotency, immediate queueing, duplicate suppression, durable asynchronous processing, retry state, and retained event payloads.
- Shared inbox with unread, unassigned, mine, failed, search, status, priority, assignment, linked lead/patient/appointment/invoice/package context, internal notes, and a 24-hour service-window reply composer.
- Inbound text, image, document, audio, location, button, and interactive reply persistence.
- Outbound text, media, interactive, and managed-template messages with scheduled, queued, submitted, sent, delivered, read, failed, and cancelled state tracking.
- Provider message IDs, timestamps, retry counts, provider payloads, error details, cost metadata, template metrics, and broadcast delivery metrics.
- Managed template library with language, category, operational group, header/body/footer/buttons/variables, provider approval/rejection/paused/disabled state, rejection reasons, active state, and synchronization. Only provider synchronization can confer approval.
- Separate consent categories for transactional, appointment, treatment follow-up, payment reminder, marketing, and promotional-broadcast communication.
- Auditable consent grant and withdrawal history. `STOP`, `UNSUBSCRIBE`, `REMOVE ME`, and `DO NOT MESSAGE` create immediate marketing and promotional-broadcast suppression records.
- Durable lead acknowledgement/follow-up and appointment booked, confirmation, 24-hour, one-hour, rescheduled, cancelled, and missed automation scheduling.
- Lead sequences stop on inbound response and terminal lead status. Appointment jobs are cancelled and rebuilt when the schedule changes.
- Quick-reply processing for confirmation and arrival. Reschedule/cancellation responses remain visible in the shared inbox for clinic handling rather than silently changing clinical schedules.
- Consent-filtered broadcasts with segmentation, draft/approval/schedule/send/complete lifecycle, manager approval, quiet hours, rate limits, cancellation, recipient state, and delivery/read/reply/failure/opt-out metrics.
- PostgreSQL-backed jobs claimed transactionally with lock expiry, exponential backoff, maximum attempts, dead-letter state, and failure logs. No in-memory queue is the source of truth.

## Data model

- `WhatsAppAccount` and `WhatsAppPhoneNumber`
- `WhatsAppConversation` and `WhatsAppMessage`
- `WhatsAppTemplate` and `WhatsAppWebhookEvent`
- `WhatsAppOptIn`
- `WhatsAppBroadcast` and `WhatsAppBroadcastRecipient`
- `WhatsAppAutomation`
- `DurableJob` and `WhatsAppFailureLog`

The pre-existing `WhatsAppLog` table remains for historical compatibility. Its free-form rows are not silently converted because they do not contain a reliable Meta account, phone-number ID, conversation, provider message ID, consent category, or delivery history.

Migration: `20260722040000_phase_7_whatsapp_communication`.

## API surface

Public Meta callbacks:

- `GET /api/whatsapp/webhook`
- `POST /api/whatsapp/webhook`

Authenticated operations:

- `GET/POST /api/whatsapp/accounts`
- `POST /api/whatsapp/accounts/:id/test` and `/disconnect`
- `GET /api/whatsapp/phone-numbers`
- `GET/POST/PATCH /api/whatsapp/templates`
- `POST /api/whatsapp/templates/sync/:accountId`
- `GET/POST /api/whatsapp/conversations`
- `GET/PATCH /api/whatsapp/conversations/:id`
- `POST /api/whatsapp/conversations/:id/messages` and `/internal-notes`
- `GET/POST /api/whatsapp/consents`
- `GET/POST /api/whatsapp/automations`
- `GET/POST /api/whatsapp/broadcasts`
- `POST /api/whatsapp/broadcasts/:id/action`
- `GET /api/whatsapp/webhook-events`, `/jobs`, `/failures`, and `/logs`
- `POST /api/whatsapp/jobs/process` for administrator diagnostics; the server worker processes jobs automatically.

## Frontend

- `/communication-centre` — shared inbox and the complete communication workspace.
- `/whatsapp-templates` — provider template manager.
- `/whatsapp-broadcasts` — campaign creation, approval, scheduling, and analytics.
- `/settings/integrations` — encrypted Meta account and branch-number setup.

The communication workspace also exposes automation definitions and durable job/failure logs. Branch-scoped roles must select an assigned branch; omitting a branch does not broaden access.

## Seed behavior

The seed creates representative appointment, lead, and payment template drafts plus inactive automation definitions. It deliberately creates no Meta account, live credential, phone-number mapping, approved template, consent grant, or broadcast audience. An administrator must connect a real Meta account, synchronize approved templates, assign their operational groups, review content, and explicitly activate automations.

## Verification evidence

- Prisma schema validation and formatting passed.
- All 19 migrations replayed successfully from an empty PostgreSQL database and the complete seed ran successfully.
- Backend TypeScript build and lint passed.
- Frontend TypeScript, lint, and production Next.js build passed; all four Phase 7 routes were generated.
- All 29 policy tests passed, including authenticated encryption, webhook signature tamper rejection, phone/opt-out normalization, quiet hours, monotonic delivery status, and managed-template variables.
- End-to-end HTTP smoke test connected an account through the provider adapter, synchronized approved templates, queued a consented template message, submitted it to the provider simulator, stored its provider ID, accepted a correctly signed delivery webhook, suppressed an exact duplicate, advanced the message to delivered, received an inbound message, opened the service window, processed `DO NOT MESSAGE`, and rejected an invalid webhook signature.
- Direct isolated-database inspection returned the ciphertext version prefix `v1.` and confirmed the plaintext token was absent.

## Production deployment checklist

1. Restore a current backup into an isolated environment and rehearse all 19 migrations.
2. Set a stable, backed-up `INTEGRATION_ENCRYPTION_KEY` of at least 32 characters. Changing or losing it makes stored credentials unreadable.
3. Set the official `WHATSAPP_GRAPH_API_URL=https://graph.facebook.com` and a supported `vXX.X` API version. Production code rejects a non-Meta hostname.
4. Create a least-privilege Meta system user, grant only the required WhatsApp assets, and define token rotation ownership.
5. Connect each WhatsApp Business Account and map every phone-number ID to the correct clinic branch.
6. Configure Meta’s webhook URL as `/api/whatsapp/webhook`, subscribe to message events, complete the verify-token challenge, and confirm signed callbacks reach the application.
7. Synchronize templates, assign operational groups, review variables/buttons/languages, and activate only provider-approved templates.
8. Import or capture category-specific consent evidence before enabling automations or broadcasts.
9. Review quiet hours, rate limits, broadcast approval ownership, lead stop conditions, and retry/dead-letter alerts with operations.
10. Test inbound, template outbound, delivery/read receipts, opt-out, appointment rescheduling, provider outage/retry, and one small approved broadcast per branch.
11. Run the worker in every application deployment but monitor queue age, dead jobs, provider failure codes, token expiry, quality rating, and webhook lag centrally.

## Phase boundary

Phase 8 should add analytics and reporting across clinical, revenue, operations, leads, inventory, and communication data without weakening row-level permissions or immutable source ledgers.
