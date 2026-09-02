import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessFile, validateSubmission } from './form-policy.js';

test('published form snapshots enforce visible required fields', () => {
  const fields = [{ key: 'declaration', label: 'Declaration', type: 'DECLARATION' as const, required: true, hidden: false, readOnly: false }];
  assert.throws(() => validateSubmission(fields, { declaration: false }), /required/);
  assert.doesNotThrow(() => validateSubmission(fields, { declaration: true }));
});

test('required conditional fields are enforced only when their condition is visible', () => {
  const fields = [{ key: 'details', label: 'Details', type: 'TEXT' as const, required: true, hidden: false, readOnly: false, condition: { field: 'hasDetails', operator: 'EQUALS' as const, value: true } }];
  assert.doesNotThrow(() => validateSubmission(fields, { hasDetails: false }));
  assert.throws(() => validateSubmission(fields, { hasDetails: true }), /Details is required/);
  assert.doesNotThrow(() => validateSubmission(fields, { hasDetails: true, details: 'Provided' }));
});

test('clinical-only files are not available to reception roles', () => {
  assert.equal(canAccessFile('ADMIN', 'CLINICAL_ONLY'), true);
  assert.equal(canAccessFile('RECEPTIONIST', 'CLINICAL_ONLY'), false);
  assert.equal(canAccessFile('RECEPTIONIST', 'ADMINISTRATIVE'), true);
});
