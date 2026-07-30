# WhatsApp Cloud API Cost Report for Revive CRM

Prepared for: Revive Clinic CRM  
Scope: Official Meta WhatsApp Cloud API usage for clinic operations  
Client country: India only  
Excluded from estimate: marketing broadcasts, promotional campaigns, and authentication/OTP messages  
Currency: INR  
Prepared date: 29 July 2026

## 1. Executive summary

Revive CRM can use the official Meta WhatsApp Cloud API at a low monthly cost if it is limited to clinic operations such as appointment confirmations, appointment reminders, treatment follow-ups, prescription-ready alerts, and receptionist replies. This report assumes all clients have Indian WhatsApp numbers.

The expected monthly WhatsApp messaging cost is approximately:

| Usage level | Estimated monthly Meta messaging cost | Estimated with 18% GST |
|---|---:|---:|
| Low clinic usage | ₹100 - ₹250 | ₹118 - ₹295 |
| Medium clinic usage | ₹250 - ₹700 | ₹295 - ₹826 |
| High clinic usage | ₹700 - ₹1,500 | ₹826 - ₹1,770 |

The most likely starting budget for Revive CRM is:

```text
₹300 - ₹800 per month
```

This assumes the clinic is not sending marketing campaigns and not using WhatsApp OTP/authentication.

## 2. Pricing model

Meta charges WhatsApp Business Platform messages based on:

1. Recipient country
2. Message category
3. Delivered messages, not merely attempted messages

Because Revive Clinic clients are India-only, this report uses India message-rate assumptions throughout. If the clinic later messages clients outside India, the cost must be recalculated using that country’s WhatsApp rate.

The relevant categories for Revive CRM are:

| Category | Used by Revive CRM? | Example | Cost impact |
|---|---|---|---|
| Service | Yes | Receptionist replies after client messages first | Usually free inside 24-hour service window |
| Utility | Yes | Appointment reminder, prescription ready, payment reminder | Paid per delivered message |
| Marketing | No | Offers, promotions, campaigns | Excluded |
| Authentication | No | OTP/login codes | Excluded |

Official references:

- Meta / WhatsApp Business Platform pricing: https://whatsappbusiness.com/products/platform-pricing/
- Meta developer pricing documentation: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

## 3. Working rate assumption for India

For this India-only report, we use the following working estimate:

```text
Utility message: ₹0.115 per delivered message
Service message inside 24-hour customer service window: ₹0
```

Final billing must still be checked in Meta Business Manager because Meta rates can change by date, but no multi-country pricing calculation is required as long as the CRM sends only to Indian numbers.

## 4. CRM features included in this estimate

The estimate includes the following Revive CRM features:

| CRM feature | WhatsApp category | Estimated cost |
|---|---|---:|
| Appointment booking confirmation | Utility | ₹0.115/message |
| Appointment reminder | Utility | ₹0.115/message |
| Appointment reschedule update | Utility | ₹0.115/message |
| Appointment cancellation update | Utility | ₹0.115/message |
| Treatment follow-up | Utility | ₹0.115/message |
| Prescription ready alert | Utility | ₹0.115/message |
| Package/session reminder | Utility | ₹0.115/message |
| Payment reminder | Utility | ₹0.115/message |
| Receptionist manual reply after client message | Service | ₹0 inside 24-hour window |
| Simple rule-based chatbot reply after client starts chat | Service | ₹0 inside 24-hour window |

## 5. Per-client / per-appointment cost

### Basic appointment workflow

Messages:

1. Appointment confirmation
2. Appointment reminder
3. Post-visit / treatment follow-up

Calculation:

```text
3 messages × ₹0.115 = ₹0.345 per appointment/client
```

### Better operational workflow

Messages:

1. Appointment confirmation
2. Appointment reminder
3. Prescription-ready alert or treatment follow-up
4. Next-session/package reminder

Calculation:

```text
4 messages × ₹0.115 = ₹0.46 per appointment/client
```

### Heavy utility workflow

Messages:

1. Appointment confirmation
2. Appointment reminder
3. Reschedule/cancellation update
4. Treatment follow-up
5. Payment/package/session reminder

Calculation:

```text
5 messages × ₹0.115 = ₹0.575 per appointment/client
```

## 6. Monthly cost scenarios

### Scenario A: Low usage clinic

Assumptions:

- 300 appointments/month
- 3 utility messages per appointment/client
- No marketing
- No authentication

Calculation:

```text
300 × 3 × ₹0.115 = ₹103.50
With 18% GST = ₹122.13
```

Estimated monthly cost:

```text
₹100 - ₹150
```

### Scenario B: Medium usage clinic

Assumptions:

- 600 appointments/month
- 4 utility messages per appointment/client
- No marketing
- No authentication

Calculation:

```text
600 × 4 × ₹0.115 = ₹276
With 18% GST = ₹325.68
```

Estimated monthly cost:

```text
₹275 - ₹350
```

### Scenario C: High usage clinic

Assumptions:

- 1,000 appointments/month
- 5 utility messages per appointment/client
- No marketing
- No authentication

Calculation:

```text
1,000 × 5 × ₹0.115 = ₹575
With 18% GST = ₹678.50
```

Estimated monthly cost:

```text
₹575 - ₹700
```

### Scenario D: High automation with extra reminders

Assumptions:

- 1,500 appointments/month
- 6 utility messages per appointment/client
- No marketing
- No authentication

Calculation:

```text
1,500 × 6 × ₹0.115 = ₹1,035
With 18% GST = ₹1,221.30
```

Estimated monthly cost:

```text
₹1,000 - ₹1,250
```

## 7. Per-user cost estimate

In this context, "per user" means per CRM user/staff member using WhatsApp through the CRM.

Meta Cloud API itself does not normally charge per CRM staff user. It charges by delivered WhatsApp messages.

Therefore:

```text
Per-user cost = monthly WhatsApp message cost ÷ number of active CRM users
```

Example estimates:

| Monthly usage scenario | Total monthly cost with GST | 2 CRM users | 3 CRM users | 5 CRM users |
|---|---:|---:|---:|---:|
| Low: 300 appointments × 3 messages | ₹122 | ₹61/user | ₹41/user | ₹24/user |
| Medium: 600 appointments × 4 messages | ₹326 | ₹163/user | ₹109/user | ₹65/user |
| High: 1,000 appointments × 5 messages | ₹679 | ₹340/user | ₹226/user | ₹136/user |
| Heavy: 1,500 appointments × 6 messages | ₹1,221 | ₹611/user | ₹407/user | ₹244/user |

Important: this is only a management allocation. Meta will not bill separately per receptionist/doctor.

## 8. Chatbot cost impact

A simple CRM chatbot can remain low cost if it replies only after the client messages first.

Example:

```text
Client: Hi
Bot: Welcome to Revive Clinic. Choose:
1. Book appointment
2. Clinic location
3. Talk to receptionist
```

Because the client initiated the chat, chatbot replies inside the 24-hour service window are service messages.

Expected cost:

```text
Chatbot replies inside 24-hour window: ₹0
Appointment confirmation/reminder generated later: ₹0.115/message
```

Recommended chatbot scope:

- Book appointment request
- Select branch
- Select service/concern
- Ask preferred date/time
- Clinic timings/location
- Talk to receptionist

Avoid initially:

- AI medical advice
- Promotional campaigns
- Marketing reactivation
- WhatsApp OTP/authentication

## 9. Recommended starting automation plan

Start with these messages:

| Automation | Category | Recommended |
|---|---|---|
| Appointment booked confirmation | Utility | Yes |
| Appointment reminder 1 day before | Utility | Yes |
| Appointment reminder 1 hour before | Utility | Optional |
| Treatment follow-up | Utility | Yes |
| Prescription ready | Utility | Yes |
| Payment reminder | Utility | Optional |
| Package/session reminder | Utility | Optional |
| Marketing broadcast | Marketing | No |
| OTP/login | Authentication | No |

Recommended starting budget:

```text
₹500/month
```

Safe upper starting budget:

```text
₹1,000/month
```

This should be enough for normal clinic appointment and follow-up automation without marketing.

## 10. Cost control recommendations

1. Keep marketing disabled.
2. Use WhatsApp only for operational messages.
3. Avoid sending multiple small reminders; combine useful information into one message.
4. Use the CRM inbox for free replies when the client messages first.
5. Use chatbot only after customer initiation.
6. Track message delivery count monthly.
7. Add a monthly WhatsApp budget alert in CRM later.

## 11. Final recommendation

For Revive CRM, official Meta WhatsApp Cloud API is financially suitable if used only for utility communication and service-window replies.

Because all clients are from India, the clinic can use one simple pricing assumption for planning:

```text
Utility message = approximately ₹0.115 per delivered message
Service reply inside 24-hour customer window = ₹0
```

Recommended budget:

```text
Normal month: ₹300 - ₹800
High usage month: ₹800 - ₹1,500
```

Per staff/user allocation:

```text
Usually ₹50 - ₹250 per CRM user/month
```

This makes WhatsApp automation affordable for appointment operations, follow-ups, prescriptions, and basic chatbot flows, while avoiding the expensive marketing category.
