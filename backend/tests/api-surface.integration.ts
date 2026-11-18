import './audit-environment.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/config/db.js');
await test('mounted protected API surface rejects anonymous HTTP requests', async (t) => {
  const inventory = await fs.readFile('../docs/audit/api-inventory.md', 'utf8');
  const routes = inventory
    .split('\n')
    .filter((line) => line.endsWith('| mounted |'))
    .map((line) => line.split('|').map((part) => part.trim()))
    .map((parts) => ({ method: parts[1], path: parts[2] }));
  const intentionallyPublic = (path: string) =>
    path.startsWith('/api/public/') ||
    path.includes('/auth/login') ||
    path.includes('/auth/refresh') ||
    (path.includes('/auth/logout') && !path.includes('logout-all')) ||
    path.includes('/payments/gateway-callback') ||
    path.includes('/integrations/webhooks/') ||
    path.includes('/integrations/google/oauth/callback');
  const protectedRoutes = routes.filter((route) => !intentionallyPublic(route.path));
  assert.ok(protectedRoutes.length > 180);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.$disconnect();
  });
  for (const route of protectedRoutes) {
    await t.test(`${route.method} ${route.path}`, async () => {
      const path = route.path.replace(/:[a-zA-Z]+/g, 'audit-nonexistent');
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        ...(['GET', 'HEAD'].includes(route.method) ? {} : { body: '{}' }),
      });
      await response.arrayBuffer();
      assert.equal(response.status, 401);
    });
  }
});
