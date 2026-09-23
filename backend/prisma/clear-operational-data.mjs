import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';

const confirmation = 'RESET_LOCAL_OPERATIONAL_DATA';
if (process.env.RESET_OPERATIONAL_DATA_CONFIRM !== confirmation) {
  throw new Error(`Set RESET_OPERATIONAL_DATA_CONFIRM=${confirmation} to run this destructive reset.`);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('Operational data reset is restricted to a local database.');
}

const prisma = new PrismaClient();

try {
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, email: true },
  });
  if (admins.length !== 1) {
    throw new Error(`Expected exactly one administrator to preserve; found ${admins.length}.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      TRUNCATE TABLE
        "RefreshToken",
        "LoginEvent",
        "AuditLog",
        "ExportLog",
        "FormSubmission",
        "LeadScoreHistory",
        "TimelineEvent",
        "Appointment",
        "Lead",
        "Patient",
        "Person",
        "Vendor",
        "Product"
      RESTART IDENTITY CASCADE
    `);

    const removedUsers = await tx.user.deleteMany({ where: { role: { not: Role.ADMIN } } });
    return { removedUsers: removedUsers.count };
  });

  const remaining = {
    admins: await prisma.user.count({ where: { role: Role.ADMIN } }),
    users: await prisma.user.count(),
    patients: await prisma.patient.count(),
    leads: await prisma.lead.count(),
    appointments: await prisma.appointment.count(),
    medicines: await prisma.medicine.count(),
    branches: await prisma.branch.count(),
  };

  console.log(JSON.stringify({ status: 'reset', preservedAdmin: admins[0].email, ...result, remaining }, null, 2));
} finally {
  await prisma.$disconnect();
}
