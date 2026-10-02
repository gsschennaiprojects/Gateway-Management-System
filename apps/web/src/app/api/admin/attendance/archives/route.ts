import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getFirestoreMonthlyAttendanceArchives,
  getFirestoreMonthlyWorklogArchives,
  getStaffLifetimeAttendanceHistory,
} from '@/lib/attendance/month-rollover-service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const staffIdParam = searchParams.get('staffId') || undefined;
  const isSelf = Boolean(
    staffIdParam &&
    (staffIdParam === session.user.id || staffIdParam === session.user.employeeId)
  );

  // Privileged roles or self-requesting employee/intern
  if (!['superadmin', 'admin', 'hr'].includes(session.user.role) && !isSelf) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const type = searchParams.get('type') || 'attendance'; // 'attendance' | 'worklogs' | 'lifetime'
    const parsedYear = parseInt(searchParams.get('year') || '', 10);
    const parsedMonth = parseInt(searchParams.get('month') || '', 10);
    const staffId = isSelf ? (session.user.employeeId || session.user.id) : staffIdParam;

    const requestedBranch = searchParams.get('branch') || undefined;
    const branch = session.user.role === 'superadmin' ? (requestedBranch || 'All') : session.user.branch;

    const year = !isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2040 ? parsedYear : undefined;
    const month = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined;

    // 1. Lifetime Historical Summary for a specific staff member
    if (type === 'lifetime' || searchParams.get('lifetime') === 'true') {
      const targetStaffId = staffId || session.user.id;
      const lifetime = await getStaffLifetimeAttendanceHistory(targetStaffId);
      return NextResponse.json({
        success: true,
        type: 'lifetime',
        staffId: targetStaffId,
        lifetime,
      }, { headers: PRIVATE_HEADERS });
    }

    // 2. Monthly Worklog Archives
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

    // 3. Monthly Attendance Archives (Default)
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
