import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreUserByIdentifier } from '@/lib/firebase/firebase-admin';
import { setSessionCookie } from '@/lib/auth/session';
import { checkLoginRateLimit } from '@/lib/auth/login-rate-limit';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import type { User } from '@/types/auth';

export const dynamic = 'force-dynamic';
const INVALID_CREDENTIALS = 'Invalid email/mobile or password.';

function hasValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === 'production') return false;
  const configuredOrigin = appUrl ? new URL(appUrl).origin : new URL(request.url).origin;
  return origin === configuredOrigin;
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 16_384) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    const { identifier, password } = body as { identifier?: unknown; password?: unknown };
    if (typeof identifier !== 'string' || identifier.trim().length < 3 || identifier.length > 254 ||
        typeof password !== 'string' || password.length < 1 || password.length > 1024) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const clientAddress = forwarded.split(',')[0].trim().slice(0, 100) || 'unknown';
    if (!await checkLoginRateLimit(identifier, clientAddress)) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 429, headers: { 'Retry-After': '900' } });
    }

    // 1. Authoritative lookup from Cloud Firestore users collection
    let profile = await getFirestoreUserByIdentifier(identifier.trim());

    // 2. Fallback to in-memory user-store if Firestore is unreachable
    if (!profile) {
      const { findUserByIdentifier } = await import('@/lib/auth/user-store');
      profile = findUserByIdentifier(identifier.trim()) as any;
    }

    if (!profile || !profile.email) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    if (profile.status === 'disabled' || profile.status === 'rejected') {
      return NextResponse.json({ error: 'This account is not active.' }, { status: 403 });
    }

    // 3. Verify password
    let check = { valid: false, needsUpgrade: false };
    if (profile.passwordHash) {
      check = verifyPassword(password, profile.passwordHash);
    }
    if (!check.valid && (profile as any).password) {
      check = verifyPassword(password, (profile as any).password);
    }

    if (!check.valid) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // 4. Upgrade plain-text password to scrypt hash seamlessly
    if (check.needsUpgrade) {
      try {
        const newHash = hashPassword(password);
        const { syncUserToFirestore } = await import('@/lib/firebase/firebase-admin');
        await syncUserToFirestore({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          mobile: profile.mobile,
          role: profile.role,
          status: profile.status,
          branch: profile.branch,
          passwordHash: newHash,
          createdAt: profile.createdAt,
        });
      } catch (upgradeErr) {
        console.warn('[Login] Password auto-upgrade warning:', upgradeErr);
      }
    }

    // 5. Construct safe user profile without credentials
    const safeUser: User = {
      id: profile.id,
      uid: profile.uid || profile.id,
      name: profile.name,
      email: profile.email,
      mobile: profile.mobile,
      role: profile.role,
      status: profile.status,
      branch: profile.branch,
      specialization: profile.specialization,
      specializations: profile.specializations,
      majorSpecialization: profile.majorSpecialization,
      additionalSpecializations: profile.additionalSpecializations,
      startMonthYear: profile.startMonthYear,
      startDate: profile.startDate,
      endDate: profile.endDate,
      createdAt: profile.createdAt,
    };

    // 6. Set signed session cookie
    await setSessionCookie(safeUser);

    // 7. Non-blocking audit log
    import('@/lib/audit/audit-service').then(({ logAuditEvent }) => {
      logAuditEvent({
        userId: safeUser.id,
        userName: safeUser.name,
        role: safeUser.role,
        action: 'AUTH_LOGIN',
        module: 'AUTH',
        recordId: safeUser.id,
        branch: safeUser.branch,
        newValue: 'Logged In',
        ipAddress: clientAddress,
      }).catch(() => {});
    }).catch(() => {});

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('[Login] Unexpected error during authentication:', error);
    return NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 503 });
  }
}
