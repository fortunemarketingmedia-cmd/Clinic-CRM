import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction([
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.patientFile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.treatmentPackage.deleteMany(),
    prisma.medicalProfile.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.whatsAppLog.deleteMany(),
  ]);

  console.log(
    JSON.stringify(
      {
        deleted: {
          payments: result[0].count,
          invoices: result[1].count,
          files: result[2].count,
          sessions: result[3].count,
          packages: result[4].count,
          medicalProfiles: result[5].count,
          patients: result[6].count,
          appointments: result[7].count,
          leads: result[8].count,
          whatsappLogs: result[9].count,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
