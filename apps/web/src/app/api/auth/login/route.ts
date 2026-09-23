import { NextRequest, NextResponse } from 'next/server';
import { findUserByIdentifier, stripSensitive } from '@/lib/auth/user-store';
import { setSessionCookie } from '@/lib/auth/session';
import { getAdminFirestore, syncAttendanceToFirestore } from '@/lib/firebase/firebase-admin';
import { appendAttendanceRecord } from '@/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Please enter your Gmail address or 10-digit Mobile number' },
        { status: 400 }
      );
    }

    let user = findUserByIdentifier(identifier);

    // Fallback: check Firestore users collection if not in local memory
    if (!user) {
      try {
        const db = getAdminFirestore();
        if (db) {
          const cleanId = identifier.trim().toLowerCase();
          const digitsOnly = identifier.replace(/\D/g, '');
          
          let snap = await db.collection('users').where('email', '==', cleanId).limit(1).get();
          if (snap.empty && digitsOnly.length >= 10) {
            snap = await db.collection('users').where('mobile', '==', digitsOnly.slice(-10)).limit(1).get();
          }
          if (snap.empty) {
            snap = await db.collection('users').where('gmail', '==', cleanId).limit(1).get();
          }

          if (!snap.empty) {
            const docData = snap.docs[0].data();
            user = {
              id: snap.docs[0].id,
              name: docData.name || 'Staff Member',
              email: docData.email || docData.gmail || cleanId,
              mobile: docData.mobile || '',
              role: (docData.role?.toLowerCase() as any) || 'intern',
              status: (docData.status as any) || 'active',
              branch: docData.branch || 'Coimbatore',
              specialization: docData.specialization || 'Operations',
              specializations: docData.specializations || [],
              createdAt: docData.createdAt || new Date().toISOString(),
              passwordHash: docData.password || undefined
            };
          }
        }
      } catch (fsErr) {
        console.warn('[Login] Firestore lookup note:', fsErr);
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found matching this Gmail or Mobile number' },
        { status: 401 }
      );
    }

    // In simple auth, if a password is provided, check it
    if (password && user.passwordHash && user.passwordHash !== password) {
      return NextResponse.json(
        { error: 'Invalid password. Please verify your password and try again.' },
        { status: 401 }
      );
    }

    const safeUser = stripSensitive(user);
    await setSessionCookie(safeUser);

    // Record login attendance event to Firestore and Google Sheets
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'short' });
    const attId = `ATT_${safeUser.id}_${todayStr.replace(/-/g, '')}`;

    try {
      await syncAttendanceToFirestore({
        id: attId,
        userId: safeUser.id,
        userName: safeUser.name,
        role: safeUser.role,
        branch: safeUser.branch,
        date: todayStr,
        punchIn: timeStr,
        status: 'Present'
      });
    } catch (fsAttErr) {
      console.warn('[Login] Attendance firestore sync note:', fsAttErr);
    }

    try {
      const branchCode = BRANCH_NAME_TO_CODE[safeUser.branch];
      const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
      if (spreadsheetId) {
        // Attendance headers: ['Attendance_ID', 'Date', 'Day', 'Staff_ID', 'Staff_Name', 'Role', 'Check_In', 'Check_Out', 'Total_Hours', 'Status', 'Marked_By', 'Timestamp']
        await appendAttendanceRecord(spreadsheetId, [
          attId,
          todayStr,
          dayStr,
          safeUser.id,
          safeUser.name,
          safeUser.role,
          timeStr,
          '-',
          '0',
          'Present',
          'Web App Login',
          now.toISOString()
        ]);
      }
    } catch (sheetAttErr) {
      console.warn('[Login] Attendance sheets sync note:', sheetAttErr);
    }

    return NextResponse.json({
      success: true,
      user: safeUser
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
