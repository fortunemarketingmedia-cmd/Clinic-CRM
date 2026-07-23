import crypto from 'node:crypto';

const base = process.env.PHASE7_API_URL ?? 'http://127.0.0.1:4040/api';
const appSecret = 'phase7-app-secret';
let token = '';

async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return { status: response.status, body };
}

function signedWebhook(payload) {
  const raw = JSON.stringify(payload);
  return request('/whatsapp/webhook', { method: 'POST', headers: { 'x-hub-signature-256': `sha256=${crypto.createHmac('sha256', appSecret).update(raw).digest('hex')}` }, body: raw });
}

const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@reviveclinic.local', password: 'Admin@12345' }) });
token = login.body.accessToken;
const branches = await request('/branches');
const branchId = branches.body.data[0].id;
const account = await request('/whatsapp/accounts', { method: 'POST', body: JSON.stringify({ name: 'Phase 7 Test Account', businessAccountId: 'waba_phase7', appId: 'meta-app-phase7', accessToken: 'phase7-access-token', appSecret, verifyToken: 'phase7-verify-token', apiVersion: 'v23.0', phoneNumbers: [{ branchId, phoneNumberId: 'meta-phone-phase7', displayPhoneNumber: '+91 98765 00001', verifiedName: 'Revive Test', isDefault: true }] }) });
if (!account.body.data.credentialsConfigured || 'accessTokenCiphertext' in account.body.data) throw new Error('Account response leaked or omitted credential state');
const accountId = account.body.data.id;
const phoneId = account.body.data.phoneNumbers[0].id;
const templates = await request(`/whatsapp/templates/sync/${accountId}`, { method: 'POST', body: '{}' });
const appointmentTemplate = templates.body.data.find((item) => item.name === 'appointment_booked');
if (!appointmentTemplate || appointmentTemplate.status !== 'APPROVED') throw new Error('Provider template did not synchronize as approved');
await request(`/whatsapp/templates/${appointmentTemplate.id}`, { method: 'PATCH', body: JSON.stringify({ group: 'APPOINTMENT' }) });

const mobile = '+91 98765 12345';
await request('/whatsapp/consents', { method: 'POST', body: JSON.stringify({ phoneNumber: mobile, category: 'APPOINTMENT_NOTIFICATIONS', granted: true, source: 'PHASE7_SMOKE', consentTextVersion: 'smoke-v1' }) });
const conversation = await request('/whatsapp/conversations', { method: 'POST', body: JSON.stringify({ phoneNumberId: phoneId, mobile, contactName: 'Phase Seven Patient' }) });
const conversationId = conversation.body.data.id;
const queued = await request(`/whatsapp/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ templateId: appointmentTemplate.id, variables: ['Phase Seven Patient', 'Revive Clinic', 'tomorrow 10:00'], category: 'UTILITY' }) });
await request('/whatsapp/jobs/process', { method: 'POST', body: JSON.stringify({ limit: 20 }) });
let detail = await request(`/whatsapp/conversations/${conversationId}`);
const sent = detail.body.data.messages.find((item) => item.id === queued.body.data.id);
if (sent.status !== 'SUBMITTED' || !sent.providerMessageId) throw new Error('Queued message was not submitted through the provider adapter');

const deliveryPayload = { object: 'whatsapp_business_account', entry: [{ id: 'waba_phase7', changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'meta-phone-phase7' }, statuses: [{ id: sent.providerMessageId, status: 'delivered', timestamp: String(Math.floor(Date.now() / 1000)) }] } }] }] };
const delivery = await signedWebhook(deliveryPayload);
const duplicate = await signedWebhook(deliveryPayload);
if (delivery.status !== 202 || duplicate.status !== 200 || !duplicate.body.duplicate) throw new Error('Webhook idempotency contract failed');
await request('/whatsapp/jobs/process', { method: 'POST', body: JSON.stringify({ limit: 20 }) });
detail = await request(`/whatsapp/conversations/${conversationId}`);
if (detail.body.data.messages.find((item) => item.id === sent.id).status !== 'DELIVERED') throw new Error('Delivery webhook did not advance message status');

const inboundPayload = { object: 'whatsapp_business_account', entry: [{ id: 'waba_phase7', changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'meta-phone-phase7' }, contacts: [{ wa_id: '919876512345', profile: { name: 'Phase Seven Patient' } }], messages: [{ id: 'wamid.inbound.phase7', from: '919876512345', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Please help me reschedule' } }] } }] }] };
await signedWebhook(inboundPayload);
await request('/whatsapp/jobs/process', { method: 'POST', body: JSON.stringify({ limit: 20 }) });
detail = await request(`/whatsapp/conversations/${conversationId}`);
if (!detail.body.data.messages.some((item) => item.providerMessageId === 'wamid.inbound.phase7') || !detail.body.data.sessionExpiresAt) throw new Error('Inbound message did not open the service window');

const optOutPayload = { object: 'whatsapp_business_account', entry: [{ id: 'waba_phase7', changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'meta-phone-phase7' }, messages: [{ id: 'wamid.optout.phase7', from: '919876512345', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'DO NOT MESSAGE' } }] } }] }] };
await signedWebhook(optOutPayload);
await request('/whatsapp/jobs/process', { method: 'POST', body: JSON.stringify({ limit: 20 }) });
const consents = await request('/whatsapp/consents?phone=919876512345');
for (const category of ['MARKETING_MESSAGES', 'PROMOTIONAL_BROADCASTS']) if (!consents.body.data.some((item) => item.category === category && item.granted === false)) throw new Error(`${category} opt-out was not recorded`);

const invalidRaw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'waba_phase7' }] });
const invalid = await fetch(`${base}/whatsapp/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=invalid' }, body: invalidRaw });
if (invalid.status !== 401) throw new Error('Invalid webhook signature was not rejected');

console.log(JSON.stringify({ accountId, conversationId, messageId: sent.id, providerMessageId: sent.providerMessageId, delivery: 'DELIVERED', duplicateWebhook: true, inbound: true, optOut: true, invalidSignatureRejected: true }, null, 2));
