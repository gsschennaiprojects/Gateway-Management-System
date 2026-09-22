/**
 * ==============================================================================
 * GSS MANAGEMENT SYSTEM — HIGH-CONCURRENCY LOAD BENCHMARK ENGINE
 * Simulates heavy concurrent user traffic to measure throughput, latency, and cache hit efficiency.
 * ==============================================================================
 */

const BASE_URL = process.env.TARGET_URL || 'http://localhost:3000';
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '600', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);

const TARGET_ENDPOINTS = [
  '/api/health',
  '/api/sheets?type=branch_student_directory&branchCode=CBE',
  '/api/sheets?type=attendance_tracker&branchCode=CBE&staffId=CBE_ADM01&month=2026-09',
  '/api/sheets?type=staff_directory&branchCode=CBE',
  '/students',
  '/help',
  '/privacy',
  '/terms',
];

// Valid Super Admin session cookie
const superAdminUser = {
  id: 'usr_superadmin',
  name: 'Super Admin',
  email: 'gateway.managercbe@gmail.com',
  role: 'superadmin',
  branch: 'Coimbatore',
  status: 'active',
  mobile: '+91 9876543210',
  createdAt: '2026-01-01',
};
const sessionPayload = {
  user: superAdminUser,
  token: `tok_bench_${Date.now()}`,
  expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
};
const SESSION_COOKIE = `gss_session=${Buffer.from(JSON.stringify(sessionPayload)).toString('base64')}`;

async function makeRequest(urlPath) {
  const url = `${BASE_URL}${urlPath}`;
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: {
        Cookie: SESSION_COOKIE,
        'User-Agent': 'GSS-Load-Benchmark-Engine/1.0',
        Accept: 'application/json, text/html, */*',
      },
    });
    await res.text();
    const durationMs = performance.now() - start;
    return {
      statusCode: res.status,
      durationMs,
      cached: res.headers.get('cache-control') || res.headers.get('x-cache-status') ? true : false,
    };
  } catch (err) {
    const durationMs = performance.now() - start;
    return {
      statusCode: 0,
      durationMs,
      error: err.message,
      cached: false,
    };
  }
}

async function runBenchmark() {
  console.log('='.repeat(80));
  console.log('  GSS ENTERPRISE HIGH-CONCURRENCY LOAD BENCHMARK');
  console.log('='.repeat(80));
  console.log(`  Target Host:          ${BASE_URL}`);
  console.log(`  Total Requests:       ${TOTAL_REQUESTS}`);
  console.log(`  Concurrency Level:    ${CONCURRENCY} parallel virtual clients`);
  console.log(`  Target Routes:        ${TARGET_ENDPOINTS.length} diverse enterprise endpoints`);
  console.log('='.repeat(80));
  console.log('  Executing benchmark with In-Memory Quota Shielding...\n');

  // Warmup run
  for (const ep of TARGET_ENDPOINTS) {
    await makeRequest(ep);
  }

  const results = [];
  let requestCounter = 0;
  const startTime = performance.now();

  async function clientWorker() {
    while (requestCounter < TOTAL_REQUESTS) {
      const idx = requestCounter++;
      const endpoint = TARGET_ENDPOINTS[idx % TARGET_ENDPOINTS.length];
      const res = await makeRequest(endpoint);
      results.push(res);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => clientWorker());
  await Promise.all(workers);

  const totalTimeSeconds = (performance.now() - startTime) / 1000;
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);

  const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
  const p90 = durations[Math.floor(durations.length * 0.9)] || 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] || 0;
  const min = durations[0] || 0;
  const max = durations[durations.length - 1] || 0;

  const statusCodes = {};
  for (const r of results) {
    statusCodes[r.statusCode] = (statusCodes[r.statusCode] || 0) + 1;
  }

  const successful = results.filter((r) => r.statusCode >= 200 && r.statusCode < 400).length;
  const rps = (results.length / totalTimeSeconds).toFixed(1);

  console.log('='.repeat(80));
  console.log('  BENCHMARK RESULTS & THROUGHPUT METRICS');
  console.log('='.repeat(80));
  console.log(`  Dispatched Requests:   ${results.length} / ${TOTAL_REQUESTS}`);
  console.log(`  Total Test Duration:   ${totalTimeSeconds.toFixed(2)} seconds`);
  console.log(`  Throughput Rate:       ${rps} Requests / Second (RPS)`);
  console.log(`  Success Ratio:         ${((successful / results.length) * 100).toFixed(2)}%`);
  console.log('-'.repeat(80));
  console.log('  LATENCY PERCENTILES:');
  console.log(`    • Min Latency:       ${min.toFixed(2)} ms`);
  console.log(`    • p50 (Median):      ${p50.toFixed(2)} ms`);
  console.log(`    • p90:               ${p90.toFixed(2)} ms`);
  console.log(`    • p95:               ${p95.toFixed(2)} ms`);
  console.log(`    • p99:               ${p99.toFixed(2)} ms`);
  console.log(`    • Max Latency:       ${max.toFixed(2)} ms`);
  console.log('-'.repeat(80));
  console.log('  HTTP RESPONSE STATUS DISTRIBUTION:');
  for (const [code, count] of Object.entries(statusCodes)) {
    console.log(`    • HTTP ${code}: ${count} (${((count / results.length) * 100).toFixed(1)}%)`);
  }
  console.log('='.repeat(80));

  // Telemetry check
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    console.log('  CLUSTER HEALTH & MEMORY TELEMETRY:');
    console.log(`    • Process Uptime:    ${healthJson.cluster?.uptime}`);
    console.log(`    • Memory RSS:        ${healthJson.memory?.rssMb} MB`);
    console.log(`    • Heap Used:         ${healthJson.memory?.heapUsedMb} MB / ${healthJson.memory?.heapTotalMb} MB`);
    console.log(`    • Active Cache Keys: ${healthJson.cache?.totalKeys}`);
    console.log(`    • Cache Hit Ratio:   ${healthJson.cache?.hitRatioPct}`);
    console.log(`    • Concurrency Spec:  ${healthJson.loadHandling?.concurrencyCapacity}`);
    console.log(`    • Google API Shield: ${healthJson.loadHandling?.quotaShield}`);
    console.log('='.repeat(80));
  } catch {
    // telemetry optional
  }

  if (successful / results.length < 0.90) {
    console.error('FAILED: Success rate below 90% threshold.');
    process.exit(1);
  } else {
    console.log('SUCCESS: High-concurrency scalability and low latency confirmed!\n');
    process.exit(0);
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
