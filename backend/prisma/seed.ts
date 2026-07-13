import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.branch.upsert({
    where: { name: 'Sharanpur Road' },
    update: {},
    create: {
      name: 'Sharanpur Road',
      address: 'Sharanpur Road, Nashik',
      phone: '+91-0000000000',
    },
  });

  await prisma.branch.upsert({
    where: { name: 'Nashik Road' },
    update: {},
    create: {
      name: 'Nashik Road',
      address: 'Nashik Road, Nashik',
      phone: '+91-0000000000',
    },
  });

  const passwordHash = await bcrypt.hash('Admin@12345', 12);

  await prisma.user.upsert({
    where: { email: 'admin@reviveclinic.local' },
    update: {},
    create: {
      name: 'Revive Admin',
      email: 'admin@reviveclinic.local',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const existingSettings = await prisma.clinicSettings.findFirst();
  if (!existingSettings) {
    await prisma.clinicSettings.create({
      data: {
        clinicName: 'Revive Clinic',
        invoicePrefix: 'REV',
        businessAddress: 'Nashik',
        businessPhone: '+91-0000000000',
        appointmentTemplate: 'Your appointment with Revive Clinic is confirmed for [date] at [time], at [branch].',
        reminderTemplate: 'Reminder: Your appointment is scheduled tomorrow at [time] at [branch].',
        invoiceTemplate: 'Thank you for visiting Revive Clinic. Your invoice has been generated.',
        followupTemplate: 'This is a follow-up reminder from Revive Clinic.',
      },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
