import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEmail, normalizeMobile } from './identity.js';

test('normalizes local, country-code and trunk-prefixed Indian mobile formats', () => {
  assert.equal(normalizeMobile('+91 98765-43210'), '9876543210');
  assert.equal(normalizeMobile('09876543210'), '9876543210');
  assert.equal(normalizeMobile('98765 43210'), '9876543210');
});

test('normalizes email case and whitespace', () => {
  assert.equal(normalizeEmail(' Patient@Example.COM '), 'patient@example.com');
  assert.equal(normalizeEmail('  '), undefined);
});
