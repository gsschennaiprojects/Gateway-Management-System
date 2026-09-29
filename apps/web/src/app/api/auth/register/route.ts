import { NextRequest, NextResponse } from 'next/server';
import { BRANCHES, type UserRole } from '@/types/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/firebase-admin';

export const dynamic = 'force-dynamic';

function validOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === 'production') return false;
  const expected = appUrl ? new URL(appUrl).origin : new URL(request.url).origin;
  return origin === expected;
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 16_384) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  let uid: string | undefined;
  let auth: ReturnType<typeof getAdminAuth> = null;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid registration details.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const mobile = typeof input.mobile === 'string' ? input.mobile.replace(/\D/g, '').slice(-10) : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const branch = input.branch;
    const requestedRole = input.requestedRole;
    const specialization = typeof input.specialization === 'string' ? input.specialization.trim() : '';
    const specializations = Array.isArray(input.specializations)
      ? input.specializations.filter((value): value is string => typeof value === 'string').map(value => value.trim()).filter(Boolean)
      : specialization ? [specialization] : [];

    if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        mobile.length !== 10 || !BRANCHES.includes(branch as typeof BRANCHES[number]) ||
        !['employee', 'intern'].includes(String(requestedRole)) || password.length < 8 || password.length > 128 ||
        specializations.length === 0 || specializations.length > 10) {
      return NextResponse.json({ error: 'Please provide valid registration details.' }, { status: 400 });
    }
    const db = getAdminFirestore();
    auth = getAdminAuth();
    if (!db || !auth) return NextResponse.json({ error: 'Registration service is unavailable.' }, { status: 503 });

    const role = requestedRole as Extract<UserRole, 'employee' | 'intern'>;
    const phoneKey = `+91${mobile}`;
    const newAuthUser = await auth.createUser({ email, password, displayName: name, disabled: false });
    uid = newAuthUser.uid;
    const now = new Date().toISOString();
    const employeeId = `GSS_${role === 'intern' ? 'INT' : 'EMP'}_${uid}`;
    const userRef = db.collection('users').doc(uid);
    const phoneRef = db.collection('phoneIndex').doc(phoneKey);
    const projectionRef = db.collection('projection_jobs').doc(`staff:${uid}:created`);

    try {
      await db.runTransaction(async transaction => {
        const existingPhone = await transaction.get(phoneRef);
        if (existingPhone.exists) throw new Error('DUPLICATE_PHONE');
        transaction.create(userRef, {
          uid, employeeId, name, email, gmail: email, mobile: phoneKey, role, status: 'pending',
          branch: branch as string, branchId: String(branch).toUpperCase(), specialization: specializations[0],
          specializations, startMonthYear: typeof input.startMonthYear === 'string' ? input.startMonthYear : now.slice(0, 7),
          ...(typeof input.startDate === 'string' ? { startDate: input.startDate } : {}),
          ...(typeof input.endDate === 'string' ? { endDate: input.endDate } : {}), createdAt: now, updatedAt: now,
        });
        transaction.create(phoneRef, { uid, employeeId, createdAt: now });
        transaction.create(projectionRef, { id: projectionRef.id, type: 'staff.upsert', entityId: uid, branchId: String(branch).toUpperCase(), state: 'pending', attempts: 0, createdAt: now });
      });
    } catch (error) {
      await auth.deleteUser(uid).catch(() => undefined);
      uid = undefined;
      if (error instanceof Error && error.message === 'DUPLICATE_PHONE') return NextResponse.json({ error: 'An account with this email or mobile already exists.' }, { status: 409 });
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Your account is registered and awaiting approval.', user: {
      id: employeeId, name, email, mobile: phoneKey, role, status: 'pending', branch, specialization: specializations[0], createdAt: now,
    } }, { status: 201 });
  } catch {
    if (uid && auth) await auth.deleteUser(uid).catch(() => undefined);
    return NextResponse.json({ error: 'Registration service is unavailable. Please try again.' }, { status: 503 });
  }
}
