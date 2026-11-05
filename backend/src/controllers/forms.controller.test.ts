import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { formsService } from '../services/forms.service.js';
import { formsController } from './forms.controller.js';

test('public consent read does not require an authenticated CRM user', async (t) => {
  t.mock.method(formsService, 'getPublicConsent', async (token: string) => ({ completed: false as const, token } as never));
  let responseBody: unknown;
  const req = { params: { token: 'patient-token' } } as unknown as Request;
  const res = { json(body: unknown) { responseBody = body; return this; } } as unknown as Response;

  await formsController.getPublicConsent(req, res);

  assert.deepEqual(responseBody, { data: { completed: false, token: 'patient-token' } });
});

test('public consent submission does not require an authenticated CRM user', async (t) => {
  t.mock.method(formsService, 'submitPublicConsent', async () => ({ completed: true as const }));
  let statusCode: number | undefined;
  let responseBody: unknown;
  const req = {
    params: { token: 'patient-token' },
    body: { signerName: 'Patient Name', signatureBase64: `data:image/png;base64,${'a'.repeat(32)}` },
    ip: '203.0.113.10',
    correlationId: 'test-correlation',
    header: () => 'mobile-browser',
  } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; return this; },
  } as unknown as Response;

  await formsController.submitPublicConsent(req, res);

  assert.equal(statusCode, 201);
  assert.deepEqual(responseBody, { data: { completed: true } });
});
