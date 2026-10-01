import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import {
  recordStudentAttendanceBatch,
  getBatchAttendanceByDate,
  getStudentAttendanceRecords,
} from '@/lib/operations/operations-service';
import type { StudentAttendanceStatus } from '@/types/operations';
import type { Branch } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const date = searchParams.get('date');
    const studentId = searchParams.get('studentId') || undefined;

    if (batchId && date) {
      const records = await getBatchAttendanceByDate(batchId, date);
      return NextResponse.json({ records });
    }

    const branch = session.user.role === 'superadmin' && searchParams.get('branch')
      ? searchParams.get('branch')!
      : session.user.branch;

    const records = await getStudentAttendanceRecords({
      branch,
      date: date || undefined,
      studentId,
    });

    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: 'Attendance records are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  if (!['superadmin', 'admin', 'employee', 'hr'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (hasOversizedBody(request, 100_000)) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
    const batchCode = typeof body.batchCode === 'string' ? body.batchCode.trim() : '';
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const rawRecords = Array.isArray(body.records) ? body.records : [];

    if (!batchId || !batchCode || !date || rawRecords.length === 0) {
      return NextResponse.json({ error: 'batchId, batchCode, date, and attendance records are required.' }, { status: 400 });
    }

    const branch = session.user.branch as Branch;
    const records = rawRecords.map(r => ({
      studentId: String(r.studentId),
      studentName: String(r.studentName || 'Student'),
      status: (['present', 'absent', 'late', 'excused'].includes(r.status)
        ? r.status
        : 'present') as StudentAttendanceStatus,
      remarks: typeof r.remarks === 'string' ? r.remarks : undefined,
    }));

    const count = await recordStudentAttendanceBatch({
      batchId,
      batchCode,
      branch,
      branchId: `BR_${branch.toUpperCase().substring(0, 3)}`,
      date,
      markedBy: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
      },
      records,
    });

    return NextResponse.json({ success: true, count, date, batchId });
  } catch {
    return NextResponse.json({ error: 'Failed to record student attendance.' }, { status: 500 });
  }
}
