import 'dotenv/config';
import bcrypt from 'bcrypt';
import { AccessLevel, Prisma, PrismaClient, UserStatus } from '@prisma/client';

if (process.env.NODE_ENV !== 'production') {
  throw new Error('Production Admin recovery requires NODE_ENV=production.');
}

if (process.env.RESET_ADMIN_CONFIRM !== 'RESET_EXISTING_PRODUCTION_ADMIN') {
  throw new Error('Set RESET_ADMIN_CONFIRM=RESET_EXISTING_PRODUCTION_ADMIN for this one-time operation.');
}

const email = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.RESET_ADMIN_PASSWORD;
const disableMfa = process.env.RESET_ADMIN_DISABLE_MFA === 'I_UNDERSTAND_MFA_WILL_BE_REMOVED';

if (!email || !password) {
  throw new Error('RESET_ADMIN_EMAIL and RESET_ADMIN_PASSWORD are required.');
}
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('RESET_ADMIN_EMAIL is invalid.');
if (password.length < 14) throw new Error('RESET_ADMIN_PASSWORD must contain at least 14 characters.');
if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error('RESET_ADMIN_PASSWORD must include uppercase, lowercase, numeric, and special characters.');
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('No account exists for this email. Use npm run bootstrap:admin to create the initial production Admin.');
  }
  if (user.accessLevel !== AccessLevel.ADMIN) {
    throw new Error('Password recovery is restricted to an existing ADMIN account.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        ...(disableMfa
          ? {
              mfaEnabled: false,
              mfaSecretCiphertext: null,
              mfaRecoveryCodes: Prisma.DbNull,
              mfaVerifiedAt: null,
            }
          : {}),
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  console.log(JSON.stringify({
    status: 'reset',
    email,
    sessionsRevoked: true,
    mfaDisabled: disableMfa,
    next: disableMfa ? 'Sign in and enroll MFA again immediately.' : 'Sign in with the new password and existing MFA code.',
  }));
} finally {
  await prisma.$disconnect();
}
