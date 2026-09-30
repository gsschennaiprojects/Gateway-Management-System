import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreWorklogs, getFirestoreUserById } from '@/lib/firebase/firebase-admin';
import { calculateWorkingTime, getLiveDateInfo, parseTasks } from '@/lib/worklogs/worklog-session-utils';
import { canViewUserWorkLogs } from '@/lib/rbac/permissions';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('targetUserId') || session.user.id;
    const target = targetUserId === session.user.id ? session.user : await getFirestoreUserById(targetUserId);
    if (!target || !canViewUserWorkLogs(session.user, target)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const date = searchParams.get('today') === 'true' ? getLiveDateInfo().isoDate : searchParams.get('date') || undefined;
    const logs = await getFirestoreWorklogs({ userId: targetUserId, date });
    const todayLog = logs.find(log => log.date === getLiveDateInfo().isoDate) || null;
    return NextResponse.json({ logs, summary: null, todayLog, isPunchedIn: !!todayLog?.loginTime, isPunchedOut: !!todayLog?.logoutTime, liveInfo: getLiveDateInfo() });
  } catch {
    return NextResponse.json({ error: 'Worklogs are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (hasOversizedBody(request, 16_384)) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid worklog request.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const action = input.action;
    if (action !== 'punchIn' && action !== 'punchOut' && action !== 'save') return NextResponse.json({ error: 'Only supported worklog actions are allowed.' }, { status: 400 });
    const db = getAdminFirestore();
    if (!db) return NextResponse.json({ error: 'Worklog storage is unavailable.' }, { status: 503 });
    const user = session.user;
    const liveInfo = getLiveDateInfo();
    const id = `WL_${user.id}_${liveInfo.isoDate.replace(/-/g, '')}`;
    const ref = db.collection('daily_worklogs').doc(id);
    const projection = db.collection('projection_jobs').doc(`worklog:${id}:${action}`);
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const plannedTasks = parseTasks(typeof input.plannedTasks === 'string' || Array.isArray(input.plannedTasks) ? input.plannedTasks as string[] | string : undefined);
    const completedTasks = parseTasks(typeof input.completedTasks === 'string' || Array.isArray(input.completedTasks) ? input.completedTasks as string[] | string : undefined);
    let result: Record<string, unknown> = {};
    let workingCalc: ReturnType<typeof calculateWorkingTime> = null;

    await db.runTransaction(async transaction => {
      const existingSnapshot = await transaction.get(ref);
      const existing = existingSnapshot.exists ? existingSnapshot.data()! : null;
      const timestamp = now.toISOString();
      if (action === 'punchIn') {
        if (existing?.loginTime) throw new Error('PUNCH_CONFLICT');
        if (plannedTasks.length === 0 || plannedTasks.length > 30) throw new Error('INVALID_TASKS');
        result = { id, userId: user.id, userName: user.name, userRole: user.role, branch: user.branch, date: liveInfo.isoDate, loginTime: currentTime, logoutTime: null, plannedTasks, completedTasks: [], incompleteReason: '', attendanceStatus: 'present', hoursLogged: 0, totalHours: 'Active', createdAt: timestamp, updatedAt: timestamp };
        transaction.create(ref, result);
      } else if (action === 'save') {
        if (!existing?.loginTime || existing.logoutTime) throw new Error('PUNCH_CONFLICT');
        if (plannedTasks.length === 0 || plannedTasks.length > 30) throw new Error('INVALID_TASKS');
        result = { ...existing, plannedTasks, updatedAt: timestamp };
        transaction.update(ref, { plannedTasks, updatedAt: timestamp });
      } else {
        if (!existing?.loginTime || existing.logoutTime) throw new Error('PUNCH_CONFLICT');
        const existingPlan = parseTasks(existing.plannedTasks);
        if (completedTasks.length === 0 || completedTasks.length > 30) throw new Error('INVALID_TASKS');
        const reason = typeof input.incompleteReason === 'string' ? input.incompleteReason.trim() : '';
        if (completedTasks.length < existingPlan.length && reason.length < 10) throw new Error('INCOMPLETE_REASON');
        workingCalc = calculateWorkingTime(existing.loginTime, currentTime);
        if (!workingCalc || workingCalc.totalMinutes <= 0 || workingCalc.totalMinutes > 24 * 60) throw new Error('INVALID_TIME');
        result = { ...existing, id, logoutTime: currentTime, completedTasks, incompleteReason: reason, hoursLogged: workingCalc.decimalHours, totalHours: workingCalc.formatted, updatedAt: timestamp };
        transaction.update(ref, { logoutTime: currentTime, completedTasks, incompleteReason: reason, hoursLogged: workingCalc.decimalHours, totalHours: workingCalc.formatted, updatedAt: timestamp });
      }
      transaction.set(projection, { id: projection.id, type: 'worklog.project', entityId: id, branchId: user.branch, action, state: 'pending', attempts: 0, createdAt: timestamp });
    });
    return NextResponse.json({ success: true, entry: result, workingCalc, isPunchedIn: true, isPunchedOut: action === 'punchOut' }, { status: action === 'punchIn' ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PUNCH_CONFLICT') return NextResponse.json({ error: 'This worklog transition has already been recorded or is out of order.' }, { status: 409 });
    if (code === 'INVALID_TASKS' || code === 'INCOMPLETE_REASON' || code === 'INVALID_TIME') return NextResponse.json({ error: code === 'INCOMPLETE_REASON' ? 'Provide a detailed reason for incomplete planned tasks.' : code === 'INVALID_TIME' ? 'Punch time is invalid.' : 'Enter valid task details.' }, { status: 400 });
    return NextResponse.json({ error: 'Worklog storage is temporarily unavailable.' }, { status: 503 });
  }
}
