import bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { refreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { HttpError } from '../utils/http-error.js';
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
  role: 'ADMIN' | 'RECEPTIONIST';
  status: UserStatus;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export const authService = {
  async login(email: string, password: string, meta: RequestMeta) {
    const user = await userRepository.findByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const accessPayload = { sub: user.id, role: user.role };
    const refreshToken = signRefreshToken({ ...accessPayload, jti: createTokenId() });

    await refreshTokenRepository.create({
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: getRefreshTokenExpiry(),
    });

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

    if (!storedToken || storedToken.userId !== payload.sub || storedToken.user.status !== UserStatus.ACTIVE) {
      throw new HttpError(401, 'Invalid refresh token');
    }

    await refreshTokenRepository.revokeByHash(tokenHash);

    const nextRefreshToken = signRefreshToken({
      sub: storedToken.user.id,
      role: storedToken.user.role,
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
      accessToken: signAccessToken({ sub: storedToken.user.id, role: storedToken.user.role }),
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

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new HttpError(401, 'User is not active');
    }

    return serializeUser(user);
  },
};
