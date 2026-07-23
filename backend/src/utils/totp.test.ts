import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRecoveryCodes, generateTotpSecret, verifyTotp } from './totp.js';

test('TOTP secrets and recovery codes use deployment-safe alphabets', () => {
  assert.match(generateTotpSecret(), /^[A-Z2-7]+$/);
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.ok(codes.every((code) => /^[A-F0-9]{10}$/.test(code)));
});

test('TOTP rejects malformed and unrelated codes', () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotp(secret, 'abc123'), false);
  assert.equal(verifyTotp(secret, '000000', 0), false);
});
