import bcrypt from 'bcrypt';
import { Prisma, AccessLevel as AccessLevelEnum, UserStatus, type AccessLevel, type Role } from '@prisma/client';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { HttpError } from '../utils/http-error.js';
import { prisma } from '../config/db.js';
import { integrationRepository } from '../repositories/integration.repository.js';
import { decryptIntegrationSecret } from '../utils/integration-crypto.js';
import { verifyTotp } from '../utils/totp.js';
import { env } from '../config/env.js';
import {
  createTokenId,
  getRefreshTokenExpiry,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js';

type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

// Compared against when the email is unknown so a failed login takes the same time whether or not the account exists.
const timingEqualiserHash = bcrypt.hashSync('timing-equaliser-not-a-password', 12);
// A refresh token presented again this long after it was rotated is treated as stolen (see refresh below).
const refreshReuseGraceMs = 60_000;

function isOperationalAccount(accessLevel: AccessLevel): accessLevel is 'ADMIN' | 'RECEPTIONIST' {
  return accessLevel === AccessLevelEnum.ADMIN || accessLevel === AccessLevelEnum.RECEPTIONIST;
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  accessLevel: AccessLevel;
  status: UserStatus;
  mfaEnabled?: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.accessLevel as Role,
    status: user.status,
    mfaEnabled: Boolean(user.mfaEnabled),
  };
}

export const authService = {
  async login(email: string, password: string, meta: RequestMeta, mfa?: { code?: string; recoveryCode?: string }) {
    const user = await userRepository.findByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE || !isOperationalAccount(user.accessLevel)) {
      await bcrypt.compare(password, timingEqualiserHash);
      await integrationRepository.createLoginEvent({ email, success: false, reason: 'INVALID_CREDENTIALS', ipAddress: meta.ipAddress, userAgent: meta.userAgent });
      throw new HttpError(401, 'Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      await integrationRepository.createLoginEvent({ userId: user.id, email, success: false, reason: 'INVALID_CREDENTIALS', ipAddress: meta.ipAddress, userAgent: meta.userAgent });
      throw new HttpError(401, 'Invalid email or password');
    }

    if (user.mfaEnabled) {
      let verified = false;
      if (mfa?.code && user.mfaSecretCiphertext) {
        const secret = decryptIntegrationSecret(user.mfaSecretCiphertext, env.INTEGRATION_ENCRYPTION_KEY ?? `${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`);
        verified = verifyTotp(secret, mfa.code);
      } else if (mfa?.recoveryCode && Array.isArray(user.mfaRecoveryCodes)) {
        const hashes = user.mfaRecoveryCodes.filter((item): item is string => typeof item === 'string');
        for (let index = 0; index < hashes.length; index += 1) if (await bcrypt.compare(mfa.recoveryCode.toUpperCase(), hashes[index])) { hashes.splice(index, 1); const claimed = await prisma.user.updateMany({ where: { id: user.id, mfaEnabled: true, mfaRecoveryCodes: { equals: user.mfaRecoveryCodes as Prisma.InputJsonValue } }, data: { mfaRecoveryCodes: hashes } }); verified = claimed.count === 1; break; }
      }
      if (!mfa?.code && !mfa?.recoveryCode) return { mfaRequired: true as const };
      if (!verified) { await integrationRepository.createLoginEvent({ userId: user.id, email, success: false, reason: 'INVALID_MFA', ipAddress: meta.ipAddress, userAgent: meta.userAgent }); throw new HttpError(401, 'Invalid MFA code'); }
    }

    const session = { userId: user.id, role: user.accessLevel, version: user.sessionVersion };
    const accessPayload = { sub: user.id, role: session.role, version: session.version };
    const refreshToken = signRefreshToken({ ...accessPayload, jti: createTokenId() });

    await refreshTokenRepository.create({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    }, session);
    await integrationRepository.createLoginEvent({ userId: user.id, email, success: true, ipAddress: meta.ipAddress, userAgent: meta.userAgent });

    return {
      user: serializeUser(user),
      accessToken: signAccessToken(accessPayload),
      refreshToken,
    };
  },

  async refresh(refreshToken: string, meta: RequestMeta) {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const storedToken = await refreshTokenRepository.findActiveByHash(tokenHash);

    if (!storedToken) {
      // A rotated token coming back well after rotation means a copy of it was taken: end every session of that user.
      // Within the grace window it is a second tab (or a retried request) racing the same rotation, which is harmless.
      const previous = await refreshTokenRepository.findByHash(tokenHash);
      if (previous?.revokedAt && previous.userId === payload.sub && previous.user.sessionVersion === (payload.version ?? 0) && Date.now() - previous.revokedAt.getTime() > refreshReuseGraceMs) {
        await refreshTokenRepository.revokeAllForUser(previous.userId);
      }
      throw new HttpError(401, 'Invalid refresh token');
    }
    if (storedToken.userId !== payload.sub || storedToken.user.status !== UserStatus.ACTIVE || !isOperationalAccount(storedToken.user.accessLevel) || storedToken.user.accessLevel !== payload.role || storedToken.user.sessionVersion !== (payload.version ?? 0)) {
      throw new HttpError(401, 'Invalid refresh token');
    }

    const session = { userId: storedToken.userId, role: storedToken.user.accessLevel, version: storedToken.user.sessionVersion };
    const accessPayload = { sub: session.userId, role: session.role, version: session.version };
    const nextRefreshToken = signRefreshToken({ ...accessPayload, jti: createTokenId() });

    await refreshTokenRepository.rotate(tokenHash, {
      tokenHash: hashToken(nextRefreshToken),
      userId: storedToken.user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    }, session);

    return {
      user: serializeUser(storedToken.user),
      accessToken: signAccessToken(accessPayload),
      refreshToken: nextRefreshToken,
    };
  },

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    await refreshTokenRepository.revokeByHash(hashToken(refreshToken));
  },

  async logoutAll(userId: string) {
    await refreshTokenRepository.endAllSessions(userId);
  },

  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user || user.status !== UserStatus.ACTIVE || !isOperationalAccount(user.accessLevel)) {
      throw new HttpError(401, 'User is not active');
    }

    return serializeUser(user);
  },
};
