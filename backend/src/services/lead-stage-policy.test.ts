import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLeadTransition } from './lead-stage-policy.js';

const activeLead = { status: 'ASSIGNED' as const, ownerId: 'user-1', nextAction: 'Call', nextActionDueAt: new Date(), appointmentCount: 0 };

test('active lead keeps owner and next action invariant', () => {
  assert.doesNotThrow(() => validateLeadTransition(activeLead, { status: 'CONNECTED' }));
  assert.throws(() => validateLeadTransition({ ...activeLead, ownerId: null }, { status: 'CONNECTED' }), /require an owner/);
});

test('qualified stage requires an explained score', () => {
  assert.throws(() => validateLeadTransition(activeLead, { status: 'QUALIFIED' }), /Qualification notes/);
  assert.doesNotThrow(() => validateLeadTransition(activeLead, { status: 'QUALIFIED', qualificationNotes: 'Ready this month', leadScore: 80 }));
});

test('lost and disqualified stages require reasons', () => {
  assert.throws(() => validateLeadTransition(activeLead, { status: 'LOST' }), /Lost reason/);
  assert.throws(() => validateLeadTransition(activeLead, { status: 'DISQUALIFIED' }), /Disqualification reason/);
});

