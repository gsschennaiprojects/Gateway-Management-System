import { NextResponse } from 'next/server';
import { getSession, setSessionCookie } from '@/lib/auth/session';
import type { User } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession({ allowPending: true });
  if (!session?.user) return NextResponse.json({ user: null }, { status: 401 });

  let currentUser: User = session.user;

  // Real-time lookup to catch any status updates (e.g. Super Admin approval)
  try {
    const { getFirestoreUserById } = await import('@/lib/firebase/firebase-admin');
    const dbUser = await getFirestoreUserById(session.user.id || (session as unknown as { uid?: string }).uid || '');
    if (dbUser) {
      currentUser = {
        ...session.user,
        id: dbUser.id || session.user.id,
        employeeId: dbUser.employeeId || session.user.employeeId,
        name: dbUser.name || session.user.name,
        email: dbUser.email || session.user.email,
        mobile: dbUser.mobile || session.user.mobile,
        branch: (dbUser.branch as User['branch']) || session.user.branch,
        role: (dbUser.role as User['role']) || session.user.role,
        status: dbUser.status as User['status'],
        specialization: dbUser.specialization || session.user.specialization,
        specializations: dbUser.specializations || session.user.specializations,
        majorSpecialization: dbUser.majorSpecialization || session.user.majorSpecialization,
        gender: dbUser.gender || session.user.gender,
        dob: dbUser.dob || session.user.dob,
        doj: dbUser.doj || session.user.doj || dbUser.dateOfJoining || session.user.dateOfJoining,
        dateOfJoining: dbUser.dateOfJoining || session.user.dateOfJoining || dbUser.doj || session.user.doj,
        entryTime: dbUser.entryTime || session.user.entryTime || '09:30 AM',
        exitTime: dbUser.exitTime || session.user.exitTime || '06:30 PM',
        shiftTiming: dbUser.shiftTiming || session.user.shiftTiming || {
          entryTime: dbUser.entryTime || session.user.entryTime || '09:30 AM',
          exitTime: dbUser.exitTime || session.user.exitTime || '06:30 PM',
        },
      };
    } else {
      const { findUserById } = await import('@/lib/auth/user-store');
      const memUser = findUserById(session.user.id);
      if (memUser) {
        currentUser = {
          ...session.user,
          id: memUser.id || session.user.id,
          employeeId: memUser.employeeId || session.user.employeeId,
          name: memUser.name,
          email: memUser.email,
          mobile: memUser.mobile,
          branch: memUser.branch,
          role: memUser.role,
          status: memUser.status,
          specialization: memUser.specialization,
          specializations: memUser.specializations,
          majorSpecialization: memUser.majorSpecialization,
          gender: memUser.gender || session.user.gender,
          dob: memUser.dob || session.user.dob,
          doj: memUser.doj || session.user.doj || memUser.dateOfJoining || session.user.dateOfJoining,
          dateOfJoining: memUser.dateOfJoining || session.user.dateOfJoining || memUser.doj || session.user.doj,
          entryTime: memUser.entryTime || session.user.entryTime || '09:30 AM',
          exitTime: memUser.exitTime || session.user.exitTime || '06:30 PM',
          shiftTiming: memUser.shiftTiming || session.user.shiftTiming || {
            entryTime: memUser.entryTime || session.user.entryTime || '09:30 AM',
            exitTime: memUser.exitTime || session.user.exitTime || '06:30 PM',
          },
        };
      }
    }
  } catch (err) {
    console.warn('[api/auth/me] Database check error:', err);
  }

  // If status changed (e.g. pending -> active) or role updated, refresh session cookie
  if (currentUser.status !== session.user.status || currentUser.role !== session.user.role) {
    try {
      await setSessionCookie(currentUser);
    } catch (cookieErr) {
      console.warn('[api/auth/me] Error refreshing session cookie:', cookieErr);
    }
  }

  return NextResponse.json({ user: currentUser });
}
