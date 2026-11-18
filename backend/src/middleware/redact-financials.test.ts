import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { sensitiveResponse } from './sensitive-response.js';
import { redactFinancials } from './redact-financials.js';

test('financial fields are removed at every depth while operational data is kept', () => {
  const patient = {
    id: 'p1', fullName: 'A',
    invoices: [{ id: 'i1', totalAmount: '100' }],
    summary: { sessionsRemaining: 2, outstandingAmount: 500 },
    packages: [{ name: 'Laser', totalSessions: 6, completedSessions: 2, amount: '18000', paidAmount: '9000' }],
    appointments: [{ id: 'a1', status: 'CONFIRMED', advancePaymentStatus: 'PAID', appointmentAt: new Date('2026-01-01T00:00:00Z') }],
  };
  const result = redactFinancials(patient);
  assert.equal('invoices' in result, false);
  assert.deepEqual(result.summary, { sessionsRemaining: 2 });
  assert.deepEqual(result.packages, [{ name: 'Laser', totalSessions: 6, completedSessions: 2 }]);
  assert.equal('advancePaymentStatus' in result.appointments[0], false);
  assert.ok(result.appointments[0].appointmentAt instanceof Date);
});

for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
  test(`JSON responses preserve operational data and enforce ${role} financial visibility`, () => {
    const body = { data: { id: 'p1', totalAmount: 500, appointments: [{ id: 'a1', unitPrice: 500 }] } };
    let result: unknown;
    let continued = false;
    const req = { user: { id: 'u1', role } } as Request;
    const res = { setHeader() { return this; }, json(value: unknown) { result = value; return this; } } as unknown as Response;
    sensitiveResponse(req, res, () => { continued = true; });
    res.json(body);
    assert.equal(continued, true);
    assert.deepEqual(result, role === 'ADMIN' ? body : { data: { id: 'p1', appointments: [{ id: 'a1' }] } });
    assert.equal(body.data.totalAmount, 500);
    assert.equal(body.data.appointments[0].unitPrice, 500);
  });
}

test('financial events and waitlist estimates cannot bypass response redaction', () => {
  assert.deepEqual(redactFinancials({ estimatedAmount: '999', timeline: [{ type: 'PAYMENT_COLLECTED', description: 'Rs 999' }, { type: 'APPOINTMENT_BOOKED', description: 'Booked' }] }), { timeline: [{ type: 'APPOINTMENT_BOOKED', description: 'Booked' }] });
});
