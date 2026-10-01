import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import {
  getFirestoreBatches,
  createFirestoreBatch,
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
    const status = searchParams.get('status') || undefined;
    const mentorId = searchParams.get('mentorId') || undefined;

    // Non-superadmin is restricted to their branch
    const branch = session.user.role === 'superadmin' && requestedBranch
      ? requestedBranch
      : session.user.branch;

    const batches = await getFirestoreBatches({ branch, status, mentorId });
    return NextResponse.json({ batches });
  } catch {
    return NextResponse.json({ error: 'Batches are temporarily unavailable.' }, { status: 503 });
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

  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (hasOversizedBody(request, 20_000)) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const courseName = typeof body.courseName === 'string' ? body.courseName.trim() : '';
    const batchCode = typeof body.batchCode === 'string' ? body.batchCode.trim() : '';
    const mentorId = typeof body.mentorId === 'string' ? body.mentorId.trim() : '';
    const mentorName = typeof body.mentorName === 'string' ? body.mentorName.trim() : '';
    const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
    const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : undefined;
    const maxCapacity = typeof body.maxCapacity === 'number' ? body.maxCapacity : 30;
    const studentIds = Array.isArray(body.studentIds) ? (body.studentIds as string[]) : [];

    if (!name || !batchCode || !courseId || !startDate) {
      return NextResponse.json({ error: 'Missing required batch fields.' }, { status: 400 });
    }

    const branch = (session.user.role === 'superadmin' && typeof body.branch === 'string'
      ? body.branch
      : session.user.branch) as Branch;

    const newBatch = await createFirestoreBatch({
      batchId: `batch_${Date.now()}`,
      batchCode,
      name,
      courseId,
      courseName: courseName || name,
      branch,
      branchId: `BR_${branch.toUpperCase().substring(0, 3)}`,
      mentorId: mentorId || session.user.id,
      mentorName: mentorName || session.user.name,
      startDate,
      endDate,
      status: 'active',
      studentCount: studentIds.length,
      maxCapacity,
      studentIds,
    });

    return NextResponse.json({ batch: newBatch }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create batch.' }, { status: 500 });
  }
}
