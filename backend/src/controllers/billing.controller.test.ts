import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { errorHandler } from '../middleware/error.js';
import { billingRepository } from '../repositories/billing.repository.js';
import { invoiceSchema } from '../validations/billing.validation.js';
import { billingController } from './billing.controller.js';

test('invoice creation rejects an authenticated receptionist with a valid payload before database writes', async (t) => {
  const userId = 'invoice-permission-regression';
  const patientLookup = t.mock.method(billingRepository, 'findPatient', async () => { throw new Error('Authorization must run before patient lookup'); });
  const createInvoice = t.mock.method(billingRepository, 'createInvoice', async () => { throw new Error('Unauthorized invoice write'); });
  const payload = {
    patientId: 'patient-regression', branchId: 'branch-regression',
    items: [{ type: 'CUSTOM', description: 'Consultation', quantity: 1, unitPrice: 500, discount: 0, taxPercent: 0 }],
  };
  assert.equal(invoiceSchema.safeParse(payload).success, true);

  const app = express();
  app.use(express.json());
  // Authentication is covered separately by the live API verification.
  app.post('/api/billing/invoices', (req, res, next) => {
    req.user = { id: userId, role: 'RECEPTIONIST' };
    billingController.createInvoice(req, res).catch(next);
  });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/billing/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).message, 'Billing access is required');
  assert.equal(patientLookup.mock.callCount(), 0);
  assert.equal(createInvoice.mock.callCount(), 0);
});
