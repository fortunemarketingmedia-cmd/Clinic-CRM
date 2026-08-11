import bcrypt from 'bcrypt';
import { UserStatus, type AccessLevel, type Role } from '@prisma/client';
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

    if (!user || user.status !== UserStatus.ACTIVE || user.accessLevel === 'DEVELOPER') {
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
        for (let index = 0; index < hashes.length; index += 1) if (await bcrypt.compare(mfa.recoveryCode.toUpperCase(), hashes[index])) { verified = true; hashes.splice(index, 1); await prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: hashes } }); break; }
      }
      if (!mfa?.code && !mfa?.recoveryCode) return { mfaRequired: true as const };
      if (!verified) { await integrationRepository.createLoginEvent({ userId: user.id, email, success: false, reason: 'INVALID_MFA', ipAddress: meta.ipAddress, userAgent: meta.userAgent }); throw new HttpError(401, 'Invalid MFA code'); }
    }

    const accessPayload = { sub: user.id, role: user.accessLevel as Role };
    const refreshToken = signRefreshToken({ ...accessPayload, jti: createTokenId() });

    await refreshTokenRepository.create({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    });
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

    if (!storedToken || storedToken.userId !== payload.sub || storedToken.user.status !== UserStatus.ACTIVE || storedToken.user.accessLevel === 'DEVELOPER') {
      throw new HttpError(401, 'Invalid refresh token');
    }

    await refreshTokenRepository.revokeByHash(tokenHash);

    const nextRefreshToken = signRefreshToken({
      sub: storedToken.user.id,
      role: storedToken.user.accessLevel as Role,
      jti: createTokenId(),
    });

    await refreshTokenRepository.create({
      tokenHash: hashToken(nextRefreshToken),
      userId: storedToken.user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    });

    return {
      user: serializeUser(storedToken.user),
      accessToken: signAccessToken({ sub: storedToken.user.id, role: storedToken.user.accessLevel as Role }),
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
    await refreshTokenRepository.revokeAllForUser(userId);
  },

  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);

    if (!user || user.status !== UserStatus.ACTIVE || user.accessLevel === 'DEVELOPER') {
      throw new HttpError(401, 'User is not active');
    }

    return serializeUser(user);
  },
};
