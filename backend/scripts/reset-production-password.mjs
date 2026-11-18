import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AccessLevel, Prisma, PrismaClient, UserStatus } from '@prisma/client';

const requested = process.argv[2] ?? 'ADMIN';
if (process.argv.length > 3 || !['ADMIN', 'RECEPTIONIST'].includes(requested)) {
  throw new Error('Select ADMIN or RECEPTIONIST password recovery.');
}
const role = AccessLevel[requested];
const prefix = `RESET_${role}`;
if (process.env.NODE_ENV !== 'production') {
  throw new Error('Staff recovery requires NODE_ENV=production.');
}

if (process.env[`${prefix}_CONFIRM`] !== `RESET_EXISTING_PRODUCTION_${role}`) {
  throw new Error(`Set ${prefix}_CONFIRM=RESET_EXISTING_PRODUCTION_${role} for this one-time operation.`);
}

const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
const password = process.env[`${prefix}_PASSWORD`];
const disableMfa = role === AccessLevel.ADMIN && process.env.RESET_ADMIN_DISABLE_MFA === 'I_UNDERSTAND_MFA_WILL_BE_REMOVED';

if (!email || !password) {
  throw new Error(`${prefix}_EMAIL and ${prefix}_PASSWORD are required.`);
}
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(`${prefix}_EMAIL is invalid.`);
if (password.length < 14 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Use at least 14 characters and at most 72 UTF-8 bytes.');
if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error('The password must include uppercase, lowercase, numeric, and special characters.');
}

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, accessLevel: true, status: true } });
  if (!user) {
    throw new Error('No account exists for this email.');
  }
  if (user.accessLevel !== role || (role === AccessLevel.RECEPTIONIST && user.status !== UserStatus.ACTIVE)) {
    throw new Error(`This recovery command requires an eligible ${role} account.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: user.id, accessLevel: role, ...(role === AccessLevel.RECEPTIONIST ? { status: UserStatus.ACTIVE } : {}) },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
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
    });
    if (updated.count !== 1) throw new Error('Account eligibility changed during recovery.');
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.auditLog.create({ data: { action: 'OPERATOR_PASSWORD_RECOVERY', entity: 'User', entityId: user.id, correlationId: randomUUID(), newValue: { role, mfaDisabled: disableMfa } } });
  });

  console.log(JSON.stringify({
    status: 'reset',
    role,
    sessionsRevoked: true,
    mfaDisabled: disableMfa,
    next: disableMfa ? 'Sign in and enroll MFA again immediately.' : 'Sign in with the new password and existing MFA code.',
  }));
} finally {
  await prisma.$disconnect();
}
