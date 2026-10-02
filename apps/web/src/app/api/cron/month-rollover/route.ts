import { NextRequest, NextResponse } from 'next/server';
import { checkAndAutoExecuteMonthRollover } from '@/lib/attendance/month-rollover-service';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

async function verifyCronOrAdminAuth(request: NextRequest): Promise<boolean> {
  // 1. Check for Vercel Cron header
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  if (isVercelCron) return true;

  // 2. Check for CRON_SECRET Bearer token
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === cronSecret) return true;
  }

  // 3. Check for authenticated Admin/Superadmin session
  try {
    const session = await getSession();
    if (session?.user && ['superadmin', 'admin'].includes(session.user.role)) {
      return true;
    }
  } catch {
    // Session parse failure
  }

  // 4. In development, permit direct testing
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const isAuthorized = await verifyCronOrAdminAuth(request);
  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const result = await checkAndAutoExecuteMonthRollover({
      force,
      actorId: 'CRON_SCHEDULED_JOB',
      actorName: 'Automated Vercel Month-End Cron Engine',
    });

    return NextResponse.json({
      success: true,
      triggered: result.triggered,
      message: result.message || (result.triggered ? 'Month rollover executed successfully.' : 'Current active calendar period is up-to-date; no rollover required.'),
      timestamp: new Date().toISOString(),
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[CronMonthRollover] Execution failed:', error);
    const message = error instanceof Error ? error.message : 'Cron execution failed';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: PRIVATE_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
