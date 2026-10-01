import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import {
  getFirestoreLeaveRequests,
  createFirestoreLeaveRequest,
  reviewFirestoreLeaveRequest,
} from '@/lib/operations/operations-service';
import type { LeaveType, LeaveStatus } from '@/types/operations';
import type { Branch } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') as LeaveStatus) || undefined;
    const isManager = ['superadmin', 'admin', 'hr'].includes(session.user.role);

    // Regular staff only see their own requests
    const applicantId = isManager && searchParams.get('all') === 'true'
      ? undefined
      : isManager && searchParams.get('applicantId')
        ? searchParams.get('applicantId')!
        : isManager
          ? undefined
          : session.user.id;

    const branch = session.user.role === 'superadmin' && searchParams.get('branch')
      ? searchParams.get('branch')!
      : session.user.branch;

    const leaves = await getFirestoreLeaveRequests({
      branch: applicantId ? undefined : branch,
      applicantId,
      status,
    });

    return NextResponse.json({ leaves });
  } catch {
    return NextResponse.json({ error: 'Leave requests are temporarily unavailable.' }, { status: 503 });
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

  if (hasOversizedBody(request, 10_000)) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const leaveType = body.leaveType as LeaveType;
    const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
    const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : '';
    const daysCount = typeof body.daysCount === 'number' ? body.daysCount : 1;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json({ error: 'Please provide all required leave details.' }, { status: 400 });
    }

    const branch = session.user.branch as Branch;
    const newLeave = await createFirestoreLeaveRequest({
      applicantId: session.user.id,
      applicantName: session.user.name,
      applicantRole: session.user.role,
      branch,
      branchId: `BR_${branch.toUpperCase().substring(0, 3)}`,
      leaveType,
      startDate,
      endDate,
      daysCount,
      reason,
    });

    return NextResponse.json({ leave: newLeave }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create leave request.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const leaveId = typeof body.leaveId === 'string' ? body.leaveId.trim() : '';
    const status = body.status as 'approved' | 'rejected';
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : undefined;

    if (!leaveId || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Valid leaveId and status (approved/rejected) are required.' }, { status: 400 });
    }

    await reviewFirestoreLeaveRequest({
      leaveId,
      status,
      reviewer: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
      },
      remarks,
    });

    return NextResponse.json({ success: true, leaveId, status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update leave request.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
