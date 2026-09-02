import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const catalogPath = path.resolve(process.cwd(), 'prisma/medicine-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

function medicineId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  const hash = crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0, 10);
  return `medicine_catalog_${slug}_${hash}`;
}

async function main() {
  for (let index = 0; index < catalog.length; index += 50) {
    const batch = catalog.slice(index, index + 50);
    await Promise.all(batch.map((medicine) => prisma.medicine.upsert({
      where: { id: medicineId(medicine.name) },
      update: { name: medicine.name, form: medicine.form, status: 'ACTIVE' },
      create: { id: medicineId(medicine.name), name: medicine.name, form: medicine.form, status: 'ACTIVE' },
    })));
  }
  console.log(`Imported ${catalog.length} medicine and dermatology product names without pricing.`);
}

main().finally(() => prisma.$disconnect());
