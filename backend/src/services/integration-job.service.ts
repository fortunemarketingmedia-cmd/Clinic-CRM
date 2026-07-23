import type { DurableJob } from '@prisma/client';
import { env } from '../config/env.js';
import { integrationRepository } from '../repositories/integration.repository.js';
import { integrationService } from './integration.service.js';
import { automationService } from './automation.service.js';

type Payload = {
  eventId?: string;
  syncRunId?: string;
  conversionId?: string;
  executionId?: string;
};
const types = [
  'INTEGRATION_EVENT_PROCESS',
  'INTEGRATION_SYNC',
  'CONVERSION_UPLOAD',
  'AUTOMATION_EXECUTION',
] as const;
async function execute(job: DurableJob) {
  const payload = job.payload as Payload;
  if (job.type === 'INTEGRATION_EVENT_PROCESS' && payload.eventId)
    return integrationService.processEvent(payload.eventId);
  if (job.type === 'INTEGRATION_SYNC' && payload.syncRunId)
    return integrationService.processSync(payload.syncRunId);
  if (job.type === 'CONVERSION_UPLOAD' && payload.conversionId)
    return integrationService.uploadConversion(payload.conversionId);
  if (job.type === 'AUTOMATION_EXECUTION' && payload.executionId)
    return automationService.execute(payload.executionId);
}
let processing = false;
export const integrationJobService = {
  async processDueJobs(limit = 20) {
    if (processing) return { processed: 0, busy: true };
    processing = true;
    let processed = 0;
    try {
      while (processed < limit) {
        const job = await integrationRepository.claimJob(env.INTEGRATION_WORKER_ID, [...types]);
        if (!job) break;
        try {
          await execute(job);
          await integrationRepository.completeJob(job.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Integration job failed';
          await integrationRepository.retryJob(job.id, message, job.attempts >= job.maxAttempts);
        }
        processed += 1;
      }
      return { processed, busy: false };
    } finally {
      processing = false;
    }
  },
  start() {
    const reportError = (error: unknown) =>
      console.error(
        JSON.stringify({
          level: 'error',
          component: 'integration-worker',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    const timer = setInterval(() => {
      void this.processDueJobs().catch(reportError);
    }, env.INTEGRATION_JOB_POLL_MS);
    timer.unref();
    void this.processDueJobs().catch(reportError);
    return timer;
  },
  stop(timer: NodeJS.Timeout) {
    clearInterval(timer);
  },
  isProcessing() {
    return processing;
  },
};
