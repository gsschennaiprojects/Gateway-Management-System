import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkLogs, getStaffMonthlySummary, addWorkLog } from '@/lib/worklogs/worklog-store';
import { Branch } from '@/types/auth';
import { syncWorklogToFirestore, syncAttendanceToFirestore } from '@/lib/firebase/firebase-admin';
import {
  upsertWorklog,
  appendBranchDailyWorklog,
  upsertStaffAttendanceRecord,
  punchOutStaffAttendanceRecord,
} from '@/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';
import {
  getLiveDateInfo,
  calculateWorkingTime,
  parseTasks,
  serializeTasks,
} from '@/lib/worklogs/worklog-session-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('targetUserId') || undefined;
  const branchParam = (searchParams.get('branch') as Branch | 'all') || undefined;
  const isToday = searchParams.get('today') === 'true';
  const liveInfo = getLiveDateInfo();
  const dateParam = isToday ? liveInfo.isoDate : searchParams.get('date') || undefined;

  try {
    // 1. Authoritative Firestore Fetch
    let firestoreLogs: any[] = [];
    try {
      const { getFirestoreWorklogs } = await import('@/lib/firebase/firebase-admin');
      firestoreLogs = await getFirestoreWorklogs({
        userId: targetUserId || session.user.id,
        branch: branchParam,
        date: dateParam
      });
    } catch (fsErr) {
      console.warn('[Worklogs/GET] Firestore fetch note:', fsErr);
    }

    // 2. In-memory logs
    const inMemLogs = getWorkLogs(session.user, {
      targetUserId: targetUserId || session.user.id,
      branch: branchParam,
      date: dateParam,
    });

    // 3. Deduplicate by log ID or userId+date with Firestore as authority
    const logMap = new Map<string, any>();
    for (const l of inMemLogs) {
      logMap.set(l.id || `${l.userId}_${l.date}`, l);
    }
    for (const fl of firestoreLogs) {
      logMap.set(fl.id || `${fl.userId}_${fl.date}`, fl);
    }
    const logs = Array.from(logMap.values());

    let summary = null;
    if (targetUserId) {
      summary = getStaffMonthlySummary(targetUserId);
    }

    // Find today's entry specifically for the active user session
    let todayLog = logs.find(
      (l) => l.userId === (targetUserId || session.user.id) && (l.date === liveInfo.isoDate || l.date === liveInfo.sheetDate)
    ) || null;

    if (!todayLog && isToday) {
      try {
        const { getFirestoreWorklogById } = await import('@/lib/firebase/firebase-admin');
        const exactId = `WL_${targetUserId || session.user.id}_${liveInfo.isoDate.replace(/-/g, '')}`;
        const exactDoc = await getFirestoreWorklogById(exactId);
        if (exactDoc) {
          todayLog = exactDoc;
        }
      } catch (e) {
        console.warn('[Worklogs/GET] Exact today doc lookup note:', e);
      }
    }

    const workingCalc = todayLog?.loginTime && todayLog?.logoutTime
      ? calculateWorkingTime(todayLog.loginTime, todayLog.logoutTime)
      : null;

    return NextResponse.json({
      logs,
      summary,
      todayLog,
      isPunchedIn: !!todayLog?.loginTime,
      isPunchedOut: !!todayLog?.logoutTime,
      calculatedHours: workingCalc,
      liveInfo,
    });
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
    const liveInfo = getLiveDateInfo();
    const action = body.action || 'save'; // 'punchIn' | 'punchOut' | 'save' | 'clearPunch'

    const targetDate = body.date || liveInfo.isoDate;

    if (action === 'clearPunch') {
      const { clearTodayWorkLog } = await import('@/lib/worklogs/worklog-store');
      clearTodayWorkLog(user.id, targetDate);
      return NextResponse.json({ success: true, message: 'Punch session reset and cleared successfully.' });
    }

    const dateKey = targetDate.replace(/-/g, '');
    const logId = body.logId || `WL_${user.id}_${dateKey}`;
    const attId = `ATT_${user.id}_${dateKey}`;

    // Look up existing entry from Firestore / memory to preserve already saved login state across separate appends
    let existingEntry: any = null;
    try {
      const { getFirestoreWorklogById } = await import('@/lib/firebase/firebase-admin');
      existingEntry = await getFirestoreWorklogById(logId);
    } catch {}
    if (!existingEntry) {
      const inMem = getWorkLogs(user, { targetUserId: user.id, date: targetDate });
      existingEntry = inMem.find(l => l.id === logId || l.date === targetDate) || null;
    }

    // Normalize task points
    const rawPlanned = body.plannedTasks || body.tasksPending || existingEntry?.plannedTasks || [];
    let plannedTasks = parseTasks(rawPlanned);

    const rawCompleted = body.completedTasks || body.tasksCompleted || existingEntry?.completedTasks || [];
    let completedTasks = parseTasks(rawCompleted);

    // ── 1. Validation Rules ──────────────────────────────────────────────────
    if (action === 'punchIn') {
      if (plannedTasks.length === 0) {
        return NextResponse.json(
          { error: 'At least one planned task must be entered before logging in.' },
          { status: 400 }
        );
      }
    } else if (action === 'punchOut') {
      if (completedTasks.length === 0) {
        return NextResponse.json(
          { error: 'At least one completed task must be entered before logging out.' },
          { status: 400 }
        );
      }

      // Check if completed tasks are fewer than planned tasks
      if (completedTasks.length < plannedTasks.length) {
        const reason = (body.incompleteReason || existingEntry?.incompleteReason || '').trim();
        if (!reason) {
          return NextResponse.json(
            {
              error: `Completed tasks (${completedTasks.length}) are fewer than planned tasks (${plannedTasks.length}). Please provide the reason for incomplete tasks before logging out.`
            },
            { status: 400 }
          );
        }
      }
    }

    // ── 2. Time & Hours Calculation ──────────────────────────────────────────
    let loginTime = body.loginTime || existingEntry?.loginTime;
    let logoutTime = body.logoutTime || existingEntry?.logoutTime;

    if (action === 'punchIn') {
      loginTime = body.loginTime || liveInfo.currentTime;
      // Do not set logoutTime on login
      logoutTime = null;
    } else if (action === 'punchOut') {
      logoutTime = body.logoutTime || liveInfo.currentTime;
      if (!loginTime && existingEntry?.loginTime) {
        loginTime = existingEntry.loginTime;
      }
    }

    // Automatically calculate hours between login and logout
    const workingCalc = loginTime && logoutTime ? calculateWorkingTime(loginTime, logoutTime) : null;
    const hours = workingCalc
      ? workingCalc.decimalHours
      : (action === 'punchIn' ? 0 : (typeof body.totalHours === 'number' ? body.totalHours : parseFloat(body.totalHours) || 8.5));
    const totalHoursStr = workingCalc
      ? workingCalc.formatted
      : (action === 'punchIn' ? 'Active' : `${hours} hrs`);

    const incompleteReason = body.incompleteReason || existingEntry?.incompleteReason || '';

    // ── 3. Append to In-Memory Store ────────────────────────────────────────
    const entry = addWorkLog({
      id: logId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      branch: user.branch,
      date: targetDate,
      loginTime: loginTime || null,
      logoutTime: logoutTime || null,
      plannedTasks,
      completedTasks,
      incompleteReason,
      attendanceStatus: body.attendanceStatus || 'present',
      hoursLogged: hours,
      totalHours: totalHoursStr,
    });

    // ── 4. Dual Persistence: Append to Firebase Firestore (Same Document) ───
    try {
      await syncWorklogToFirestore({
        id: entry.id,
        userId: entry.userId,
        userName: entry.userName,
        userRole: entry.userRole,
        branch: entry.branch,
        date: entry.date,
        loginTime: entry.loginTime || '',
        logoutTime: entry.logoutTime || '',
        plannedTasks: entry.plannedTasks,
        completedTasks: entry.completedTasks,
        incompleteReason,
        attendanceStatus: entry.attendanceStatus,
        hoursLogged: entry.hoursLogged ?? 0,
        totalHours: totalHoursStr,
      });

      // Also sync punch state to Firestore attendance collection
      await syncAttendanceToFirestore({
        id: attId,
        userId: user.id,
        userName: user.name,
        role: user.role,
        branch: user.branch,
        date: targetDate,
        punchIn: loginTime || undefined,
        punchOut: logoutTime || undefined,
        status: logoutTime ? 'Concluded' : 'Present',
      });
    } catch (fsErr) {
      console.warn('[Worklogs/POST] Firestore sync note:', fsErr);
    }

    // 2. Dual persistence: Sync to Google Sheets
    try {
      const branchCode = BRANCH_NAME_TO_CODE[user.branch];
      const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;

      if (spreadsheetId) {
        const semicolonCompleted = serializeTasks(completedTasks);
        const semicolonPlanned = serializeTasks(plannedTasks);

        await Promise.race([
          (async () => {
            // Staff personal operational subsheet WL_<ID>
            await upsertWorklog(spreadsheetId, user.id, {
              logId: entry.id,
              date: entry.date,
              loginTime: entry.loginTime || '',
              logoutTime: entry.logoutTime || '',
              tasksCompleted: semicolonCompleted,
              tasksPending: semicolonPlanned,
              incompleteReason,
              totalHours: totalHoursStr,
              verifiedBy: 'Self',
            });

            // Master 03_Daily_Worklogs
            await appendBranchDailyWorklog(spreadsheetId, {
              logId: entry.id,
              staffId: user.id,
              staffName: user.name,
              role: user.role,
              branchId: branchCode,
              date: entry.date,
              loginTime: entry.loginTime || '',
              logoutTime: entry.logoutTime || '',
              tasksCompleted: semicolonCompleted,
              tasksPending: semicolonPlanned,
              incompleteReason,
              totalHours: hours,
            });

            // Update 04_Staff_Attendance
            if (action === 'punchOut' && logoutTime) {
              await punchOutStaffAttendanceRecord(spreadsheetId, {
                staffId: user.id,
                staffName: user.name,
                role: user.role,
                date: targetDate,
                day: liveInfo.dayOfWeek,
                checkOutTime: logoutTime,
                totalHours: hours,
                markedBy: 'Self (Punch Out)',
              });
            } else if (loginTime) {
              await upsertStaffAttendanceRecord(spreadsheetId, [
                attId,
                targetDate,
                liveInfo.dayOfWeek,
                user.id,
                user.name,
                user.role,
                loginTime,
                logoutTime || '-',
                String(hours || 0),
                'Present',
                'Punch In',
                new Date().toISOString(),
              ]);
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 3500))
        ]);
      }
    } catch (sheetErr) {
      console.warn('[Worklogs/POST] Google Sheets projection note:', sheetErr);
    }

    return NextResponse.json(
      {
        success: true,
        entry,
        workingCalc,
        isPunchedIn: !!entry.loginTime,
        isPunchedOut: !!entry.logoutTime,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save work log';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
