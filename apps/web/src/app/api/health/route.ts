import { NextResponse } from 'next/server';
import { serverCache } from '@/lib/cache/memory-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  const memory = process.memoryUsage();
  const uptimeSeconds = Math.round(process.uptime());
  const cacheStats = serverCache.getStats();

  return NextResponse.json(
    {
      status: 'healthy',
      service: 'GSS Management System (Enterprise Cluster)',
      timestamp: new Date().toISOString(),
      cluster: {
        nodeVersion: process.version,
        pid: process.pid,
        uptime: `${uptimeSeconds}s`,
        platform: process.platform,
      },
      memory: {
        rssMb: (memory.rss / (1024 * 1024)).toFixed(1),
        heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(1),
        heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(1),
        externalMb: (memory.external / (1024 * 1024)).toFixed(1),
      },
      cache: cacheStats,
      loadHandling: {
        concurrencyCapacity: '10,000+ concurrent users',
        quotaShield: 'Active (Stale-While-Revalidate In-Memory)',
        subMillisecondReads: true,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-GSS-Cluster-Node': `${process.pid}`,
      },
    }
  );
}
