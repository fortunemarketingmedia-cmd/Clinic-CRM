import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../utils/http-error.js';
import { consentInvitationState, consentInvitationTokenHash, createConsentInvitationToken, publicConsentUrl, requireActiveConsentInvitation } from './consent-invitation.js';

const now = new Date('2026-11-06T00:00:00.000Z');
const invitation = (overrides: Partial<{ expiresAt: Date; usedAt: Date | null; revokedAt: Date | null }> = {}) => ({
  expiresAt: new Date('2026-11-07T00:00:00.000Z'),
  usedAt: null,
  revokedAt: null,
  ...overrides,
});

test('consent invitation tokens are random, URL-safe, and only their SHA-256 hash is stable', () => {
  const first = createConsentInvitationToken();
  const second = createConsentInvitationToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(consentInvitationTokenHash(first), /^[a-f0-9]{64}$/);
  assert.notEqual(consentInvitationTokenHash(first), first);
});

test('a valid consent invitation is active', () => {
  assert.equal(consentInvitationState(invitation(), now), 'active');
  assert.doesNotThrow(() => requireActiveConsentInvitation(invitation(), now));
});

test('expired, revoked, and completed consent invitations are rejected with distinct responses', () => {
  const cases = [
    [invitation({ expiresAt: now }), 'expired', 410],
    [invitation({ revokedAt: now }), 'revoked', 410],
    [invitation({ usedAt: now }), 'completed', 409],
  ] as const;
  for (const [candidate, state, status] of cases) {
    assert.equal(consentInvitationState(candidate, now), state);
    assert.throws(() => requireActiveConsentInvitation(candidate, now), (error: unknown) => error instanceof HttpError && error.statusCode === status);
  }
});

test('a tampered token hashes to a different lookup key', () => {
  const token = createConsentInvitationToken();
  const replacement = token.endsWith('A') ? 'B' : 'A';
  const tampered = `${token.slice(0, -1)}${replacement}`;
  assert.notEqual(consentInvitationTokenHash(token), consentInvitationTokenHash(tampered));
});

test('WhatsApp links always target the dedicated public consent route', () => {
  assert.equal(publicConsentUrl('https://crm.example/login', 'patient_token'), 'https://crm.example/consent/patient_token');
});
