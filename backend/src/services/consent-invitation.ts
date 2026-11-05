import crypto from 'node:crypto';
import { HttpError } from '../utils/http-error.js';

export type ConsentInvitationAccess = {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

export function createConsentInvitationToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function consentInvitationTokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function publicConsentUrl(frontendUrl: string, token: string) {
  return new URL(`/consent/${encodeURIComponent(token)}`, frontendUrl).toString();
}

export function consentInvitationState(invitation: ConsentInvitationAccess, now = new Date()) {
  if (invitation.revokedAt) return 'revoked' as const;
  if (invitation.usedAt) return 'completed' as const;
  if (invitation.expiresAt <= now) return 'expired' as const;
  return 'active' as const;
}

export function requireActiveConsentInvitation(invitation: ConsentInvitationAccess, now = new Date()) {
  const state = consentInvitationState(invitation, now);
  if (state === 'revoked') throw new HttpError(410, 'This consent link has been revoked. Please ask the clinic for a new link.');
  if (state === 'completed') throw new HttpError(409, 'This consent link has already been completed');
  if (state === 'expired') throw new HttpError(410, 'This consent link has expired. Please ask the clinic for a new link.');
}
