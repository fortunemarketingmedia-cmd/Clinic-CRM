import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { rateCardPackages, rateCardServices } from '../data/rate-card-catalog.js';

const prisma = new PrismaClient();

function catalogId(prefix: string, name: string) {
  return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)}`;
}

async function syncRateCard() {
  for (const service of rateCardServices) {
    const id = catalogId('service', service.name);
    await prisma.clinicService.upsert({
      where: { id },
      update: { ...service, active: true },
      create: { id, ...service, active: true },
    });
  }

  for (const packageMaster of rateCardPackages) {
    const id = catalogId('package_master', packageMaster.name);
    const validityDays = packageMaster.totalSessions >= 6 ? 365 : 180;
    const includedServices = [...packageMaster.includedServices];
    const description = `${packageMaster.category} package from Revive rate list.`;
    await prisma.packageMaster.upsert({
      where: { id },
      update: {
        name: packageMaster.name,
        description,
        includedServices,
        totalSessions: packageMaster.totalSessions,
        validityDays,
        price: packageMaster.price,
        taxPercent: 18,
        maximumDiscountPercent: 10,
        active: true,
      },
      create: {
        id,
        name: packageMaster.name,
        description,
        includedServices,
        totalSessions: packageMaster.totalSessions,
        validityDays,
        price: packageMaster.price,
        taxPercent: 18,
        maximumDiscountPercent: 10,
        active: true,
        transferRules: 'Manager approval required.',
        pauseRules: 'One pause of up to 30 days.',
        extensionRules: 'Manager approval and documented reason required.',
        cancellationRules: 'Subject to consumed sessions and signed agreement.',
        refundRules: 'Refunds require approval and package-ledger entry.',
      },
    });
  }

  console.log(`Rate card synced: ${rateCardServices.length} treatments and ${rateCardPackages.length} packages.`);
}

syncRateCard()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
