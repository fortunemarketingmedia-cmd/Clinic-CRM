import './audit-environment.js';
import { spawnSync } from 'node:child_process';
const migrated = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  env: process.env,
  stdio: 'inherit',
});
if (migrated.status !== 0) process.exit(migrated.status ?? 1);
const { prisma } = await import('../src/config/db.js');
if (!(await prisma.user.count())) {
  const seed = spawnSync('npx', ['tsx', 'prisma/seed.ts'], { env: process.env, stdio: 'inherit' });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
}
const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
if (branches.length < 2) throw new Error('Audit fixtures require two seeded branches');
const admin = await prisma.user.findFirstOrThrow({
  where: { accessLevel: 'ADMIN', status: 'ACTIVE' },
  select: { id: true },
});
for (const [index, branch] of branches.slice(0, 2).entries()) {
  const id = `audit-fixture-person-${index}`;
  const mobile = `89999990${String(index).padStart(2, '0')}`;
  await prisma.person.upsert({
    where: { id },
    update: {},
    create: {
      id,
      fullName: `Audit Synthetic Patient ${index}`,
      primaryMobile: mobile,
      normalizedMobile: mobile,
      preferredBranchId: branch.id,
    },
  });
  const leadId = `audit-fixture-lead-${index}`;
  await prisma.lead.upsert({
    where: { id: leadId },
    update: {},
    create: {
      id: leadId,
      name: `Audit Synthetic Patient ${index}`,
      mobile,
      personId: id,
      branchId: branch.id,
      createdById: admin.id,
      source: 'PHONE_CALL',
      status: 'CONVERTED',
      convertedAt: new Date(),
      qrToken: `audit-fixture-lead-token-${index}`,
    },
  });
  await prisma.patient.upsert({
    where: { id: `audit-fixture-patient-${index}` },
    update: {},
    create: {
      id: `audit-fixture-patient-${index}`,
      patientNo: `AUDIT-FIXTURE-${index}`,
      qrToken: `audit-fixture-token-${index}`,
      personId: id,
      leadId,
      branchId: branch.id,
      fullName: `Audit Synthetic Patient ${index}`,
      mobile,
    },
  });
}
await prisma.$disconnect();
console.log('Dedicated synthetic audit fixtures are ready');
