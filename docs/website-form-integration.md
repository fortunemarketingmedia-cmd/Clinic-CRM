# Website form integration

Website enquiry forms submit to:

```text
POST https://YOUR-CRM-API.example/api/public/website-leads
Content-Type: application/json
```

The temporary Vercel site `https://revive-woad.vercel.app` is allowed by the local backend CORS configuration. Add the production VPS website origin to `FRONTEND_URLS` when it is deployed.

```ts
await fetch(`${process.env.NEXT_PUBLIC_CRM_API_URL}/public/website-leads`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: form.name,
    mobile: form.mobile,
    email: form.email || undefined,
    interestedTreatment: form.treatment || undefined,
    message: form.message || undefined,
    formName: 'Website consultation form',
    pageUrl: window.location.href,
    utmSource: new URLSearchParams(window.location.search).get('utm_source') || undefined,
    utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
    utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
    website: '', // Honeypot: keep this hidden and empty.
  }),
});
```

Each submission creates an assigned lead with source `WEBSITE`, status `ASSIGNED`, an immediate follow-up action, and the submitted message/tracking details in follow-up notes. Send `branchId` when a form is explicitly for one clinic branch; otherwise the CRM assigns the first configured branch.

For Vercel, set `NEXT_PUBLIC_CRM_API_URL` to your publicly reachable API base URL, for example `https://api.your-domain.com/api`. Do not use `localhost` in Vercel environment variables.
