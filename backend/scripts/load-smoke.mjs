const baseUrl = process.env.LOAD_TEST_URL ?? 'http://127.0.0.1:4000';
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const paths = (process.env.LOAD_TEST_PATHS ?? '/api/health').split(',').map((path) => path.trim()).filter(Boolean);
const token = process.env.LOAD_TEST_ACCESS_TOKEN;
const latencies = new Map(paths.map((path) => [path, []]));
let failures = 0;
let claimed = 0;
async function worker() { while (claimed < requests) { const request = claimed; claimed += 1; const path = paths[request % paths.length]; const started = performance.now(); try { const response = await fetch(`${baseUrl}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined }); if (!response.ok) failures += 1; else latencies.get(path).push(performance.now() - started); } catch { failures += 1; } } }
await Promise.all(Array.from({ length: concurrency }, worker));
const results = Object.fromEntries([...latencies].map(([path, values]) => { values.sort((a, b) => a - b); const percentile = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0; return [path, { succeeded: values.length, p50Ms: Math.round(percentile(0.5)), p95Ms: Math.round(percentile(0.95)), p99Ms: Math.round(percentile(0.99)) }]; }));
console.log(JSON.stringify({ requests, concurrency, failures, paths: results }, null, 2));
if (failures) process.exitCode = 1;
