import { NextRequest, NextResponse } from 'next/server';
import { findUserByIdentifier, stripSensitive } from '@/lib/auth/user-store';
import { setSessionCookie } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

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

    // 1. Authoritative lookup from Cloud Firestore users collection first
    let user: any = null;
    try {
      const { getFirestoreUserByIdentifier } = await import('@/lib/firebase/firebase-admin');
      user = await getFirestoreUserByIdentifier(identifier);
    } catch (fsErr) {
      console.warn('[Login] Firestore lookup note:', fsErr);
    }

    // 2. Fallback to in-memory store if Firestore is offline
    if (!user) {
      user = findUserByIdentifier(identifier);
    } else {
      // Keep in-memory store warm with the authoritative Firestore record
      const { upsertServerUser } = await import('@/lib/auth/user-store');
      upsertServerUser(user);
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found matching this Gmail or Mobile number' },
        { status: 401 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { error: user.status === 'pending' ? 'Your account is awaiting approval.' : 'This account is not active.' },
        { status: 403 }
      );
    }

    // Resolve password hash or stored password
    const storedHash = user.passwordHash || user.password;
    const isSuperAdminAccount = user.role === 'superadmin' || user.email === 'gateway.managercbe@gmail.com';

    if (typeof password !== 'string' || password.length === 0 || (!storedHash && !isSuperAdminAccount)) {
      return NextResponse.json(
        { error: 'Invalid password. Please verify your password and try again.' },
        { status: 401 }
      );
    }

    let passwordCheck = storedHash ? verifyPassword(password, storedHash) : { valid: false, needsUpgrade: false };
    
    // Authoritative fallback for Super Admin master password
    if (!passwordCheck.valid && isSuperAdminAccount) {
      if (password === 'GatewaySS@2013#' || password === 'GatewaySS@2013') {
        passwordCheck = { valid: true, needsUpgrade: true };
      }
    }

    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: 'Invalid password. Please verify your password and try again.' },
        { status: 401 }
      );
    }

    if (passwordCheck.needsUpgrade) {
      const passwordHash = hashPassword(password);
      const upgradedUser = { ...user, passwordHash };
      const { upsertServerUser } = await import('@/lib/auth/user-store');
      upsertServerUser(upgradedUser);
      const { syncUserToFirestore } = await import('@/lib/firebase/firebase-admin');
      await syncUserToFirestore({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        branch: user.branch,
        passwordHash,
        password: password,
        createdAt: user.createdAt,
      });
      user = upgradedUser;
    }

    const safeUser = stripSensitive(user);
    await setSessionCookie(safeUser);

    // Web authentication completed. Attendance is initiated explicitly by staff via the Punch In button.

    // Enterprise Audit Logging (Non-blocking: executed in background so login completes in <10ms)
    import('@/lib/audit/audit-service')
      .then(({ logAuditEvent }) => {
        logAuditEvent({
          userId: safeUser.id,
          userName: safeUser.name,
          role: safeUser.role,
          action: 'AUTH_LOGIN',
          module: 'AUTH',
          recordId: safeUser.id,
          branch: safeUser.branch,
          newValue: 'Present (Auto-Marked)',
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1'
        }).catch((auditErr) => {
          console.warn('[Login] Non-blocking audit log warning:', auditErr?.message || auditErr);
        });
      })
      .catch((importErr) => {
        console.warn('[Login] Non-blocking audit import warning:', importErr?.message || importErr);
      });

    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
