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
    const logs = getWorkLogs(session.user, {
      targetUserId: targetUserId || session.user.id,
      branch: branchParam,
      date: dateParam,
    });

    let summary = null;
    if (targetUserId) {
      summary = getStaffMonthlySummary(targetUserId);
    }

    // Find today's entry specifically for the active user session
    const todayLog = logs.find(
      (l) => l.userId === (targetUserId || session.user.id) && (l.date === liveInfo.isoDate || l.date === liveInfo.sheetDate)
    ) || null;

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
    const action = body.action || 'save'; // 'punchIn' | 'punchOut' | 'save'

    const targetDate = body.date || liveInfo.isoDate;
    const dateKey = targetDate.replace(/-/g, '');
    const attId = `ATT_${user.id}_${dateKey}`;

    // Normalize task points
    const rawPlanned = body.plannedTasks || body.tasksPending || [];
    const plannedTasks = parseTasks(rawPlanned);

    const rawCompleted = body.completedTasks || body.tasksCompleted || [];
    const completedTasks = parseTasks(rawCompleted);

    let loginTime = body.loginTime;
    let logoutTime = body.logoutTime;

    if (action === 'punchIn') {
      loginTime = loginTime || liveInfo.currentTime;
    } else if (action === 'punchOut') {
      logoutTime = logoutTime || liveInfo.currentTime;
    }

    // Automatically calculate hours if both times are present
    const workingCalc = loginTime && logoutTime ? calculateWorkingTime(loginTime, logoutTime) : null;
    const hours = workingCalc ? workingCalc.decimalHours : typeof body.totalHours === 'number' ? body.totalHours : parseFloat(body.totalHours) || 8.5;

    const entry = addWorkLog({
      id: body.logId || `WL_${user.id}_${dateKey}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      branch: user.branch,
      date: targetDate,
      loginTime: loginTime || null,
      logoutTime: logoutTime || null,
      plannedTasks,
      completedTasks,
      attendanceStatus: body.attendanceStatus || 'present',
      hoursLogged: hours,
    });

    // 1. Dual persistence: Sync to Firebase Firestore
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
        attendanceStatus: entry.attendanceStatus,
        hoursLogged: entry.hoursLogged ?? 8.5,
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

        // Staff personal operational subsheet WL_<ID>
        await upsertWorklog(spreadsheetId, user.id, {
          logId: entry.id,
          date: entry.date,
          loginTime: entry.loginTime || '',
          logoutTime: entry.logoutTime || '',
          tasksCompleted: semicolonCompleted,
          tasksPending: semicolonPlanned,
          incompleteReason: body.incompleteReason || '',
          totalHours: String(entry.hoursLogged ?? 8.5),
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
          incompleteReason: body.incompleteReason || '',
          totalHours: entry.hoursLogged ?? 8.5,
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
      }
    } catch (sheetErr) {
      console.warn('[Worklogs/POST] Google Sheets sync note:', sheetErr);
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
