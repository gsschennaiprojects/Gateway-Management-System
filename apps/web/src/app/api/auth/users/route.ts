import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth/session';
import { getAdminAuth, getAdminFirestore, getFirestoreUsers } from '@/lib/firebase/firebase-admin';
import { canDeleteUser, canManageTargetUser } from '@/lib/rbac/permissions';
import { BRANCHES, type UserRole, type UserStatus } from '@/types/auth';
import { BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export const dynamic = 'force-dynamic';

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === 'production') return false;
  const expected = appUrl ? new URL(appUrl).origin : new URL(request.url).origin;
  return origin === expected;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const users = await getFirestoreUsers();
    const { searchParams } = new URL(request.url);
    const branchFilter = searchParams.get('branch');
    const scoped = session.user.role === 'superadmin'
      ? users.filter(user => !branchFilter || ['All', 'all'].includes(branchFilter) || user.branch === branchFilter)
      : users.filter(user => user.branch === session.user.branch);
    return NextResponse.json({ users: scoped });
  } catch {
    return NextResponse.json({ error: 'User directory is temporarily unavailable.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 16_384) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  if (!['superadmin', 'admin'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (Object.hasOwn(input, 'password') || Object.hasOwn(input, 'passwordHash')) return NextResponse.json({ error: 'Use Firebase password reset to change credentials.' }, { status: 400 });
    if (typeof input.userId !== 'string' || input.userId.length > 150 || typeof input.action !== 'string') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (input.action === 'update_role' && session.user.role !== 'superadmin') return NextResponse.json({ error: 'Only Super Admin can assign roles.' }, { status: 403 });
    if (input.action === 'edit_staff' && session.user.role !== 'superadmin') return NextResponse.json({ error: 'Only Super Admin can edit staff profiles.' }, { status: 403 });
    const db = getAdminFirestore();
    const auth = getAdminAuth();
    if (!db || !auth) return NextResponse.json({ error: 'User service is unavailable.' }, { status: 503 });
    const allUsers = await getFirestoreUsers();
    const target = allUsers.find(item => item.id === input.userId || item.uid === input.userId);
    if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    const isSuperAdmin = session.user.role === 'superadmin';
    if (target.id === session.user.id || (session.uid && target.uid === session.uid)) return NextResponse.json({ error: 'Users cannot manage their own account.' }, { status: 403 });
    if (!canManageTargetUser(session.user, target)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (target.role === 'superadmin' && target.id !== session.user.id) return NextResponse.json({ error: 'Super Admin account cannot be managed here.' }, { status: 403 });
    const uid = target.uid || target.id;
    const profileRef = db.collection('users').doc(uid);
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };
    let nextRole: UserRole = target.role;
    let nextStatus: UserStatus = target.status;

    if (input.action === 'update_status') {
      if (!['active', 'rejected'].includes(String(input.status))) return NextResponse.json({ error: 'Only approval or rejection is allowed.' }, { status: 400 });
      if (!isSuperAdmin && !['employee', 'intern'].includes(target.role)) return NextResponse.json({ error: 'Only Super Admin can manage elevated accounts.' }, { status: 403 });
      nextStatus = input.status as UserStatus;
      updates.status = nextStatus;
    } else if (input.action === 'update_role') {
      if (!isSuperAdmin) return NextResponse.json({ error: 'Only Super Admin can assign roles.' }, { status: 403 });
      if (!['superadmin', 'admin', 'hr', 'employee', 'intern'].includes(String(input.role))) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
      nextRole = input.role as UserRole;
      updates.role = nextRole;
    } else if (input.action === 'edit_staff') {
      if (!isSuperAdmin) return NextResponse.json({ error: 'Only Super Admin can edit staff profiles.' }, { status: 403 });
      const fields: Array<[string, (value: unknown) => boolean]> = [
        ['name', value => typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 100],
        ['email', value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)],
        ['mobile', value => typeof value === 'string' && value.replace(/\D/g, '').length >= 10],
        ['branch', value => BRANCHES.includes(value as typeof BRANCHES[number])],
        ['specialization', value => typeof value === 'string' && value.length <= 200],
      ];
      for (const [field, valid] of fields) {
        if (input[field] === undefined) continue;
        if (!valid(input[field])) return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
        updates[field] = field === 'email' ? String(input[field]).trim().toLowerCase()
          : field === 'mobile' ? `+91${String(input[field]).replace(/\D/g, '').slice(-10)}`
          : typeof input[field] === 'string' ? input[field].trim() : input[field];
      }
      if (input.role !== undefined) {
        if (!['superadmin', 'admin', 'hr', 'employee', 'intern'].includes(String(input.role))) return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
        nextRole = input.role as UserRole; updates.role = nextRole;
      }
      if (input.status !== undefined) {
        if (!['active', 'pending', 'rejected', 'disabled'].includes(String(input.status))) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
        nextStatus = input.status as UserStatus; updates.status = nextStatus;
      }
      if (typeof updates.branch === 'string') updates.branchId = BRANCH_NAME_TO_CODE[String(updates.branch)] || String(updates.branch).toUpperCase();
    } else if (input.action === 'delete') {
      if (!canDeleteUser(session.user, target)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      nextStatus = 'disabled'; updates.status = nextStatus; updates.disabledAt = now;
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const previousMobile = `+91${target.mobile.replace(/\D/g, '').slice(-10)}`;
    const nextMobile = typeof updates.mobile === 'string' ? updates.mobile : previousMobile;
    const previousPhoneRef = db.collection('phoneIndex').doc(previousMobile);
    const nextPhoneRef = db.collection('phoneIndex').doc(nextMobile);
    const jobRef = db.collection('projection_jobs').doc(`staff:${uid}:${randomUUID()}`);
    const auditId = `audit_${randomUUID()}`;
    const auditRef = db.collection('audit_logs').doc(auditId);
    const auditProjectionRef = db.collection('projection_jobs').doc(`audit:${auditId}`);
    const branch = String(updates.branch || target.branch);
    const branchId = BRANCH_NAME_TO_CODE[branch] || branch.toUpperCase();
    const authBefore = await auth.getUser(uid);
    const authUpdates = {
      ...(updates.email ? { email: String(updates.email) } : {}),
      ...(updates.mobile ? { phoneNumber: String(updates.mobile) } : {}),
      ...(updates.status ? { disabled: nextStatus !== 'active' } : {}),
    };
    if (Object.keys(authUpdates).length) await auth.updateUser(uid, authUpdates);
    try {
      await db.runTransaction(async transaction => {
        const current = await transaction.get(profileRef);
        if (!current.exists) throw new Error('USER_NOT_FOUND');
        const nextPhone = nextMobile !== previousMobile ? await transaction.get(nextPhoneRef) : null;
        const previousPhone = nextMobile !== previousMobile ? await transaction.get(previousPhoneRef) : null;
        if (nextPhone?.exists && nextPhone.data()?.uid !== uid) throw new Error('PHONE_IN_USE');
        transaction.update(profileRef, updates);
        if (nextMobile !== previousMobile) {
          if (previousPhone?.exists && previousPhone.data()?.uid === uid) transaction.delete(previousPhoneRef);
          transaction.set(nextPhoneRef, { uid, employeeId: target.id, updatedAt: now });
        }
        transaction.create(jobRef, { id: jobRef.id, type: 'staff.upsert', entityId: uid, branchId, state: 'pending', attempts: 0, createdAt: now });
        transaction.create(auditRef, {
          id: auditId, timestamp: now, createdAt: now,
          userId: session.user.id, userName: session.user.name, role: session.user.role,
          action: `USER_${String(input.action).toUpperCase()}`, module: 'STAFF', recordId: target.id, branch,
          newValue: JSON.stringify({ role: nextRole, status: nextStatus, branch }),
        });
        transaction.create(auditProjectionRef, { id: auditProjectionRef.id, type: 'audit.project', entityId: auditId, branchId, state: 'pending', attempts: 0, createdAt: now });
      });
    } catch (error) {
      if (Object.keys(authUpdates).length) {
        await auth.updateUser(uid, {
          email: authBefore.email || undefined,
          phoneNumber: authBefore.phoneNumber || null,
          disabled: authBefore.disabled,
        }).catch(rollbackError => console.error('[AuthUsers] Firebase Auth compensation failed.', rollbackError));
      }
      throw error;
    }
    return NextResponse.json({ success: true, user: { ...target, ...updates, role: nextRole, status: nextStatus } });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (error instanceof Error && error.message === 'PHONE_IN_USE') return NextResponse.json({ error: 'That mobile number is already assigned to an account.' }, { status: 409 });
    return NextResponse.json({ error: 'User update could not be completed.' }, { status: 503 });
  }
}
