import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().trim().min(8).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
