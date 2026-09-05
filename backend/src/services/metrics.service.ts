import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'revive_' });

const httpDuration = new Histogram({ name: 'revive_http_request_duration_seconds', help: 'HTTP request duration in seconds', labelNames: ['method', 'route', 'status'] as const, buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] });
const uploads = new Counter({ name: 'revive_file_uploads_total', help: 'Patient file upload outcomes', labelNames: ['mime', 'outcome'] as const });
const jobs = new Counter({ name: 'revive_background_jobs_total', help: 'Background job outcomes', labelNames: ['type', 'outcome'] as const });
const activeJobs = new Gauge({ name: 'revive_background_worker_active', help: 'Whether this worker is processing a job' });

export const metricsService = {
  observeHttp(method: string, route: string, status: number, durationMs: number) { httpDuration.observe({ method, route, status: String(status) }, durationMs / 1000); },
  upload(mime: string, outcome: 'success' | 'failure') { uploads.inc({ mime, outcome }); },
  job(type: string, outcome: 'completed' | 'retry' | 'dead') { jobs.inc({ type, outcome }); },
  setWorkerActive(active: boolean) { activeJobs.set(active ? 1 : 0); },
  contentType: register.contentType,
  render() { return register.metrics(); },
};
