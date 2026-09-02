import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

if (process.env.NODE_ENV !== 'production') throw new Error('The production Admin bootstrap requires NODE_ENV=production.');
if (process.env.BOOTSTRAP_ADMIN_CONFIRM !== 'CREATE_INITIAL_PRODUCTION_ADMIN') {
  throw new Error('Set BOOTSTRAP_ADMIN_CONFIRM=CREATE_INITIAL_PRODUCTION_ADMIN for this one-time operation.');
}

const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const branchName = process.env.BOOTSTRAP_BRANCH_NAME?.trim();
if (!name || !email || !password || !branchName) {
  throw new Error('BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, and BOOTSTRAP_BRANCH_NAME are required.');
}
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL is invalid.');
if (password.length < 14) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 14 characters.');

const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('A user with this email already exists; bootstrap will not overwrite accounts.');
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.upsert({
      where: { name: branchName },
      update: {},
      create: {
        name: branchName,
        address: process.env.BOOTSTRAP_BRANCH_ADDRESS?.trim() || undefined,
        phone: process.env.BOOTSTRAP_BRANCH_PHONE?.trim() || undefined,
      },
    });
    const user = await tx.user.create({
      data: { name, email, passwordHash, role: Role.ADMIN, accessLevel: 'ADMIN', status: 'ACTIVE' },
    });
    await tx.userBranch.create({ data: { userId: user.id, branchId: branch.id, isPrimary: true } });
    return { userId: user.id, branchId: branch.id };
  });
  console.log(JSON.stringify({ status: 'created', email, ...result, next: 'Sign in, enroll MFA, then remove bootstrap variables from the secret manager.' }));
} finally {
  await prisma.$disconnect();
}
