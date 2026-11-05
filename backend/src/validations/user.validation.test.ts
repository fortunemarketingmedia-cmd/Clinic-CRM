import assert from 'node:assert/strict';
import test from 'node:test';
import { createUserSchema } from './user.validation.js';

const base = { name: 'Front Desk', email: '  Reception@Clinic.COM ', role: 'RECEPTIONIST' as const };

test('new user emails are trimmed and lower-cased', () => {
  assert.equal(createUserSchema.parse({ ...base, password: 'Clinic2026' }).email, 'reception@clinic.com');
});

test('new passwords need a letter and a number and must fit bcrypt', () => {
  assert.equal(createUserSchema.safeParse({ ...base, password: 'password' }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, password: '12345678' }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, password: 'Ab1' }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, password: `A1${'x'.repeat(71)}` }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, password: 'Clinic2026' }).success, true);
});
