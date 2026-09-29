import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreUserByIdentifier } from '@/lib/firebase/firebase-admin';
import { checkLoginRateLimit } from '@/lib/auth/login-rate-limit';

export const dynamic = 'force-dynamic';
const GENERIC_MESSAGE = 'If an eligible account matches that identifier, a password reset email will be sent.';

function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === 'production') return false;
  return !!origin && origin === (appUrl ? new URL(appUrl).origin : new URL(request.url).origin);
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const body: unknown = await request.json();
    const identifier = body && typeof body === 'object' ? (body as { identifier?: unknown }).identifier : null;
    if (typeof identifier !== 'string' || identifier.trim().length < 3 || identifier.length > 254) return NextResponse.json({ error: 'Enter a valid email or mobile number.' }, { status: 400 });
    const address = (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 100);
    if (!await checkLoginRateLimit(`password-reset:${identifier}`, address)) return NextResponse.json({ error: 'Please wait before requesting another reset email.' }, { status: 429, headers: { 'Retry-After': '900' } });
    const user = await getFirestoreUserByIdentifier(identifier.trim());
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });
    if (user?.email) {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: user.email }), cache: 'no-store',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
        if (result.error?.message !== 'EMAIL_NOT_FOUND') throw new Error('Reset provider unavailable.');
      }
    }
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch {
    return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });
  }
}
