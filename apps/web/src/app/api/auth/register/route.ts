import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { BRANCHES, type UserRole } from '@/types/auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/firebase-admin';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (hasOversizedBody(request, 16_384)) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  let uid: string | undefined;
  let auth: ReturnType<typeof getAdminAuth> = null;
  let createdInAuth = false;

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

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Please enter a valid full name (2-100 characters).' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (mobile.length !== 10) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number.' }, { status: 400 });
    }
    if (!BRANCHES.includes(branch as typeof BRANCHES[number])) {
      return NextResponse.json({ error: 'Please select a valid branch location.' }, { status: 400 });
    }
    if (!['admin', 'hr', 'employee', 'intern'].includes(String(requestedRole))) {
      return NextResponse.json({ error: 'Please select a valid requested role.' }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Password must be between 8 and 128 characters.' }, { status: 400 });
    }
    if (specializations.length === 0 || specializations.length > 10) {
      return NextResponse.json({ error: 'Please select at least one domain specialization.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    auth = getAdminAuth();
    if (!db) return NextResponse.json({ error: 'Registration service is unavailable.' }, { status: 503 });

    const role = requestedRole as Extract<UserRole, 'admin' | 'hr' | 'employee' | 'intern'>;
    const phoneKey = `+91${mobile}`;

    // Attempt to register in Firebase Auth if available, with graceful fallback to generated UID
    if (auth) {
      try {
        const newAuthUser = await auth.createUser({ email, password, displayName: name, disabled: false });
        uid = newAuthUser.uid;
        createdInAuth = true;
      } catch (authErr) {
        console.warn('[Register] Firebase Auth createUser note (using generated UID):', authErr);
      }
    }
    if (!uid) {
      uid = `usr_${randomUUID()}`;
    }

    const now = new Date().toISOString();
    const rolePrefix = role === 'intern' ? 'INT' : role === 'hr' ? 'HR' : role === 'admin' ? 'ADM' : 'EMP';
    const employeeId = `GSS_${rolePrefix}_${uid}`;
    const userRef = db.collection('users').doc(uid);
    const phoneRef = db.collection('phoneIndex').doc(phoneKey);
    const projectionRef = db.collection('projection_jobs').doc(`staff:${uid}:created`);
    const passwordHash = hashPassword(password);

    try {
      await db.runTransaction(async transaction => {
        const existingPhone = await transaction.get(phoneRef);
        if (existingPhone.exists) throw new Error('DUPLICATE_PHONE');
        transaction.create(userRef, {
          uid, employeeId, name, email, gmail: email, mobile: phoneKey, role, status: 'pending',
          branch: branch as string, branchId: String(branch).toUpperCase(), specialization: specializations[0],
          majorSpecialization: specializations[0],
          additionalSpecializations: specializations.slice(1),
          specializations, startMonthYear: typeof input.startMonthYear === 'string' ? input.startMonthYear : now.slice(0, 7),
          password,
          passwordHash,
          ...(typeof input.startDate === 'string' ? { startDate: input.startDate } : {}),
          ...(typeof input.endDate === 'string' ? { endDate: input.endDate } : {}), createdAt: now, updatedAt: now,
        });
        transaction.create(phoneRef, { uid, employeeId, createdAt: now });
        transaction.create(projectionRef, { id: projectionRef.id, type: 'staff.upsert', entityId: uid, branchId: String(branch).toUpperCase(), state: 'pending', attempts: 0, createdAt: now });
      });
    } catch (error) {
      if (createdInAuth && uid && auth) await auth.deleteUser(uid).catch(() => undefined);
      uid = undefined;
      if (error instanceof Error && error.message === 'DUPLICATE_PHONE') return NextResponse.json({ error: 'An account with this email or mobile already exists.' }, { status: 409 });
      throw error;
    }

    // Mirror to in-memory fallback store
    try {
      const { upsertServerUser } = await import('@/lib/auth/user-store');
      upsertServerUser({
        id: employeeId,
        uid,
        name,
        email,
        mobile: phoneKey,
        role,
        status: 'pending',
        branch: branch as typeof BRANCHES[number],
        specialization: specializations[0],
        majorSpecialization: specializations[0],
        additionalSpecializations: specializations.slice(1),
        specializations,
        startMonthYear: typeof input.startMonthYear === 'string' ? input.startMonthYear : now.slice(0, 7),
        password,
        passwordHash,
        createdAt: now,
      });
    } catch {
      // In-memory cache non-blocking
    }

    const safeUser = {
      id: employeeId,
      uid,
      name,
      email,
      mobile: phoneKey,
      role,
      status: 'pending' as const,
      branch: branch as typeof BRANCHES[number],
      specialization: specializations[0],
      createdAt: now,
    };

    // Set authenticated pending session cookie
    try {
      const { setSessionCookie } = await import('@/lib/auth/session');
      await setSessionCookie(safeUser);
    } catch {
      // Non-blocking session cookie
    }

    return NextResponse.json({
      success: true,
      message: 'Your account is registered and awaiting approval.',
      user: safeUser,
    }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Register API Error]:', err);
    if (createdInAuth && uid && auth) await auth.deleteUser(uid).catch(() => undefined);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Registration service is unavailable. Details: ${detail}` }, { status: 503 });
  }
}
