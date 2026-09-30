import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';
import { getFirestoreStaffAttendanceGrid, saveFirestoreStaffAttendanceGrid } from '@/lib/attendance/attendance-service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const parsedYear = parseInt(searchParams.get('year') || '', 10);
    const parsedMonth = parseInt(searchParams.get('month') || '', 10);

    const year = !isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2040 ? parsedYear : now.getFullYear();
    const month = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1;

    const requestedBranch = searchParams.get('branch') || undefined;
    const branch = session.user.role === 'superadmin' ? (requestedBranch || 'All') : session.user.branch;

    const { records, lastUpdated } = await getFirestoreStaffAttendanceGrid({
      year,
      month,
      branch,
    });

    return NextResponse.json({
      success: true,
      year,
      month,
      branch,
      records,
      lastUpdated,
      canEdit: true,
    }, { headers: PRIVATE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch staff attendance';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: PRIVATE_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  if (hasOversizedBody(req, 131_072)) {
    return NextResponse.json({ success: false, error: 'Request payload is too large.' }, { status: 413, headers: PRIVATE_HEADERS });
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid attendance payload' }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const { year, month, records } = body;
    if (typeof year !== 'number' || year < 2020 || year > 2040) {
      return NextResponse.json({ success: false, error: 'Valid year is required' }, { status: 400, headers: PRIVATE_HEADERS });
    }
    if (typeof month !== 'number' || month < 1 || month > 12) {
      return NextResponse.json({ success: false, error: 'Valid month (1-12) is required' }, { status: 400, headers: PRIVATE_HEADERS });
    }
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: 'Records array is required' }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const { count, updatedAt } = await saveFirestoreStaffAttendanceGrid({
      year,
      month,
      records,
      actor: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        branch: session.user.branch,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance records successfully updated and overwritten in Firestore.',
      count,
      updatedAt,
    }, { headers: PRIVATE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save staff attendance';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
