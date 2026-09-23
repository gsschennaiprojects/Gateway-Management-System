import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth/session';
import { syncAttendanceToFirestore } from '@/lib/firebase/firebase-admin';
import { appendAttendanceRecord } from '@/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export async function POST() {
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
          await appendAttendanceRecord(spreadsheetId, [
            attId,
            todayStr,
            dayStr,
            user.id,
            user.name,
            user.role,
            '-',
            timeStr,
            '0',
            'Logged Out',
            'Web App Logout',
            now.toISOString()
          ]);
        }
      } catch (sheetErr) {
        console.warn('[Logout] Attendance Sheets sync note:', sheetErr);
      }
    }
  } catch (e) {
    console.warn('[Logout] Post-processing note:', e);
  }

  await clearSessionCookie();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
