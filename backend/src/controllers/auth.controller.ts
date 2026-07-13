import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';
import { authService } from '../services/auth.service.js';
import { HttpError } from '../utils/http-error.js';
import { loginSchema, logoutSchema, refreshTokenSchema } from '../validations/auth.validation.js';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/auth',
  domain: env.COOKIE_DOMAIN || undefined,
};

function getRequestMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

function getRefreshToken(req: Request, bodyToken?: string) {
  return bodyToken ?? req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshCookieOptions);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions);
}

export const authController = {
  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input.email, input.password, getRequestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    return res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  },

  async refresh(req: Request, res: Response) {
    const input = refreshTokenSchema.parse(req.body);
    const refreshToken = getRefreshToken(req, input.refreshToken);

    if (!refreshToken) {
      throw new HttpError(401, 'Refresh token required');
    }

    const result = await authService.refresh(refreshToken, getRequestMeta(req));
    setRefreshCookie(res, result.refreshToken);
    return res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  },

  async logout(req: Request, res: Response) {
    const input = logoutSchema.parse(req.body ?? {});
    await authService.logout(getRefreshToken(req, input.refreshToken));
    clearRefreshCookie(res);
    return res.status(204).send();
  },

  async logoutAll(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    await authService.logoutAll(req.user.id);
    clearRefreshCookie(res);
    return res.status(204).send();
  },

  async me(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }

    const user = await authService.getCurrentUser(req.user.id);
    return res.json({ data: user });
  },
};
