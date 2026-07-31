# Meta Ads, Google Ads, and WhatsApp API Integration Roadmap

Date: 31 July 2026  
Project: Revive Clinic CRM  
Audience: Developer / technical implementation team

## 1. Goal

The CRM should receive enquiries from website forms, Meta lead ads, Google ads / lead forms, and WhatsApp. These enquiries should enter one clean lead pipeline, then move through appointment booking, client registration, consultation, billing, treatment, and follow-up.

The integration should avoid duplicate leads, keep clear source attribution, and allow the clinic team to send confirmation / reminder / follow-up WhatsApp messages from CRM.

## 2. Target CRM flow

```text
Website / Meta Ads / Google Ads / WhatsApp
        ↓
Lead capture endpoint
        ↓
Lead deduplication by mobile number
        ↓
Lead Pipeline
        ↓
Appointment Booking
        ↓
Client Directory
        ↓
Consultation / Treatment / Billing
        ↓
WhatsApp follow-up and reminders
```

## 3. Required accounts and access

### Meta

- Meta Business Manager.
- Facebook Page connected to the clinic.
- Instagram account, if Instagram ads are used.
- Meta developer app.
- Ad account.
- Lead Ads permission access.
- WhatsApp Business Account if using the official WhatsApp Cloud API.
- Verified business details are recommended before production use.

Official docs:

- [Meta Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api)
- [Meta Lead Ads guide](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads)
- [WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)

### Google

- Google Ads account.
- Google Ads Manager account is recommended for API access.
- Google Cloud project.
- OAuth consent screen.
- OAuth client credentials.
- Google Ads developer token.

Official docs:

- [Google Ads API quick start](https://developers.google.com/google-ads/api/docs/get-started/make-first-call)
- [Google Ads developer token](https://developers.google.com/google-ads/api/docs/api-policy/developer-token)
- [Google Ads OAuth overview](https://developers.google.com/google-ads/api/docs/oauth/overview)

## 4. Environment variables to add

Backend `.env` should eventually include:

```env
# Public CRM API URL used by website / webhooks
CRM_PUBLIC_API_URL=https://api.your-domain.com/api

# Meta Ads / Lead Ads
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
META_SYSTEM_USER_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
META_PAGE_ID=

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_DEFAULT_COUNTRY_CODE=91

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_CUSTOMER_ID=
```

For local testing, webhook services need a public URL. Use a tunnel such as ngrok / Cloudflare Tunnel only for development.

## 5. Database additions recommended

The CRM already has lead and integration-related modules, but the following fields/tables should be confirmed or added.

### Lead source attribution

Each lead should store:

- `source`: WEBSITE, META_ADS, GOOGLE_ADS, WHATSAPP, PHONE_CALL, WALK_IN, REFERRAL
- `sourceCampaignId`
- `sourceCampaignName`
- `sourceAdSetId`
- `sourceAdSetName`
- `sourceAdId`
- `sourceAdName`
- `sourceFormId`
- `sourceFormName`
- `externalLeadId`
- `utmSource`
- `utmMedium`
- `utmCampaign`
- `utmTerm`
- `utmContent`
- `rawPayload`

### Integration event log

Recommended table:

```text
IntegrationEvent
- id
- provider: META | GOOGLE | WHATSAPP | WEBSITE
- eventType
- externalId
- status: RECEIVED | PROCESSED | FAILED | DUPLICATE
- payload JSON
- errorMessage
- createdAt
- processedAt
```

This makes debugging much easier when a lead does not appear in CRM.

### Message log

Recommended WhatsApp message table:

```text
WhatsAppMessage
- id
- patientId / leadId
- phone
- direction: INBOUND | OUTBOUND
- messageType: TEMPLATE | TEXT | MEDIA | INTERACTIVE
- templateName
- status: QUEUED | SENT | DELIVERED | READ | FAILED
- providerMessageId
- errorCode
- errorMessage
- payload JSON
- createdAt
- updatedAt
```

## 6. Website form integration

### Objective

When a client fills the website form, the CRM should create or update a lead.

### Backend endpoint

Create endpoint:

```http
POST /api/public/leads
```

Expected payload:

```json
{
  "name": "Client Name",
  "mobile": "9876543210",
  "email": "client@example.com",
  "treatmentConcern": "Hair treatment",
  "preferredBranch": "Nashik Road",
  "source": "WEBSITE",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "hair_prp_nashik",
  "pageUrl": "https://revive-woad.vercel.app/"
}
```

### Security

Do not expose admin APIs to the website.

Use one of these:

- Public lead endpoint with strict validation, rate limiting, and captcha.
- API key from website backend to CRM backend.
- Server-side website form submission instead of direct browser-to-CRM call.

### Deduplication rule

If mobile number already exists:

- Do not create duplicate lead.
- Add a timeline note: “New website enquiry received”.
- Update source/campaign metadata if newer.
- Keep latest treatment concern if supplied.

## 7. Meta Ads integration

### Use cases

- Pull leads from Meta Lead Ads forms.
- Store campaign/ad/source metadata.
- Optional future: campaign spend and conversion reporting.

### Setup steps

1. Create or use existing Meta Business Manager.
2. Create Meta developer app.
3. Add Marketing API product.
4. Connect Facebook Page and Ad Account.
5. Create lead form in Meta Ads Manager.
6. Configure webhook callback URL:

```text
https://api.your-domain.com/api/webhooks/meta
```

7. Verify webhook using `META_VERIFY_TOKEN`.
8. Subscribe app to Page leadgen events.
9. Generate long-lived/system-user access token with required permissions.
10. Test by submitting a test lead from Meta Lead Ads testing tool.

### Backend endpoints

```http
GET /api/webhooks/meta
POST /api/webhooks/meta
```

`GET` handles webhook verification.  
`POST` receives event notifications.

### Processing logic

Meta webhook usually sends a lead reference, not full client details. Backend should:

1. Receive webhook event.
2. Store raw event in `IntegrationEvent`.
3. Extract `leadgen_id`.
4. Call Meta Graph API to fetch lead details.
5. Map form fields to CRM fields.
6. Create/update lead.
7. Store campaign/ad/form metadata.
8. Mark event processed.

### Field mapping

| Meta field | CRM field |
|---|---|
| full_name | lead.name |
| phone_number | lead.mobile |
| email | lead.email |
| preferred_branch | lead.branchId / preferredBranch |
| treatment_interest | lead.interestedTreatment |
| leadgen_id | lead.externalLeadId |
| form_id | lead.sourceFormId |
| ad_id | lead.sourceAdId |
| campaign_id | lead.sourceCampaignId |

## 8. Google Ads integration

### Use cases

- Capture Google lead form extension leads.
- Import conversion events back to Google Ads later.
- Optional future: campaign cost / conversion reporting.

### Setup steps

1. Create Google Ads Manager account.
2. Apply for Google Ads API developer token.
3. Create Google Cloud project.
4. Configure OAuth consent screen.
5. Create OAuth client credentials.
6. Generate refresh token for Google Ads API access.
7. Store customer IDs and login customer ID in backend `.env`.
8. Decide capture method:
   - Webhook from Google lead form extension, if configured.
   - Scheduled polling via Google Ads API.
   - Website form with UTM tracking, simplest for current Vercel website.

### Recommended first implementation

For phase 1, use website forms with UTM tracking:

```text
utm_source=google
utm_medium=cpc
utm_campaign=<campaign_name>
utm_content=<ad_group_or_creative>
utm_term=<keyword>
```

This gives quick attribution without needing full Google Ads API approval immediately.

### Later Google Ads API implementation

Add backend jobs:

```text
google-ads-sync-worker
- Sync campaigns
- Sync ad groups
- Sync keyword/cost metrics
- Match CRM leads by UTM/click IDs
- Push conversion events when appointment is booked or treatment is purchased
```

### Conversion events to send later

- Lead created
- Appointment booked
- Consultation completed
- Package purchased
- Payment received

## 9. WhatsApp Cloud API integration

### Use cases for this CRM

- Appointment confirmation.
- Appointment reminders.
- Follow-up reminders.
- Payment pending reminders.
- Treatment session reminders.
- Simple inbound enquiry capture.
- Optional chatbot later.

### Setup steps

1. Create Meta Business Manager.
2. Create or select WhatsApp Business Account.
3. Add phone number.
4. Complete phone verification.
5. Create Meta developer app.
6. Add WhatsApp product.
7. Get Phone Number ID and WABA ID.
8. Generate access token.
9. Configure webhook URL:

```text
https://api.your-domain.com/api/webhooks/whatsapp
```

10. Verify webhook using `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
11. Subscribe to message and status events.
12. Create message templates.
13. Submit templates for approval.
14. Test sending messages from CRM.

### Backend endpoints

```http
GET /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
POST /api/whatsapp/send-template
POST /api/whatsapp/send-session-message
```

### Recommended templates

#### Appointment confirmation

```text
Hello {{1}}, your appointment at Revive Clinic {{2}} branch is confirmed for {{3}} at {{4}}.
```

#### Appointment reminder

```text
Hello {{1}}, this is a reminder for your Revive Clinic appointment tomorrow at {{2}}.
```

#### Follow-up reminder

```text
Hello {{1}}, your follow-up with Revive Clinic is due on {{2}}. Reply to this message or call us to schedule.
```

#### Payment reminder

```text
Hello {{1}}, your pending amount for {{2}} is ₹{{3}}. Please contact Revive Clinic for payment support.
```

### Inbound message flow

```text
Client sends WhatsApp message
        ↓
Webhook receives message
        ↓
CRM checks mobile number
        ↓
Existing lead/client found?
        ↓
Yes: attach conversation to profile
No: create new WhatsApp enquiry lead
        ↓
Create staff task if human reply needed
```

## 10. WhatsApp chatbot phase

Start with a simple menu bot only.

Suggested menu:

```text
Welcome to Revive Clinic.
Please choose:
1. Book appointment
2. Know treatment packages
3. Clinic location
4. Talk to receptionist
```

Bot should collect:

- Name
- Mobile
- Concern / treatment interest
- Preferred branch
- Preferred date

Then create a CRM lead or appointment request.

Do not let the bot promise medical advice, diagnosis, or guaranteed treatment results.

## 11. CRM UI changes required

### Integrations page

Visible only to developer role.

Show:

- Meta connection status.
- Google Ads connection status.
- WhatsApp connection status.
- Last webhook received.
- Last sync result.
- Failed event count.
- Retry failed events button.

### Lead detail page

Show:

- Source platform.
- Campaign.
- Ad name.
- Form name.
- UTM details.
- Raw integration event link for developer role only.

### Communication centre

Show:

- WhatsApp conversation timeline.
- Message delivery status.
- Template send button.
- Human handoff status.

## 12. Security requirements

- Never expose access tokens to frontend.
- Store tokens only in backend environment variables or encrypted credential table.
- Verify webhook signatures where supported.
- Add rate limiting on public endpoints.
- Add captcha to website forms.
- Log all webhook events.
- Avoid showing technical API errors to normal users.
- Add developer-only diagnostics.
- Mask phone numbers in logs where possible.

## 13. Testing plan

### Website lead tests

- Submit valid enquiry.
- Submit duplicate mobile number.
- Submit missing mobile number.
- Submit invalid phone number.
- Submit with UTM values.
- Confirm lead appears in pipeline.

### Meta tests

- Verify webhook challenge.
- Submit Meta test lead.
- Confirm CRM lead creation.
- Confirm duplicate handling.
- Confirm campaign/form/ad metadata is saved.
- Confirm failed API fetch is logged.

### Google tests

- Submit Google campaign traffic to website with UTM values.
- Confirm CRM source is Google Ads.
- Confirm UTM values are stored.
- Later: test Google Ads API OAuth and reporting sync.

### WhatsApp tests

- Verify webhook challenge.
- Send inbound message to clinic number.
- Confirm message appears in CRM.
- Send appointment confirmation template.
- Confirm sent/delivered/read status updates.
- Test invalid phone number.
- Test template rejection or missing template.

## 14. Implementation phases

### Phase 1: Foundation

- Add public lead capture endpoint.
- Add UTM storage.
- Add duplicate handling.
- Connect website forms.
- Add integration event logs.

### Phase 2: WhatsApp Cloud API

- Add webhook verification.
- Add inbound message capture.
- Add outbound template sending.
- Add message status tracking.
- Add appointment confirmation/reminder templates.

### Phase 3: Meta Lead Ads

- Add Meta webhook.
- Fetch lead details from Meta Graph API.
- Map lead forms to CRM fields.
- Store campaign/ad/form metadata.
- Add retry handling for failed events.

### Phase 4: Google Ads

- Use UTM tracking first.
- Add Google Ads API credentials later.
- Sync campaign metrics.
- Add conversion upload for booked appointments and paid packages.

### Phase 5: Reporting

- Lead source dashboard.
- Campaign-to-appointment conversion.
- Cost per lead.
- Cost per appointment.
- Revenue by campaign.
- WhatsApp response and delivery reports.

## 15. Developer checklist

- [ ] Confirm production API domain.
- [ ] Add environment variables.
- [ ] Create public lead endpoint.
- [ ] Add integration event table.
- [ ] Add WhatsApp message table.
- [ ] Add webhook routes.
- [ ] Add CRM source attribution fields.
- [ ] Add website UTM capture.
- [ ] Configure Meta app and webhooks.
- [ ] Configure WhatsApp app and templates.
- [ ] Configure Google Ads UTM tracking.
- [ ] Add developer-only integration diagnostics page.
- [ ] Write automated tests for lead creation, dedupe, and webhooks.

## 16. Important production notes

- Current local CRM cannot receive external webhooks until backend is deployed publicly.
- Vercel website can send forms to local CRM only during development using a tunnel, but production requires a stable HTTPS API domain.
- WhatsApp templates must be approved before business-initiated messages can be sent.
- Google Ads API access may take time because developer token approval is required.
- UTM-based Google tracking should be implemented first because it is fast and reliable enough for early CRM attribution.

