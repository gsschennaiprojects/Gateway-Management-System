import { NextRequest, NextResponse } from 'next/server';
import { findUserByIdentifier, stripSensitive } from '@/lib/auth/user-store';
import { setSessionCookie } from '@/lib/auth/session';

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

    let user = findUserByIdentifier(identifier);

    // Fallback: check Firestore users collection if not in local memory
    if (!user) {
      try {
        const { getAdminFirestore } = await import('@/lib/firebase/firebase-admin');
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
