import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession({ allowPending: true });
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: session.user });
}
