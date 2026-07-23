# Phase 8 — Advertising integrations

Phase 8 connects clinic-owned Meta and Google advertising accounts to the internal CRM. There is no patient account or patient-facing portal.

## Delivered

- Encrypted integration connections for Meta Lead Ads, Meta reporting, Meta Conversions API, Google Ads, Google lead forms, and Google offline conversions.
- Official Meta webhook verification and SHA-256 signature validation before ingestion.
- Google OAuth authorization-code flow with signed, expiring state; refresh tokens and developer tokens are encrypted.
- Durable, idempotent webhook processing. The raw event hash and `(platform, externalLeadId)` uniqueness protect against duplicate CRM leads.
- Per-form field mapping, branch and owner assignment, separate Person/Lead/AdLead records, an immediate follow-up task, attribution, WhatsApp acknowledgement scheduling, and audit evidence.
- Manual Meta lead-form reconciliation/backfill with retrieved/created/duplicate/failed/missing counts.
- Meta and Google campaign/ad performance sync with spend, impressions, reach, clicks, landing-page views, platform leads, device, and network dimensions where supplied.
- First-party attribution joins ad touches to appointments, arrival, and conversion. Revenue is intentionally excluded because billing is outside this CRM scope.
- Consent-gated Meta/Google conversion uploads. Only allowed funnel events are accepted; clinical/medical fields are never serialized to an advertising provider.
- Integration event, sync, conversion, failure, and token-health visibility in the admin integration centre.

## Key APIs

- `GET|POST /api/integrations/webhooks/:connectionId`
- `GET|POST|PATCH /api/integrations/connections`
- `GET /api/integrations/connections/:id/google-oauth-url`
- `POST /api/integrations/connections/:id/sync`
- `GET|POST /api/integrations/mappings`
- `GET /api/integrations/events`, `/sync-runs`, `/campaigns`, `/conversions`

Production requires `INTEGRATION_ENCRYPTION_KEY`, official HTTPS callback URLs, provider-side least-privilege scopes, and registered webhook URLs.
