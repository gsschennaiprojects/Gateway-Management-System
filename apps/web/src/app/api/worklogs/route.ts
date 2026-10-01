import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreWorklogs, getFirestoreUserById } from '@/lib/firebase/firebase-admin';
import { calculateWorkingTime, evaluateEntryPunctuality, getLiveDateInfo, parseTasks } from '@/lib/worklogs/worklog-session-utils';
import { canViewUserWorkLogs } from '@/lib/rbac/permissions';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';
import type { StaffAttendanceStatus } from '@/types/worklog';

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

    // Client verification metadata
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'Browser Client';

    const user = session.user;
    const liveInfo = getLiveDateInfo();
    const id = `WL_${user.id}_${liveInfo.isoDate.replace(/-/g, '')}`;
    const attId = `ATT_${user.id}_${liveInfo.isoDate.replace(/-/g, '')}`;
    const gridId = `att_${user.id}_${liveInfo.year}_${liveInfo.month}`;
    const auditId = `audit_att_${user.id}_${Date.now()}`;

    const ref = db.collection('daily_worklogs').doc(id);
    const attRef = db.collection('attendance').doc(attId);
    const gridRef = db.collection('staff_attendance').doc(gridId);
    const auditRef = db.collection('audit_logs').doc(auditId);
    const projection = db.collection('projection_jobs').doc(`worklog:${id}:${action}`);

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
    const plannedTasks = parseTasks(typeof input.plannedTasks === 'string' || Array.isArray(input.plannedTasks) ? input.plannedTasks as string[] | string : undefined);
    const completedTasks = parseTasks(typeof input.completedTasks === 'string' || Array.isArray(input.completedTasks) ? input.completedTasks as string[] | string : undefined);
    let result: Record<string, unknown> = {};
    let workingCalc: ReturnType<typeof calculateWorkingTime> = null;

    await db.runTransaction(async transaction => {
      const existingSnapshot = await transaction.get(ref);
      const existingGridSnapshot = await transaction.get(gridRef);
      const existing = existingSnapshot.exists ? existingSnapshot.data()! : null;
      const timestamp = now.toISOString();

      if (action === 'punchIn') {
        if (existing?.loginTime) throw new Error('PUNCH_CONFLICT');
        if (plannedTasks.length === 0 || plannedTasks.length > 30) throw new Error('INVALID_TASKS');

        // Precise Entry Punctuality Evaluation
        const punctuality = evaluateEntryPunctuality(currentTime);
        const initialStatus: StaffAttendanceStatus = punctuality.entryStatus === 'half_day' ? 'half_day' : punctuality.isLate ? 'late' : 'present';
        const mappedAttStatus = initialStatus === 'late' ? 'Late' : initialStatus === 'half_day' ? 'Half-Day' : 'Present';

        result = {
          id,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          branch: user.branch,
          date: liveInfo.isoDate,
          loginTime: currentTime,
          logoutTime: null,
          plannedTasks,
          completedTasks: [],
          incompleteReason: '',
          attendanceStatus: initialStatus,
          hoursLogged: 0,
          totalHours: 'Active',
          workingMinutes: 0,
          isLate: punctuality.isLate,
          minutesLate: punctuality.minutesLate,
          entryIp: clientIp,
          userAgent,
          verifiedStatus: punctuality.statusLabel,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        transaction.create(ref, result);

        // Synchronous Attendance Collection Entry
        transaction.set(attRef, {
          attendanceId: attId,
          date: liveInfo.isoDate,
          day: liveInfo.dayOfWeek,
          staffId: user.id,
          staffName: user.name,
          role: user.role,
          branchId: `BR_${user.branch.toUpperCase().substring(0, 3)}`,
          branch: user.branch,
          checkIn: currentTime,
          checkOut: null,
          totalHours: 0,
          status: mappedAttStatus,
          ipAddress: clientIp,
          markedBy: `Self (${user.name})`,
          createdAt: timestamp,
          updatedAt: timestamp,
        }, { merge: true });

        // Synchronous Monthly Grid Sync
        const gridData = existingGridSnapshot.exists ? (existingGridSnapshot.data() as Record<string, unknown>) : {
          id: gridId,
          staffId: user.id,
          name: user.name,
          branch: user.branch,
          role: user.role,
          year: liveInfo.year,
          month: liveInfo.month,
          attendance: {},
        };
        const currentAttMap = ((gridData.attendance as Record<string, unknown>) || {});
        currentAttMap[liveInfo.day] = initialStatus;
        transaction.set(gridRef, {
          ...gridData,
          attendance: currentAttMap,
          updatedAt: timestamp,
          updatedBy: { id: user.id, name: user.name, role: user.role },
        }, { merge: true });

        // Immutable Audit Log
        transaction.set(auditRef, {
          id: auditId,
          timestamp,
          userId: user.id,
          userName: user.name,
          role: user.role,
          action: 'ATTENDANCE_PUNCH_IN',
          module: 'ATTENDANCE',
          recordId: attId,
          branch: user.branch,
          ipAddress: clientIp,
          newValue: JSON.stringify({
            checkIn: currentTime,
            status: mappedAttStatus,
            isLate: punctuality.isLate,
            minutesLate: punctuality.minutesLate,
            ip: clientIp,
          }),
        });
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

        const finalStatus = workingCalc.attendanceStatus;
        const mappedFinalStatus = finalStatus === 'late' ? 'Late' : finalStatus === 'half_day' ? 'Half-Day' : finalStatus === 'present' ? 'Present' : 'Absent';

        result = {
          ...existing,
          id,
          logoutTime: currentTime,
          completedTasks,
          incompleteReason: reason,
          hoursLogged: workingCalc.decimalHours,
          totalHours: workingCalc.formatted,
          workingMinutes: workingCalc.totalMinutes,
          attendanceStatus: finalStatus,
          updatedAt: timestamp,
        };
        transaction.update(ref, {
          logoutTime: currentTime,
          completedTasks,
          incompleteReason: reason,
          hoursLogged: workingCalc.decimalHours,
          totalHours: workingCalc.formatted,
          workingMinutes: workingCalc.totalMinutes,
          attendanceStatus: finalStatus,
          updatedAt: timestamp,
        });

        // Synchronous Attendance Collection Exit
        transaction.set(attRef, {
          checkOut: currentTime,
          totalHours: workingCalc.decimalHours,
          status: mappedFinalStatus,
          updatedAt: timestamp,
        }, { merge: true });

        // Synchronous Monthly Grid Sync
        const gridData = existingGridSnapshot.exists ? (existingGridSnapshot.data() as Record<string, unknown>) : {
          id: gridId,
          staffId: user.id,
          name: user.name,
          branch: user.branch,
          role: user.role,
          year: liveInfo.year,
          month: liveInfo.month,
          attendance: {},
        };
        const currentAttMap = ((gridData.attendance as Record<string, unknown>) || {});
        currentAttMap[liveInfo.day] = finalStatus;
        transaction.set(gridRef, {
          ...gridData,
          attendance: currentAttMap,
          updatedAt: timestamp,
          updatedBy: { id: user.id, name: user.name, role: user.role },
        }, { merge: true });

        // Immutable Audit Log
        transaction.set(auditRef, {
          id: auditId,
          timestamp,
          userId: user.id,
          userName: user.name,
          role: user.role,
          action: 'ATTENDANCE_PUNCH_OUT',
          module: 'ATTENDANCE',
          recordId: attId,
          branch: user.branch,
          ipAddress: clientIp,
          newValue: JSON.stringify({
            checkOut: currentTime,
            hoursWorked: workingCalc.decimalHours,
            finalStatus: mappedFinalStatus,
            completedTasksCount: completedTasks.length,
          }),
        });
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
