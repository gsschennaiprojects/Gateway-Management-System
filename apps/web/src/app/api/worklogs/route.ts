import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreWorklogs, getFirestoreUserById } from '@/lib/firebase/firebase-admin';
import {
  calculateWorkingTime,
  evaluateEntryPunctuality,
  getLiveDateInfo,
  parseTasks,
  differenceInCalendarDays,
} from '@/lib/worklogs/worklog-session-utils';
import { canViewUserWorkLogs } from '@/lib/rbac/permissions';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';
import type { StaffAttendanceStatus, WorkLogEntry, StaffMonthlySummary } from '@/types/worklog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('targetUserId') || session.user.id;
    const target = targetUserId === session.user.id ? session.user : await getFirestoreUserById(targetUserId);
    if (!target || !canViewUserWorkLogs(session.user, target)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    const liveInfo = getLiveDateInfo();
    const isTodayRequested = searchParams.get('today') === 'true';
    const dateParam = searchParams.get('date') || undefined;

    // Fetch user worklogs
    const logs = await getFirestoreWorklogs({ userId: targetUserId, date: isTodayRequested ? undefined : dateParam });

    // 1. Check for today's log
    let todayLog: WorkLogEntry | null = logs.find(log => log.date === liveInfo.isoDate) || null;

    // 2. If today's log has no active punch or doesn't exist, search for any ongoing unclosed session
    let activeSessionLog: WorkLogEntry | null = todayLog && todayLog.loginTime && !todayLog.logoutTime ? todayLog : null;

    if (!activeSessionLog && isTodayRequested) {
      // Find the most recent unclosed worklog across all dates
      const unclosedLogs = logs
        .filter(log => log.loginTime && !log.logoutTime)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      if (unclosedLogs.length > 0) {
        const unclosed = unclosedLogs[0];
        activeSessionLog = unclosed;
        todayLog = unclosed;

        // If the unclosed session started on a prior calendar day, proactively bridge attendance up to today
        if (unclosed.date && unclosed.date < liveInfo.isoDate) {
          try {
            const { bridgeMultiDayAttendance } = await import('@/lib/attendance/auto-attendance-service');
            bridgeMultiDayAttendance(target, unclosed.date, liveInfo.isoDate).catch(err => {
              console.warn('[WorklogAPI] Background multi-day bridge warning:', err);
            });
          } catch {
            // Non-blocking bridge execution
          }
        }
      }
    }

    const isSpanningDays = !!(todayLog && todayLog.date && todayLog.date < liveInfo.isoDate && !todayLog.logoutTime);
    const daysElapsed = isSpanningDays ? differenceInCalendarDays(todayLog!.date, liveInfo.isoDate) + 1 : 1;

    // 3. Compute Live Monthly Summary
    const daysInMonth = new Date(liveInfo.year, liveInfo.month, 0).getDate();
    let totalWorkingDays = 0;
    let elapsedWorkingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(liveInfo.year, liveInfo.month - 1, d);
      if (dt.getDay() !== 0) {
        totalWorkingDays++;
        if (d <= liveInfo.day) elapsedWorkingDays++;
      }
    }

    const monthPrefix = `${liveInfo.year}-${String(liveInfo.month).padStart(2, '0')}`;
    const monthlyLogs = logs.filter(l => l.date && l.date.startsWith(monthPrefix));
    const totalPlanned = monthlyLogs.reduce((sum, l) => sum + (Array.isArray(l.plannedTasks) ? l.plannedTasks.length : 0), 0);
    const totalCompleted = monthlyLogs.reduce((sum, l) => sum + (Array.isArray(l.completedTasks) ? l.completedTasks.length : 0), 0);

    let presentDays = monthlyLogs.filter(l => l.attendanceStatus === 'present' || l.attendanceStatus === 'late').length;
    let absentDays = monthlyLogs.filter(l => l.attendanceStatus === 'absent').length;
    let holidayDays = monthlyLogs.filter(l => l.attendanceStatus === 'holiday').length;

    const db = getAdminFirestore();
    if (db) {
      try {
        const attDoc = await db.collection('staff_attendance').doc(`att_${targetUserId}_${liveInfo.year}_${liveInfo.month}`).get();
        if (attDoc && attDoc.exists) {
          const attMap = (attDoc.data()?.attendance || {}) as Record<string, string>;
          let pCount = 0;
          let aCount = 0;
          let hCount = 0;
          for (const st of Object.values(attMap)) {
            if (st === 'present' || st === 'late') pCount++;
            else if (st === 'half_day') pCount += 0.5;
            else if (st === 'absent') aCount++;
            else if (st === 'holiday') hCount++;
          }
          if (pCount > 0) presentDays = pCount;
          if (aCount > 0) absentDays = aCount;
          if (hCount > 0) holidayDays = hCount;
        }
      } catch {
        // Fallback to worklog count
      }
    }

    const baseDays = elapsedWorkingDays > 0 ? elapsedWorkingDays : totalWorkingDays;
    const attendanceRate = baseDays > 0 ? Math.min(100, Math.round((presentDays / baseDays) * 1000) / 10) : 0;
    const completionRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

    const summary: StaffMonthlySummary = {
      userId: targetUserId,
      userName: target.name,
      userRole: target.role,
      branch: target.branch,
      month: `${liveInfo.monthName} ${liveInfo.year}`,
      totalWorkingDays,
      presentDays,
      absentDays,
      holidayDays,
      attendanceRate,
      totalPlannedTasks: totalPlanned,
      totalCompletedTasks: totalCompleted,
      completionRate,
      assignedStudentsCount: 0,
    };

    return NextResponse.json({
      logs: isTodayRequested && todayLog ? [todayLog] : logs,
      summary,
      todayLog: todayLog ? {
        ...todayLog,
        isSpanningDays,
        sessionStartDate: todayLog.date,
        daysElapsed,
      } : null,
      isPunchedIn: !!todayLog?.loginTime,
      isPunchedOut: !!todayLog?.logoutTime,
      isSpanningDays,
      daysElapsed,
      liveInfo,
    });
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

        // Check for any unclosed work session from earlier days
        const wlCol = db.collection('daily_worklogs');
        if (typeof wlCol.where === 'function') {
          const unclosedSnap = await wlCol
            .where('userId', '==', user.id)
            .where('logoutTime', '==', null)
            .get();
          if (unclosedSnap && !unclosedSnap.empty) {
            throw new Error('PUNCH_CONFLICT');
          }
        }

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
        // Resolve active unclosed worklog doc
        let activeWlRef = ref;
        let activeWlData = existing;
        if (!activeWlData?.loginTime || activeWlData.logoutTime) {
          const wlCol = db.collection('daily_worklogs');
          if (typeof wlCol.where === 'function') {
            const unclosedSnap = await wlCol
              .where('userId', '==', user.id)
              .where('logoutTime', '==', null)
              .get();
            if (unclosedSnap && !unclosedSnap.empty) {
              activeWlRef = unclosedSnap.docs[0].ref;
              activeWlData = unclosedSnap.docs[0].data();
            }
          }
        }
        if (!activeWlData?.loginTime || activeWlData.logoutTime) throw new Error('PUNCH_CONFLICT');
        if (plannedTasks.length === 0 || plannedTasks.length > 30) throw new Error('INVALID_TASKS');
        result = { ...activeWlData, plannedTasks, updatedAt: timestamp };
        transaction.update(activeWlRef, { plannedTasks, updatedAt: timestamp });
      } else {
        // Punch Out / Logout
        let activeWlRef = ref;
        let activeWlData = existing;

        if (!activeWlData?.loginTime || activeWlData.logoutTime) {
          // Check explicitly provided logId
          const targetDocId = typeof input.logId === 'string' && input.logId ? input.logId : null;
          if (targetDocId) {
            const docSnap = await transaction.get(db.collection('daily_worklogs').doc(targetDocId));
            if (docSnap.exists && docSnap.data()?.loginTime && !docSnap.data()?.logoutTime) {
              activeWlRef = docSnap.ref;
              activeWlData = docSnap.data()!;
            }
          }
          if (!activeWlData?.loginTime || activeWlData.logoutTime) {
            // Find most recent unclosed worklog for this user
            const wlCol = db.collection('daily_worklogs');
            if (typeof wlCol.where === 'function') {
              const unclosedSnap = await wlCol
                .where('userId', '==', user.id)
                .where('logoutTime', '==', null)
                .get();
              if (unclosedSnap && !unclosedSnap.empty) {
                activeWlRef = unclosedSnap.docs[0].ref;
                activeWlData = unclosedSnap.docs[0].data();
              }
            }
          }
        }

        if (!activeWlData?.loginTime || activeWlData.logoutTime) throw new Error('PUNCH_CONFLICT');

        const existingPlan = parseTasks(activeWlData.plannedTasks);
        if (completedTasks.length === 0 || completedTasks.length > 30) throw new Error('INVALID_TASKS');
        const reason = typeof input.incompleteReason === 'string' ? input.incompleteReason.trim() : '';
        if (completedTasks.length < existingPlan.length && reason.length < 10) throw new Error('INCOMPLETE_REASON');

        const sessionStartDate = (activeWlData.date as string) || liveInfo.isoDate;
        const isMultiDay = sessionStartDate !== liveInfo.isoDate;
        const daysSpanned = isMultiDay ? differenceInCalendarDays(sessionStartDate, liveInfo.isoDate) + 1 : 1;

        workingCalc = calculateWorkingTime(activeWlData.loginTime as string, currentTime, sessionStartDate, liveInfo.isoDate);
        if (!workingCalc || workingCalc.totalMinutes <= 0) throw new Error('INVALID_TIME');

        const finalStatus = isMultiDay ? 'present' : workingCalc.attendanceStatus;
        const mappedFinalStatus = finalStatus === 'late' ? 'Late' : finalStatus === 'half_day' ? 'Half-Day' : finalStatus === 'present' ? 'Present' : 'Absent';

        result = {
          ...activeWlData,
          logoutTime: currentTime,
          logoutDate: liveInfo.isoDate,
          completedTasks,
          incompleteReason: reason,
          hoursLogged: workingCalc.decimalHours,
          totalHours: workingCalc.formatted,
          workingMinutes: workingCalc.totalMinutes,
          attendanceStatus: finalStatus,
          isMultiDay,
          daysSpanned,
          updatedAt: timestamp,
        };

        transaction.update(activeWlRef, {
          logoutTime: currentTime,
          logoutDate: liveInfo.isoDate,
          completedTasks,
          incompleteReason: reason,
          hoursLogged: workingCalc.decimalHours,
          totalHours: workingCalc.formatted,
          workingMinutes: workingCalc.totalMinutes,
          attendanceStatus: finalStatus,
          isMultiDay,
          daysSpanned,
          updatedAt: timestamp,
        });

        // Synchronous Attendance Collection Exit (on logout date)
        transaction.set(attRef, {
          attendanceId: attId,
          date: liveInfo.isoDate,
          day: liveInfo.dayOfWeek,
          staffId: user.id,
          staffName: user.name,
          role: user.role,
          branchId: `BR_${user.branch.toUpperCase().substring(0, 3)}`,
          branch: user.branch,
          checkIn: (activeWlData.loginTime as string) || currentTime,
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
            isMultiDay,
            daysSpanned,
          }),
        });
      }
      transaction.set(projection, { id: projection.id, type: 'worklog.project', entityId: id, branchId: user.branch, action, state: 'pending', attempts: 0, createdAt: timestamp });
    });

    // If session spanned across multiple days, ensure all intervening calendar days are credited as present
    const spannedDate = typeof result.date === 'string' ? result.date : null;
    if (spannedDate && spannedDate < liveInfo.isoDate) {
      try {
        const { bridgeMultiDayAttendance } = await import('@/lib/attendance/auto-attendance-service');
        await bridgeMultiDayAttendance(user, spannedDate, liveInfo.isoDate);
      } catch (bridgeErr) {
        console.warn('[WorklogAPI] Post-punchout multi-day bridge warning:', bridgeErr);
      }
    }

    return NextResponse.json({ success: true, entry: result, workingCalc, isPunchedIn: true, isPunchedOut: action === 'punchOut' }, { status: action === 'punchIn' ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PUNCH_CONFLICT') return NextResponse.json({ error: 'This worklog transition has already been recorded or is out of order.' }, { status: 409 });
    if (code === 'INVALID_TASKS' || code === 'INCOMPLETE_REASON' || code === 'INVALID_TIME') return NextResponse.json({ error: code === 'INCOMPLETE_REASON' ? 'Provide a detailed reason for incomplete planned tasks.' : code === 'INVALID_TIME' ? 'Punch time is invalid.' : 'Enter valid task details.' }, { status: 400 });
    return NextResponse.json({ error: 'Worklog storage is temporarily unavailable.' }, { status: 503 });
  }
}
