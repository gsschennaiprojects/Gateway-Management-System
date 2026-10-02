import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreUserById } from '@/lib/firebase/firebase-admin';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import type { User, ShiftTiming } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const session = await getSession({ allowPending: true });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  if (hasOversizedBody(request, 16_384)) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid profile data.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const targetUserId = typeof input.userId === 'string' && input.userId.trim() ? input.userId.trim() : session.user.id;

    // Only Super Admin, Admin, and HR can edit other users' profiles
    const isSelf = targetUserId === session.user.id || targetUserId === session.user.employeeId;
    const canManageOthers = ['superadmin', 'admin', 'hr'].includes(session.user.role);

    if (!isSelf && !canManageOthers) {
      return NextResponse.json({ error: 'Forbidden: You cannot modify other users profiles.' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    // 1. Full Name
    if (typeof input.name === 'string') {
      const trimmed = input.name.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return NextResponse.json({ error: 'Name must be between 2 and 100 characters.' }, { status: 400 });
      }
      updates.name = trimmed;
    }

    // 2. Mobile
    if (typeof input.mobile === 'string') {
      const cleanPhone = input.mobile.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        updates.mobile = `+91${cleanPhone.slice(-10)}`;
      }
    }

    // 3. Gender
    if (typeof input.gender === 'string') {
      const g = input.gender.trim().toLowerCase();
      if (['male', 'female', 'other'].includes(g)) {
        updates.gender = g;
      }
    }

    // 4. Date of Birth (DOB)
    if (typeof input.dob === 'string') {
      const dobVal = input.dob.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dobVal) || dobVal === '') {
        updates.dob = dobVal;
      }
    }

    // 5. Date of Joining (DOJ)
    if (typeof input.doj === 'string' || typeof input.dateOfJoining === 'string') {
      const dojVal = String(input.doj || input.dateOfJoining || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dojVal) || dojVal === '') {
        updates.doj = dojVal;
        updates.dateOfJoining = dojVal;
      }
    }

    // 6. Avatar URL
    if (typeof input.avatarUrl === 'string') {
      updates.avatarUrl = input.avatarUrl.trim();
    }

    // 7. Recovery Email
    if (typeof input.recoveryEmail === 'string') {
      const rec = input.recoveryEmail.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec) || rec === '') {
        updates.recoveryEmail = rec;
      }
    }

    // 8. Shift Timing (Entry Timing & Exit Timing)
    // STRICT RULE: ONLY editable by admin, superadmin, and hr
    const isElevatedRole = ['superadmin', 'admin', 'hr'].includes(session.user.role);
    if (input.entryTime !== undefined || input.exitTime !== undefined || input.shiftTiming !== undefined) {
      if (!isElevatedRole) {
        return NextResponse.json({
          error: 'Shift timing can only be configured by Branch Admin, HR, or Super Admin.',
        }, { status: 403 });
      }

      let entry = typeof input.entryTime === 'string' ? input.entryTime.trim() : '';
      let exit = typeof input.exitTime === 'string' ? input.exitTime.trim() : '';

      if (input.shiftTiming && typeof input.shiftTiming === 'object') {
        const st = input.shiftTiming as Record<string, unknown>;
        if (typeof st.entryTime === 'string') entry = st.entryTime.trim();
        if (typeof st.exitTime === 'string') exit = st.exitTime.trim();
      }

      if (entry) updates.entryTime = entry;
      if (exit) updates.exitTime = exit;
      if (entry || exit) {
        updates.shiftTiming = {
          entryTime: entry || session.user.entryTime || '09:30 AM',
          exitTime: exit || session.user.exitTime || '06:30 PM',
        } as ShiftTiming;
      }
    }

    const now = new Date().toISOString();
    updates.updatedAt = now;

    // Apply updates to database or fallback store
    const db = getAdminFirestore();
    let updatedUser: User;

    if (db) {
      const userRef = db.collection('users').doc(targetUserId);
      const snap = await userRef.get();
      if (!snap.exists) {
        // Try searching by employeeId
        const byEmp = await db.collection('users').where('employeeId', '==', targetUserId).limit(1).get();
        if (byEmp.empty) {
          return NextResponse.json({ error: 'User profile not found in database.' }, { status: 404 });
        }
        await byEmp.docs[0].ref.update(updates);
        const refreshed = await byEmp.docs[0].ref.get();
        const d = refreshed.data() || {};
        updatedUser = {
          ...session.user,
          ...d,
          id: refreshed.id,
          employeeId: (d.employeeId as string) || refreshed.id,
        } as User;
      } else {
        await userRef.update(updates);
        const refreshed = await userRef.get();
        const d = refreshed.data() || {};
        updatedUser = {
          ...session.user,
          ...d,
          id: refreshed.id,
          employeeId: (d.employeeId as string) || refreshed.id,
        } as User;
      }
    } else {
      // In-memory fallback
      const { findUserById, upsertServerUser } = await import('@/lib/auth/user-store');
      const memUser = findUserById(targetUserId);
      if (!memUser) {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
      }
      const merged = { ...memUser, ...updates };
      upsertServerUser(merged as any);
      updatedUser = merged as unknown as User;
    }

    // If updating self, refresh session cookie
    if (isSelf) {
      await setSessionCookie(updatedUser);
    }

    return NextResponse.json({
      success: true,
      message: 'Profile details successfully updated.',
      user: updatedUser,
    });
  } catch (err) {
    console.error('[api/auth/profile] Update error:', err);
    return NextResponse.json({ error: 'Profile update could not be completed.' }, { status: 500 });
  }
}
