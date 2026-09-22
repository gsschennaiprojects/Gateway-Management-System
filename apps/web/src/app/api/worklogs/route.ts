import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkLogs, getStaffMonthlySummary, addWorkLog } from '@/lib/worklogs/worklog-store';
import { Branch } from '@/types/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('targetUserId') || undefined;
  const branchParam = (searchParams.get('branch') as Branch | 'all') || undefined;
  const dateParam = searchParams.get('date') || undefined;

  try {
    const logs = getWorkLogs(session.user, {
      targetUserId,
      branch: branchParam,
      date: dateParam
    });

    let summary = null;
    if (targetUserId) {
      summary = getStaffMonthlySummary(targetUserId);
    }

    return NextResponse.json({ logs, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve work logs';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const user = session.user;

    const plannedTasks = Array.isArray(body.plannedTasks)
      ? body.plannedTasks
      : body.tasksPending
      ? [body.tasksPending]
      : [];

    const completedTasks = Array.isArray(body.completedTasks)
      ? body.completedTasks
      : body.tasksCompleted
      ? [body.tasksCompleted]
      : [];

    const hours = typeof body.totalHours === 'string'
      ? parseFloat(body.totalHours) || 8.5
      : typeof body.totalHours === 'number'
      ? body.totalHours
      : 8.5;

    const entry = addWorkLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      branch: user.branch,
      date: body.date || new Date().toISOString().substring(0, 10),
      loginTime: body.loginTime || '09:00 AM',
      logoutTime: body.logoutTime || '06:00 PM',
      plannedTasks,
      completedTasks,
      attendanceStatus: body.attendanceStatus || 'present',
      hoursLogged: hours,
    });

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save work log';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
