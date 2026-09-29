import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { isSameOriginRequest } from '@/lib/api/request-security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  await clearSessionCookie();
  return NextResponse.json({ success: true, message: 'Logged out successfully' });
}
