import { createClient, type RedisClientType } from 'redis';
import { env } from '../config/env.js';

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;
let retryAfter = 0;

function report(error: unknown) {
  console.error(JSON.stringify({
    level: 'error',
    component: 'redis',
    message: error instanceof Error ? error.message : String(error),
  }));
}

async function connection() {
  if (!env.REDIS_URL) return null;
  if (client?.isReady) return client;
  if (Date.now() < retryAfter) return null;
  if (!connectPromise) {
    const candidate = createClient({ url: env.REDIS_URL, socket: { connectTimeout: 1000, reconnectStrategy: false } });
    candidate.on('error', report);
    connectPromise = candidate.connect()
      .then(() => {
        client = candidate as RedisClientType;
        return client;
      })
      .catch((error) => {
        report(error);
        retryAfter = Date.now() + 5000;
        candidate.destroy();
        return null;
      })
      .finally(() => { connectPromise = null; });
  }
  return connectPromise;
}

function key(value: string) { return `${env.REDIS_KEY_PREFIX}${value}`; }

export const cacheService = {
  async get<T>(cacheKey: string): Promise<T | null> {
    const redis = await connection();
    if (!redis) return null;
    const value = await redis.get(key(cacheKey)).catch((error) => { report(error); return null; });
    if (!value) return null;
    try { return JSON.parse(value) as T; } catch { return null; }
  },
  async set(cacheKey: string, value: unknown, ttlSeconds: number) {
    const redis = await connection();
    if (!redis) return;
    await redis.set(key(cacheKey), JSON.stringify(value), { EX: ttlSeconds }).catch(report);
  },
  async delete(...cacheKeys: string[]) {
    const redis = await connection();
    if (!redis || !cacheKeys.length) return;
    await redis.del(cacheKeys.map(key)).catch(report);
  },
  async rateLimit(bucket: string, windowMs: number) {
    const redis = await connection();
    if (!redis) return null;
    const bucketKey = key(`rate:${bucket}`);
    try {
      const count = await redis.incr(bucketKey);
      if (count === 1) await redis.pExpire(bucketKey, windowMs);
      const ttl = await redis.pTTL(bucketKey);
      return { count, resetAt: Date.now() + Math.max(ttl, 1) };
    } catch (error) {
      report(error);
      return null;
    }
  },
  async healthCheck() {
    const redis = await connection();
    if (!redis) return { configured: Boolean(env.REDIS_URL), ready: false };
    return { configured: true, ready: (await redis.ping()) === 'PONG' };
  },
  async disconnect() {
    if (client?.isOpen) await client.quit();
    client = null;
  },
};
