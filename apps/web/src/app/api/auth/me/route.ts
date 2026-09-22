import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { findUserById, stripSensitive } from '@/lib/auth/user-store';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Refresh user state from store in case status or role changed
    const freshUser = findUserById(session.user.id);
    if (!freshUser) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user: stripSensitive(freshUser) });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
