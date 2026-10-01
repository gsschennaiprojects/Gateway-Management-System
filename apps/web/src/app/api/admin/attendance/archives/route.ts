import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getFirestoreMonthlyAttendanceArchives,
  getFirestoreMonthlyWorklogArchives,
} from '@/lib/attendance/month-rollover-service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'attendance'; // 'attendance' | 'worklogs'
    const parsedYear = parseInt(searchParams.get('year') || '', 10);
    const parsedMonth = parseInt(searchParams.get('month') || '', 10);
    const staffId = searchParams.get('staffId') || undefined;

    const requestedBranch = searchParams.get('branch') || undefined;
    const branch = session.user.role === 'superadmin' ? (requestedBranch || 'All') : session.user.branch;

    const year = !isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2040 ? parsedYear : undefined;
    const month = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined;

    if (type === 'worklogs') {
      const records = await getFirestoreMonthlyWorklogArchives({
        year,
        month,
        branch,
        staffId,
      });

      return NextResponse.json({
        success: true,
        type: 'worklogs',
        year,
        month,
        branch,
        records,
        count: records.length,
      }, { headers: PRIVATE_HEADERS });
    }

    // Default: Attendance archives
    const records = await getFirestoreMonthlyAttendanceArchives({
      year,
      month,
      branch,
      staffId,
    });

    return NextResponse.json({
      success: true,
      type: 'attendance',
      year,
      month,
      branch,
      records,
      count: records.length,
    }, { headers: PRIVATE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve monthly archives';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
