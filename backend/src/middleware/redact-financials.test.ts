import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { sensitiveResponse } from './sensitive-response.js';
import { redactFinancials } from './redact-financials.js';

test('patient billing remains visible while aggregate finance is removed', () => {
  const body = {
    data: {
      id: 'p1', invoices: [{ id: 'i1', totalAmount: 500, payments: [{ amount: 200 }] }],
      summary: { outstandingAmount: 300, paidAmount: 200 },
      packages: [{ amount: 18000, paidAmount: 9000 }],
      timeline: [{ type: 'PAYMENT_COLLECTED', description: 'Rs 200' }],
      totals: { revenue: 500, monthlyRevenue: 500 },
      byBranch: [{ _count: { leads: 2, invoices: 1 } }],
      analytics: { financial: { billed: 500 }, trend: [{ leads: 2, billed: 500, collected: 200 }] },
    },
  };
  assert.deepEqual(redactFinancials(body), {
    data: {
      id: 'p1', invoices: [{ id: 'i1', totalAmount: 500, payments: [{ amount: 200 }] }],
      summary: { outstandingAmount: 300, paidAmount: 200 },
      packages: [{ amount: 18000, paidAmount: 9000 }],
      timeline: [{ type: 'PAYMENT_COLLECTED', description: 'Rs 200' }],
      totals: {}, byBranch: [{ _count: { leads: 2 } }], analytics: { trend: [{ leads: 2 }] },
    },
  });
});

for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
  test(`JSON response preserves ${role} permitted fields`, () => {
    const body = { data: { invoices: [{ totalAmount: 500 }], financial: { billed: 500 } } };
    let result: unknown;
    const req = { user: { id: 'u1', role } } as Request;
    const res = { setHeader() { return this; }, json(value: unknown) { result = value; return this; } } as unknown as Response;
    sensitiveResponse(req, res, () => undefined);
    res.json(body);
    assert.deepEqual(result, role === 'ADMIN' ? body : { data: { invoices: [{ totalAmount: 500 }] } });
  });
}
