import { env } from './config/env.js';
import { app } from './app.js';
import { whatsappJobService } from './services/whatsapp-job.service.js';
import { integrationJobService } from './services/integration-job.service.js';
import { prisma } from './config/db.js';

const server = app.listen(env.PORT, () => {
  console.log(`Revive CRM backend running on port ${env.PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. The backend may already be running.`);
    process.exit(1);
  }

  throw error;
});

const whatsappTimer = whatsappJobService.start();
const integrationTimer = integrationJobService.start();
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));
  whatsappJobService.stop(whatsappTimer);
  integrationJobService.stop(integrationTimer);

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
        (whatsappJobService.isProcessing() || integrationJobService.isProcessing()) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await prisma.$disconnect();
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
