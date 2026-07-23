import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { decryptIntegrationSecret, encryptIntegrationSecret } from '../utils/integration-crypto.js';
import { canAdvanceMessageStatus, isQuietHour, isWhatsAppOptOut, normalizeWhatsAppPhone, renderWhatsAppTemplate, verifyWhatsAppSignature } from './whatsapp-policy.js';

test('integration secrets are authenticated and not stored in plaintext', () => { const key = 'phase-seven-encryption-key-at-least-32'; const encrypted = encryptIntegrationSecret('provider-token', key); assert.equal(encrypted.includes('provider-token'), false); assert.equal(decryptIntegrationSecret(encrypted, key), 'provider-token'); assert.throws(() => decryptIntegrationSecret(`${encrypted}x`, key)); });
test('WhatsApp webhook signatures reject tampering', () => { const body = Buffer.from('{"entry":[]}'); const secret = 'meta-app-secret'; const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`; assert.equal(verifyWhatsAppSignature(body, signature, secret), true); assert.equal(verifyWhatsAppSignature(Buffer.from('tampered'), signature, secret), false); });
test('opt-out terms and phone formats are normalized', () => { assert.equal(isWhatsAppOptOut(' remove me. '), true); assert.equal(isWhatsAppOptOut('continue'), false); assert.equal(normalizeWhatsAppPhone('+91 98765-43210'), '919876543210'); });
test('quiet hours and message status transitions are deterministic', () => { assert.equal(isQuietHour(new Date('2026-07-21T18:30:00Z'), 1260, 540), true); assert.equal(canAdvanceMessageStatus('DELIVERED', 'SENT'), false); assert.equal(canAdvanceMessageStatus('SENT', 'READ'), true); });
test('template rendering uses managed variable positions', () => { assert.equal(renderWhatsAppTemplate('Hello {{1}}, appointment {{2}}', ['Asha', 'tomorrow']), 'Hello Asha, appointment tomorrow'); });
