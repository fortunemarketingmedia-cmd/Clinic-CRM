import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { Request, Response, Router } from 'express';
import { errorHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { analyticsController } from '../controllers/analytics.controller.js';
import { billingController } from '../controllers/billing.controller.js';
import { patient360Controller } from '../controllers/patient-360.controller.js';
import { patient360Service } from '../services/patient-360.service.js';
import { analyticsRoutes } from './analytics.routes.js';
import { billingRoutes } from './billing.routes.js';
import { patient360Routes } from './patient-360.routes.js';

// Remove only authentication in this isolated router test; preserve every role middleware.
function withoutAuthentication(router: Router) {
  const layers = (router as unknown as { stack: Array<{ handle: unknown }> }).stack;
  const index = layers.findIndex((layer) => layer.handle === requireAuth);
  if (index !== -1) layers.splice(index, 1);
  return router;
}

async function request(role: 'ADMIN' | 'RECEPTIONIST', path: string, method = 'GET') {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'test-user', role }; next(); });
  app.use('/api/analytics', withoutAuthentication(analyticsRoutes));
  app.use('/api/billing', withoutAuthentication(billingRoutes));
  app.use('/api/clinical', withoutAuthentication(patient360Routes));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === 'object');
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: '{}' }) });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('receptionist cannot directly call finance or approval URLs; admin retains access', async (t) => {
  for (const name of ['overview', 'exportFinance', 'emailFinance', 'financeRecipients'] as const) {
    t.mock.method(analyticsController, name, async (_req: Request, res: Response) => res.json({ data: 'admin' }));
  }
  for (const name of ['outstanding', 'listCashClosings', 'decideDiscount', 'createPackageMaster'] as const) {
    t.mock.method(billingController, name, async (_req: Request, res: Response) => res.json({ data: 'admin' }));
  }
  const restricted: Array<[string, string]> = [
    ['GET', '/api/analytics'],
    ['GET', '/api/analytics/finance/export'],
    ['POST', '/api/analytics/finance/export/email'],
    ['GET', '/api/analytics/finance/export/recipients'],
    ['GET', '/api/billing/outstanding'],
    ['GET', '/api/billing/cash-closings'],
    ['POST', '/api/billing/discount-approvals/approval-1/decision'],
    ['POST', '/api/billing/package-masters'],
  ];
  for (const [method, path] of restricted) {
    const denied = await request('RECEPTIONIST', path, method);
    assert.equal(denied.status, 403, `${method} ${path}`);
    const allowed = await request('ADMIN', path, method);
    assert.equal(allowed.status, 200, `${method} ${path}`);
  }
});

test('receptionist can call operational analytics and billing URLs', async (t) => {
  t.mock.method(analyticsController, 'operations', async (_req: Request, res: Response) => res.json({ data: { analytics: { leads: {} } } }));
  t.mock.method(billingController, 'listInvoices', async (_req: Request, res: Response) => res.json({ data: [] }));
  t.mock.method(billingController, 'listPayments', async (_req: Request, res: Response) => res.json({ data: [] }));
  t.mock.method(billingController, 'listPatientPackages', async (_req: Request, res: Response) => res.json({ data: [] }));
  for (const path of ['/api/analytics/operations?branchId=branch-1', '/api/billing/invoices?branchId=branch-1&patientId=patient-1', '/api/billing/payments?branchId=branch-1&patientId=patient-1', '/api/billing/patient-packages?branchId=branch-1&patientId=patient-1']) {
    assert.equal((await request('RECEPTIONIST', path)).status, 200, path);
  }
});

test('receptionist can view prescription PDFs but cannot create or sign prescriptions', async (t) => {
  t.mock.method(patient360Controller, 'prescriptionPdf', async (_req: Request, res: Response) => res.type('application/pdf').send('pdf'));
  t.mock.method(patient360Controller, 'listPrescriptions', async (_req: Request, res: Response) => res.json({ data: [] }));
  t.mock.method(patient360Controller, 'createPrescription', async (_req: Request, res: Response) => res.status(201).json({ data: {} }));
  t.mock.method(patient360Controller, 'signPrescription', async (_req: Request, res: Response) => res.json({ data: {} }));

  assert.equal((await request('RECEPTIONIST', '/api/clinical/patients/patient-1/prescriptions')).status, 200);
  assert.equal((await request('RECEPTIONIST', '/api/clinical/prescriptions/prescription-1/pdf')).status, 200);
  assert.equal((await request('RECEPTIONIST', '/api/clinical/patients/patient-1/prescriptions', 'POST')).status, 403);
  assert.equal((await request('RECEPTIONIST', '/api/clinical/prescriptions/prescription-1/sign', 'POST')).status, 403);
});

test('prescription service denies receptionist creation before repository access', async () => {
  await assert.rejects(
    patient360Service.createPrescription('patient-1', {} as never, { id: 'receptionist-1', role: 'RECEPTIONIST', correlationId: 'test-correlation' }),
    (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 403),
  );
});
