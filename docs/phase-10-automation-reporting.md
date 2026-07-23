# Phase 10 — Automation and reporting

## Automation builder

Administrators can define branch-aware workflows with allowed clinic triggers, conditions, delays, multiple ordered actions, stop-safe execution, retries, test mode, activation, and an execution log. Durable jobs isolate workflows from web requests and resume delayed steps.

Supported triggers cover lead intake/assignment/stage/follow-up, appointment booking/confirmation/missed/completed/arrival, consultation completion, treatment-plan creation, and consent expiry. Phase 9 patient-experience triggers and all billing/inventory triggers are deliberately absent.

Allowed actions include owner assignment, tasks, allow-listed field/stage updates, admin alerts, consent-aware WhatsApp handoff, HTTPS webhooks with private-network blocking, advertising conversion events, and timeline tag evidence.

## Reports and dashboards

The reporting centre provides CRM funnel/source/owner performance, appointment outcomes, clinical throughput, and marketing attribution with CPL/cost-per-appointment/cost-per-arrival/cost-per-conversion. Billing, revenue, payment, package, procurement, and inventory reports are excluded.

Admins can aggregate across branches. Receptionists must select a branch and receive the operational dashboard/report scope only.

APIs are under `/api/automations` and `/api/reports`.
