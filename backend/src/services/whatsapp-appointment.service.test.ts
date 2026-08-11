import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppointmentTemplatePayload } from './whatsapp-appointment.service.js';

test('appointment booking builds an Indian WhatsApp template payload', () => {
  const requestBody = buildAppointmentTemplatePayload('9876543210');
  assert.equal(requestBody.messaging_product, 'whatsapp');
  assert.equal(requestBody.type, 'template');
  assert.equal(requestBody.to, '919876543210');
  assert.ok(requestBody.template.name);
  assert.ok(requestBody.template.language.code);
});
