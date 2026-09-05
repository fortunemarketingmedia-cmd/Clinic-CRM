import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { fileStorageService } from './services/file-storage.service.js';
import { integrationJobService } from './services/integration-job.service.js';
import { cacheService } from './services/cache.service.js';

await Promise.all([prisma.$queryRaw`SELECT 1`, fileStorageService.healthCheck()]);
console.log(JSON.stringify({ level: 'info', component: 'worker', message: 'Background worker started', workerId: env.INTEGRATION_WORKER_ID }));
const timer = integrationJobService.start({ unref: false });
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  integrationJobService.stop(timer);
  const deadline = Date.now() + env.SHUTDOWN_TIMEOUT_MS;
  while (integrationJobService.isProcessing() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await Promise.all([prisma.$disconnect(), cacheService.disconnect()]);
  console.log(JSON.stringify({ level: 'info', component: 'worker', message: 'Background worker stopped', signal }));
  process.exit(0);
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
