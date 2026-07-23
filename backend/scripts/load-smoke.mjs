const baseUrl = process.env.LOAD_TEST_URL ?? 'http://127.0.0.1:4000';
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const latencies = [];
let failures = 0;
let claimed = 0;
async function worker() { while (claimed < requests) { claimed += 1; const started = performance.now(); try { const response = await fetch(`${baseUrl}/api/health`); if (!response.ok) failures += 1; else latencies.push(performance.now() - started); } catch { failures += 1; } } }
await Promise.all(Array.from({ length: concurrency }, worker));
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;
console.log(JSON.stringify({ requests, concurrency, succeeded: latencies.length, failures, p50Ms: Math.round(percentile(0.5)), p95Ms: Math.round(percentile(0.95)), p99Ms: Math.round(percentile(0.99)) }, null, 2));
if (failures) process.exitCode = 1;
