import { NextRequest, NextResponse } from 'next/server';
import { createUser, stripSensitive, findUserByIdentifier } from '@/lib/auth/user-store';
import { setSessionCookie } from '@/lib/auth/session';
import { RegisterPayload, BRANCHES, SPECIALIZATIONS } from '@/types/auth';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let requestEmail = '';
  try {
    const body = await req.json();
    const {
      name,
      email,
      mobile,
      requestedRole,
      branch,
      specialization,
      specializations,
      startMonthYear,
      startDate,
      endDate,
      password
    } = body as RegisterPayload;
    requestEmail = email?.trim()?.toLowerCase() || '';

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }

    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanMobile = mobile?.replace(/\D/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      return NextResponse.json({ error: 'Valid 10-digit mobile number is required' }, { status: 400 });
    }

    if (!branch || !BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: 'Please select a valid branch (Coimbatore, Chennai, Madurai, or Erode)' },
        { status: 400 }
      );
    }

    const domainsList = Array.isArray(specializations) && specializations.length > 0
      ? specializations
      : specialization?.trim()
      ? [specialization.trim()]
      : [];

    if (domainsList.length === 0) {
      return NextResponse.json(
        { error: 'Please select or type at least one domain specialization' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = cleanMobile.slice(-10);

    // 1. Check in-memory user store
    const existingInMem = findUserByIdentifier(cleanEmail) || findUserByIdentifier(cleanPhone);
    if (existingInMem) {
      return NextResponse.json({
        error: 'An account with this Gmail address already exists. Redirecting to sign in...',
        alreadyExists: true,
        email: cleanEmail
      }, { status: 409 });
    }

    // 2. Check Firestore collection directly for email/gmail/mobile
    try {
      const { getAdminFirestore } = await import('@/lib/firebase/firebase-admin');
      const db = getAdminFirestore();
      if (db) {
        let snap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
        if (snap.empty) {
          snap = await db.collection('users').where('gmail', '==', cleanEmail).limit(1).get();
        }
        if (snap.empty && cleanPhone.length >= 10) {
          snap = await db.collection('users').where('mobile', '==', cleanPhone).limit(1).get();
        }
        if (!snap.empty) {
          return NextResponse.json({
            error: 'An account with this Gmail address already exists. Redirecting to sign in...',
            alreadyExists: true,
            email: cleanEmail
          }, { status: 409 });
        }
      }
    } catch (fsErr) {
      console.warn('[Register] Firestore duplicate check note:', fsErr);
    }

    const newUser = createUser({
      name,
      email: cleanEmail,
      mobile: cleanMobile,
      requestedRole: requestedRole || 'intern',
      branch,
      specialization: domainsList.join(', '),
      specializations: domainsList,
      startMonthYear: startMonthYear || new Date().toISOString().substring(0, 7),
      startDate,
      endDate,
      password
    });

    // 3. AWAIT Firestore persistence directly so serverless execution environment does not terminate before write
    try {
      const { syncUserToFirestore } = await import('@/lib/firebase/firebase-admin');
      await syncUserToFirestore({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        mobile: newUser.mobile,
        role: newUser.role,
        status: newUser.status,
        branch: newUser.branch,
        specialization: newUser.specialization,
        specializations: newUser.specializations,
        startMonthYear: newUser.startMonthYear,
        startDate: newUser.startDate,
        endDate: newUser.endDate,
        password: password,
        createdAt: newUser.createdAt
      });
    } catch (fsErr) {
      console.warn('[Register] Firestore sync note:', fsErr);
    }

    // 4. Google Sheets directory sync (with timeout protection)
    try {
      const branchCode = BRANCH_NAME_TO_CODE[newUser.branch];
      const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
      if (spreadsheetId) {
        const { upsertStaffDirectory } = await import('@/lib/sheets/sheets-service');
        await Promise.race([
          upsertStaffDirectory(spreadsheetId, {
            staffId: newUser.id,
            fullName: newUser.name,
            role: newUser.role,
            designation: newUser.specialization || newUser.role,
            department: 'Operations',
            email: newUser.email,
            mobile: newUser.mobile,
            joiningDate: newUser.startDate || new Date().toISOString().split('T')[0],
            reportingManager: 'Management',
            accountStatus: 'Pending',
            firebaseUid: newUser.id
          }),
          new Promise((resolve) => setTimeout(resolve, 3000))
        ]);
      }
    } catch (sheetErr) {
      console.warn('[Register] Google Sheets sync note:', sheetErr);
    }

    const safeUser = stripSensitive(newUser);
    // Set session cookie with the new user in 'pending' status
    await setSessionCookie(safeUser);

    return NextResponse.json({
      success: true,
      message: 'Your account has been registered and is pending approval.',
      user: safeUser
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes('already exists')) {
      return NextResponse.json({
        error: 'An account with this Gmail address already exists. Redirecting to sign in...',
        alreadyExists: true,
        email: requestEmail
      }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
