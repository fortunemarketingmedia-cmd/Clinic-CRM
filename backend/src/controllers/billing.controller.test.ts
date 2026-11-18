import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { errorHandler } from '../middleware/error.js';
import { billingRepository } from '../repositories/billing.repository.js';
import { invoiceSchema, paymentSchema } from '../validations/billing.validation.js';
import { billingController } from './billing.controller.js';

for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
  test(`${role} reaches patient authorization for invoice creation`, async (t) => {
    const patientLookup = t.mock.method(billingRepository, 'findPatient', async () => null);
    const createInvoice = t.mock.method(billingRepository, 'createInvoice', async () => { throw new Error('Unexpected write'); });
    const payload = { patientId: 'missing-patient', branchId: 'branch-1', items: [{ type: 'CUSTOM', description: 'Consultation', quantity: 1, unitPrice: 500, discount: 0, taxPercent: 0 }] };
    assert.equal(invoiceSchema.safeParse(payload).success, true);
    const app = express(); app.use(express.json());
    app.post('/invoices', (req, res, next) => { req.user = { id: 'user-1', role }; billingController.createInvoice(req, res).catch(next); });
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    const address = server.address(); assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/invoices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).message, 'Patient not found');
    assert.equal(patientLookup.mock.callCount(), 1);
    assert.equal(createInvoice.mock.callCount(), 0);
  });

  test(`${role} reaches patient authorization for recording payments`, async (t) => {
    const patientLookup = t.mock.method(billingRepository, 'findPatient', async () => null);
    const createPayment = t.mock.method(billingRepository, 'createPayment', async () => { throw new Error('Unexpected write'); });
    const payload = { patientId: 'missing-patient', branchId: 'branch-1', amount: 500, mode: 'CASH' };
    assert.equal(paymentSchema.safeParse(payload).success, true);
    const app = express(); app.use(express.json());
    app.post('/payments', (req, res, next) => { req.user = { id: 'user-1', role }; billingController.addPayment(req, res).catch(next); });
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    const address = server.address(); assert.ok(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).message, 'Patient not found');
    assert.equal(patientLookup.mock.callCount(), 1);
    assert.equal(createPayment.mock.callCount(), 0);
  });
}

test('receptionist invoice and payment lists require a patient scope', async () => {
  const { billingService } = await import('../services/billing.service.js');
  const actor = { id: 'user-1', role: 'RECEPTIONIST' as const, userId: 'user-1', correlationId: 'scope-test' };
  await assert.rejects(billingService.listInvoices({ branchId: 'branch-1' }, actor), { statusCode: 403 });
  await assert.rejects(billingService.listPayments({ branchId: 'branch-1' }, actor), { statusCode: 403 });
});
