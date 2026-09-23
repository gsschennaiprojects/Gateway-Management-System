import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkLogs, getStaffMonthlySummary, addWorkLog } from '@/lib/worklogs/worklog-store';
import { Branch } from '@/types/auth';
import { syncWorklogToFirestore } from '@/lib/firebase/firebase-admin';
import { upsertWorklog, appendBranchDailyWorklog } from '@/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

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

    // 1. Dual persistence: Sync to Firebase Firestore
    try {
      await syncWorklogToFirestore({
        id: entry.id,
        userId: entry.userId,
        userName: entry.userName,
        userRole: entry.userRole,
        branch: entry.branch,
        date: entry.date,
        loginTime: entry.loginTime || '09:00 AM',
        logoutTime: entry.logoutTime || '06:00 PM',
        plannedTasks: entry.plannedTasks,
        completedTasks: entry.completedTasks,
        attendanceStatus: entry.attendanceStatus,
        hoursLogged: entry.hoursLogged ?? 8.5
      });
    } catch (fsErr) {
      console.warn('[Worklogs/POST] Firestore sync note:', fsErr);
    }

    // 2. Dual persistence: Sync to Google Sheets (Staff WL_<ID> tab + Master 03_Daily_Worklogs)
    try {
      const branchCode = BRANCH_NAME_TO_CODE[user.branch];
      const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;

      if (spreadsheetId) {
        // Staff personal operational subsheet WL_<ID>
        await upsertWorklog(spreadsheetId, user.id, {
          logId: entry.id,
          date: entry.date,
          loginTime: entry.loginTime || '09:00 AM',
          logoutTime: entry.logoutTime || '06:00 PM',
          tasksCompleted: completedTasks.join('; '),
          tasksPending: plannedTasks.join('; '),
          incompleteReason: '',
          totalHours: String(entry.hoursLogged ?? 8.5),
          verifiedBy: 'Pending'
        });

        // Master 03_Daily_Worklogs
        await appendBranchDailyWorklog(spreadsheetId, {
          logId: entry.id,
          staffId: user.id,
          staffName: user.name,
          role: user.role,
          branchId: branchCode,
          date: entry.date,
          loginTime: entry.loginTime || '09:00 AM',
          logoutTime: entry.logoutTime || '06:00 PM',
          tasksCompleted: completedTasks.join('; '),
          tasksPending: plannedTasks.join('; '),
          totalHours: entry.hoursLogged ?? 8.5
        });
      }
    } catch (sheetErr) {
      console.warn('[Worklogs/POST] Google Sheets sync note:', sheetErr);
    }

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save work log';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
