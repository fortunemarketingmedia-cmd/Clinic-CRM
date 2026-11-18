import './audit-environment.js';
import fs from 'node:fs/promises';
const { prisma } = await import('../src/config/db.js');
const { app } = await import('../src/app.js');
const { signAccessToken } = await import('../src/utils/tokens.js');
const branch = await prisma.branch.findFirstOrThrow({ orderBy: { name: 'asc' } });
const admin = await prisma.user.findFirstOrThrow({ where: { accessLevel: 'ADMIN' } });
if (!(await prisma.lead.findUnique({ where: { id: 'audit-scale-lead-0' } }))) {
  const people = Array.from({ length: 3000 }, (_, i) => ({
    id: `audit-scale-person-${i}`,
    fullName: `Audit Synthetic ${i}`,
    primaryMobile: `8000${String(i).padStart(6, '0')}`,
    normalizedMobile: `8000${String(i).padStart(6, '0')}`,
  }));
  await prisma.person.createMany({ data: people });
  await prisma.lead.createMany({
    data: people.map((p, i) => ({
      id: `audit-scale-lead-${i}`,
      qrToken: `audit-scale-qr-${i}`,
      name: p.fullName,
      mobile: p.primaryMobile,
      personId: p.id,
      branchId: branch.id,
      createdById: admin.id,
      source: 'PHONE_CALL' as const,
      status: i < 1000 ? ('CONVERTED' as const) : ('NEW' as const),
      createdAt: new Date(Date.now() - (i % 29) * 86400000),
    })),
  });
  await prisma.patient.createMany({
    data: people
      .slice(0, 1000)
      .map((p, i) => ({
        id: `audit-scale-patient-${i}`,
        qrToken: `audit-scale-patient-qr-${i}`,
        patientNo: `AUDIT-${i}`,
        fullName: p.fullName,
        mobile: p.primaryMobile,
        personId: p.id,
        leadId: `audit-scale-lead-${i}`,
        branchId: branch.id,
      })),
  });
  await prisma.appointment.createMany({
    data: people
      .slice(0, 2000)
      .map((_, i) => ({
        id: `audit-scale-appointment-${i}`,
        leadId: `audit-scale-lead-${i}`,
        branchId: branch.id,
        appointmentAt: new Date(Date.now() + ((i % 15) - 7) * 86400000),
        status: 'SCHEDULED' as const,
      })),
  });
}
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No listener');
const base = `http://127.0.0.1:${address.port}/api`;
const headers = { Authorization: `Bearer ${signAccessToken({ sub: admin.id, role: 'ADMIN' })}` };
const paths = {
  dashboard: `/analytics/dashboard?branchId=${branch.id}`,
  patients: `/patients?branchId=${branch.id}&pageSize=20`,
  leads: `/leads?branchId=${branch.id}&pageSize=20`,
  calendar: `/appointments?branchId=${branch.id}&pageSize=50`,
  search: `/patients?branchId=${branch.id}&search=Synthetic%2020`,
  analytics: `/analytics?branchId=${branch.id}`,
};
const result: Record<string, unknown> = {
  fixture: {
    leads: await prisma.lead.count(),
    patients: await prisma.patient.count(),
    appointments: await prisma.appointment.count(),
  },
  runtime: process.version,
};
for (const [name, path] of Object.entries(paths)) {
  const samples: number[] = [];
  let bytes = 0;
  for (let i = 0; i < 12; i++) {
    const start = performance.now();
    const response = await fetch(base + path, { headers });
    const body = await response.text();
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    if (i > 1) samples.push(performance.now() - start);
    bytes = Buffer.byteLength(body);
  }
  samples.sort((a, b) => a - b);
  result[name] = {
    p50Ms: +samples[5].toFixed(2),
    p95Ms: +samples[9].toFixed(2),
    bytes,
    samples: samples.length,
  };
}
const start = performance.now();
const cpu = process.cpuUsage();
let failures = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let i = 0; i < 10; i++) {
      const r = await fetch(base + paths.dashboard, { headers });
      await r.arrayBuffer();
      if (!r.ok) failures++;
    }
  }),
);
result.load = {
  requests: 80,
  concurrency: 8,
  failures,
  elapsedMs: +(performance.now() - start).toFixed(2),
  cpuMs: (process.cpuUsage(cpu).user + process.cpuUsage(cpu).system) / 1000,
  rssMiB: +(process.memoryUsage().rss / 1048576).toFixed(1),
};
await fs.writeFile(
  `../docs/audit/${process.env.AUDIT_PHASE ?? 'before'}-performance.json`,
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result, null, 2));
await new Promise<void>((r) => server.close(() => r()));
await prisma.$disconnect();
