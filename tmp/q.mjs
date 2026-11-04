import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const s = await p.clinicService.findMany({ where: { active: true, resourceType: 'TREATMENT_ROOM' }, select: { name: true, category: true, branchId: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
console.log(s.length); for (const x of s) console.log(`${x.category} | ${x.name}`);
const t = await p.consentTemplate.findMany({ select: { key: true, status: true, currentVersion: true, branchId: true } }); console.log(t);
const u = await p.user.findMany({ select: { name: true, role: true, accessLevel: true, status: true } }); console.log(u);
await p.$disconnect();
