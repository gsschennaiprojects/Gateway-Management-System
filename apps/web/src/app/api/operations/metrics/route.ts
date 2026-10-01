import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getBranchMetrics,
  refreshBranchMetricsCache,
} from '@/lib/operations/operations-service';
import type { Branch } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedBranch = searchParams.get('branch');
    const refresh = searchParams.get('refresh') === 'true';
    const period = searchParams.get('period') || new Date().toISOString().substring(0, 7); // Default current YYYY-MM
    const type = (searchParams.get('type') as 'daily' | 'monthly') || 'monthly';

    const branch = (session.user.role === 'superadmin' && requestedBranch
      ? requestedBranch
      : session.user.branch) as Branch;

    // If refresh is requested or no cached metrics exist yet, calculate and cache
    let metrics = null;
    if (!refresh) {
      metrics = await getBranchMetrics(branch, period, type);
    }

    if (!metrics && ['superadmin', 'admin', 'hr'].includes(session.user.role)) {
      metrics = await refreshBranchMetricsCache(branch, period, type);
    }

    return NextResponse.json({ metrics, branch, period });
  } catch {
    return NextResponse.json({ error: 'Metrics are temporarily unavailable.' }, { status: 503 });
  }
}
