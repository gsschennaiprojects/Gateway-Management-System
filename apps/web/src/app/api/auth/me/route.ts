import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { findUserById, stripSensitive } from '@/lib/auth/user-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // 1. Refresh user state from in-memory cache or direct from Firestore
    let freshUser = findUserById(session.user.id);
    if (!freshUser) {
      try {
        const { getFirestoreUserById } = await import('@/lib/firebase/firebase-admin');
        freshUser = await getFirestoreUserById(session.user.id);
      } catch (fsErr) {
        console.warn('[Me] Firestore lookup note:', fsErr);
      }
    }

    // 2. If still not found, fallback to session's own verified claims rather than destroying the login session!
    if (!freshUser) {
      return NextResponse.json({ user: session.user });
    }

    return NextResponse.json({ user: stripSensitive(freshUser) });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
