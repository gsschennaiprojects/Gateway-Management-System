import { NextRequest, NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth/session';
import { syncAttendanceToFirestore } from '@/lib/firebase/firebase-admin';
import { appendAttendanceRecord } from '@/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session?.user) {
      const user = session.user;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const dayStr = now.toLocaleDateString('en-US', { weekday: 'short' });
      const attId = `ATT_OUT_${user.id}_${todayStr.replace(/-/g, '')}`;

      try {
        await syncAttendanceToFirestore({
          id: attId,
          userId: user.id,
          userName: user.name,
          role: user.role,
          branch: user.branch,
          date: todayStr,
          punchOut: timeStr,
          status: 'Logged Out'
        });
      } catch (fsErr) {
        console.warn('[Logout] Attendance Firestore sync note:', fsErr);
      }

      try {
        const branchCode = BRANCH_NAME_TO_CODE[user.branch];
        const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
        if (spreadsheetId) {
          const { punchOutStaffAttendanceRecord } = await import('@/lib/sheets/sheets-service');
          await punchOutStaffAttendanceRecord(spreadsheetId, {
            staffId: user.id,
            staffName: user.name,
            role: user.role,
            date: todayStr,
            day: dayStr,
            checkOutTime: timeStr,
            totalHours: 8.5,
            markedBy: 'Web App Logout',
          });
        }
      } catch (sheetErr) {
        console.warn('[Logout] Attendance Sheets sync note:', sheetErr);
      }

      // Enterprise Audit Logging
      try {
        const { logAuditEvent } = await import('@/lib/audit/audit-service');
        await logAuditEvent({
          userId: user.id,
          userName: user.name,
          role: user.role,
          action: 'AUTH_LOGOUT',
          module: 'AUTH',
          recordId: user.id,
          branch: user.branch,
          newValue: 'Logged Out',
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1'
        });
      } catch (auditErr) {
        console.warn('[Logout] Non-blocking audit log warning:', auditErr);
      }
    }
  } catch (e) {
    console.warn('[Logout] Post-processing note:', e);
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
