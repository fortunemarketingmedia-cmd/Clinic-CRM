import assert from 'node:assert/strict';
import test from 'node:test';
import { intervalsOverlap, validateAppointmentTransition } from './appointment-policy.js';

test('adjacent appointment intervals do not overlap', () => {
  assert.equal(intervalsOverlap({ start: new Date('2026-01-01T10:00:00Z'), end: new Date('2026-01-01T10:30:00Z') }, { start: new Date('2026-01-01T10:30:00Z'), end: new Date('2026-01-01T11:00:00Z') }), false);
  assert.equal(intervalsOverlap({ start: new Date('2026-01-01T10:00:00Z'), end: new Date('2026-01-01T10:31:00Z') }, { start: new Date('2026-01-01T10:30:00Z'), end: new Date('2026-01-01T11:00:00Z') }), true);
});

test('appointment lifecycle rejects skipped operational states and requires reasons', () => {
  assert.throws(() => validateAppointmentTransition('CONFIRMED', 'COMPLETED', {}), /cannot move/);
  assert.throws(() => validateAppointmentTransition('CONFIRMED', 'CANCELLED', {}), /reason is required/);
  assert.doesNotThrow(() => validateAppointmentTransition('CONFIRMED', 'CHECKED_IN', {}));
  assert.throws(() => validateAppointmentTransition('CHECKED_IN', 'IN_CONSULTATION', {}), /cannot move/);
  assert.throws(() => validateAppointmentTransition('CHECKED_IN', 'COMPLETED', {}), /cannot move/);
  assert.doesNotThrow(() => validateAppointmentTransition('CHECKED_IN', 'WAITING', {}));
  assert.doesNotThrow(() => validateAppointmentTransition('WAITING', 'COMPLETED', {}));
});
