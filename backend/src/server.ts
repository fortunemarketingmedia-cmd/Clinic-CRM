import { env } from './config/env.js';
import { app } from './app.js';
import { integrationJobService } from './services/integration-job.service.js';
import { prisma, verifyRuntimeDatabase } from './config/db.js';
import { fileStorageService } from './services/file-storage.service.js';
import { cacheService } from './services/cache.service.js';

async function verifyDependencies() {
  await verifyRuntimeDatabase();
  await fileStorageService.healthCheck();
  const cache = await cacheService.healthCheck();
  if (cache.configured && !cache.ready) throw new Error('Configured request-protection cache is unavailable');
}

await verifyDependencies().catch(async (error) => {
  console.error(JSON.stringify({
    level: 'error',
    component: 'startup',
    message: error instanceof Error ? error.message : String(error),
  }));
  await prisma.$disconnect();
  process.exit(1);
});

const server = app.listen(env.PORT, () => {
  console.log(`Revive CRM backend running on port ${env.PORT}`);
});

server.requestTimeout = 120_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. The backend may already be running.`);
    process.exit(1);
  }

  throw error;
});

const integrationTimer = env.RUN_BACKGROUND_WORKER === 'true' ? integrationJobService.start() : null;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));
  if (integrationTimer) integrationJobService.stop(integrationTimer);

  const forceTimer = setTimeout(() => {
    console.error(
      JSON.stringify({ level: 'error', message: 'Graceful shutdown timed out', signal }),
    );
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  server.close(async (error) => {
    try {
      const deadline = Date.now() + Math.max(0, env.SHUTDOWN_TIMEOUT_MS - 500);
      while (
        integrationJobService.isProcessing() &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await prisma.$disconnect();
      await cacheService.disconnect();
    } finally {
      clearTimeout(forceTimer);
      process.exit(error ? 1 : 0);
    }
  });
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
