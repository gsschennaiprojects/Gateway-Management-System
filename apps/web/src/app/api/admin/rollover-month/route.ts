import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import {
  executeMonthRolloverAndArchive,
  getMonthlyRolloverStatus,
  getPreviousMonthPeriod,
  formatMonthName,
} from '@/lib/attendance/month-rollover-service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const status = await getMonthlyRolloverStatus();
    const now = new Date();
    const prev = getPreviousMonthPeriod(now);

    return NextResponse.json({
      success: true,
      status,
      currentCalendarPeriod: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        monthName: formatMonthName(now.getFullYear(), now.getMonth() + 1),
      },
      recommendedArchivePeriod: {
        year: prev.year,
        month: prev.month,
        monthName: formatMonthName(prev.year, prev.month),
      },
    }, { headers: PRIVATE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve rollover status';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: PRIVATE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Only Super Admin and Admin can execute monthly rollovers.' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  if (hasOversizedBody(req, 16_384)) {
    return NextResponse.json({ success: false, error: 'Request body is too large.' }, { status: 413, headers: PRIVATE_HEADERS });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable; defaults to previous month
    }

    const targetYear = typeof body.year === 'number' && body.year >= 2020 && body.year <= 2040 ? body.year : undefined;
    const targetMonth = typeof body.month === 'number' && body.month >= 1 && body.month <= 12 ? body.month : undefined;
    const force = Boolean(body.force);

    const result = await executeMonthRolloverAndArchive({
      targetYear,
      targetMonth,
      force,
      actor: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        branch: session.user.branch,
      },
    });

    return NextResponse.json({
      success: true,
      result,
    }, { headers: PRIVATE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Month rollover execution failed';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
