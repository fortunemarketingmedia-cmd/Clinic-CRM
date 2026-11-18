import 'dotenv/config';
import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import { createClient } from 'redis';
const target = process.env.AUDIT_REDIS_URL;
if (!target || new URL(target).hostname !== '127.0.0.1' || new URL(target).port !== '16379')
  throw new Error('Use the disposable loopback audit Redis on port 16379');
process.env.REDIS_URL = target;
process.env.NODE_ENV = 'test';
const { cacheService } = await import('../src/services/cache.service.js');
const { env } = await import('../src/config/env.js');
await test('distributed rate bucket increments atomically and expires across independent clients', async () => {
  const key = `audit:${Date.now()}`;
  const values = await Promise.all(
    Array.from({ length: 40 }, () => cacheService.rateLimit(key, 150)),
  );
  assert.deepEqual(
    values.map((v) => v!.count).sort((a, b) => a - b),
    Array.from({ length: 40 }, (_, i) => i + 1),
  );
  const other = createClient({ url: target });
  await other.connect();
  const fullKey = `${process.env.REDIS_KEY_PREFIX ?? 'revive:'}rate:${key}`;
  assert.ok((await other.pTTL(fullKey)) > 0);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await other.exists(fullKey), 0);
  assert.equal((await cacheService.rateLimit(key, 1000))!.count, 1);
  await other.quit();
  await cacheService.disconnect();
});

await test('unreachable Redis returns a protection failure without throwing', async () => {
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const address = probe.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  const previous = env.REDIS_URL;
  env.REDIS_URL = `redis://127.0.0.1:${address.port}`;
  try {
    assert.equal(await cacheService.rateLimit('audit-unreachable', 1000), null);
    assert.deepEqual(await cacheService.healthCheck(), { configured: true, ready: false });
  } finally {
    env.REDIS_URL = previous;
    await cacheService.disconnect();
  }
});
