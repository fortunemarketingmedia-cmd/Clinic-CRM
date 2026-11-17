import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPatientNo } from './patient.repository.js';

test('client numbers are year plus a zero-padded serial', () => {
  assert.equal(formatPatientNo(2026, 1), '2026-0001');
  assert.equal(formatPatientNo(2026, 42), '2026-0042');
  assert.equal(formatPatientNo(2027, 12345), '2027-12345');
});
