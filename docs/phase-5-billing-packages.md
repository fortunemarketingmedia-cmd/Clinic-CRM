# Phase 5 — Billing and Packages

Status: implemented and verified against an isolated PostgreSQL database. The migrations have not been applied to a production database.

## Delivered

- Draft, send, accept, reject, expire, cancel, and convert estimate lifecycle.
- Itemized invoices for services, packages, products, and custom charges, including quantity, unit price, discount, tax, subtotal, and total calculations.
- Draft and issued invoices with partial, paid, overdue, cancelled, and refunded states.
- Separate payment records with cash, UPI, card, bank-transfer, gateway, wallet, and other modes.
- Multiple payments per invoice, one payment allocated across multiple invoices, advance balances, payment reversal, and PDF receipts.
- Outstanding aging buckets, reminders, follow-up dates and notes, and payment promises.
- Role-aware discount thresholds with manager or owner approval before invoice issue.
- Refund request, approval, rejection, processing, and audit history tied to the original invoice and payment allocation.
- Credit-note creation, issue, application, cancellation, and balance revalidation.
- Package masters with included services, session count, validity, tax, price, maximum discount, branch/practitioner restrictions, policy rules, and active status.
- Patient package purchase, reservation, consumption, reversal, transfer, pause, extension, refund, and expiry-adjustment actions.
- Append-only package session ledger. Package counters are updated only in the same transaction as a ledger entry, including consumption from clinical session completion.
- Branch-level daily cash closing with calculated collections, refunds, expected cash, variance, submission, and approval.
- Audit and patient-timeline events for material billing and package actions.

## Main database additions

- `Estimate` and `EstimateItem`
- `InvoiceItem`, expanded `Invoice`, and discount approval links
- Expanded `Payment` plus `PaymentAllocation`
- `Refund`, `CreditNote`, and `DiscountApproval`
- `PackageMaster`, expanded patient `TreatmentPackage`, and `PackageSessionLedger`
- `DailyCashClosing`

The migration backfills legacy invoices with a compatible invoice item, assigns payment numbers and branches, creates payment allocations, creates package masters for legacy patient packages, and writes purchase and aggregate-consumption ledger entries so existing counters have an auditable origin.

## Main APIs

- `/api/billing/estimates` and `/api/billing/estimates/:id/actions`
- `/api/billing/invoices`, `/api/billing/invoices/:id/actions`, and `/api/billing/invoices/:id/pdf`
- `/api/billing/payments`, `/api/billing/payments/:id/allocate`, `/api/billing/payments/:id/reverse`, and `/api/billing/payments/:id/receipt`
- `/api/billing/payments/gateway-callback`
- `/api/billing/outstanding` and `/api/billing/invoices/:id/collection`
- `/api/billing/discount-approvals`
- `/api/billing/refunds` and `/api/billing/credit-notes`
- `/api/billing/package-masters`, `/api/billing/patient-packages`, and `/api/billing/patient-packages/:id/actions`
- `/api/billing/cash-closings` and `/api/billing/cash-closings/:id/actions`

All private endpoints enforce permissions and branch scope. The gateway callback is public by necessity but validates the raw payload with HMAC before accepting an event.

## Frontend

- `/estimates` — estimate builder and conversion workflow.
- `/invoices` — itemized invoice creation, approvals, issue actions, and PDF download.
- `/payments` — advance and allocated payments, split allocation, receipts, and reversal.
- `/outstanding-collections` — aging, reminders, follow-up notes, and payment promises.
- `/refunds-credit-notes` — original-transaction-linked refund and credit workflows.
- `/packages` — package-master rules, patient purchase, balance, actions, and ledger history.
- `/cash-closing` — branch daily close, variance, submission, and approval.

## Deployment configuration

- `PAYMENT_GATEWAY_SECRET` signs payment-gateway callbacks. Configure a long, unique production secret and send its SHA-256 HMAC in the gateway signature header.
- Keep gateway event identifiers unique so callback retries remain idempotent.
- Run both Phase 5 migrations in order: enum expansion first, then the billing/package schema and backfill.
- Reconcile backfilled invoice, payment, and package totals in staging before production rollout.

## Verification performed

- Replayed the full migration chain from an empty database.
- Replayed Phase 5 over a Phase 2 legacy fixture and verified invoice items, payment allocation, package-master linking, outstanding balances, and package ledger backfill.
- Seeded package masters and scoped billing and manager accounts.
- Exercised estimate conversion, discount blocking and approval, invoice issue, advance and split allocations, authorized PDFs, aging and promises, refund processing, credit application, package ledger actions, signed gateway callbacks, cash close approval, and payment reversal through the API.
- Passed Prisma validation, backend policy tests, backend build and lint, frontend typecheck and lint, and production builds.

## Phase boundary

Phase 6 should add inventory and procurement: product catalogue, suppliers, purchase orders, receipts, branch stock, batches and expiry, transfers, treatment consumption, adjustments, alerts, and immutable stock audit trails.
