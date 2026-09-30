/**
 * Server-Side Cryptographic Session Management
 *
 * PURPOSE:
 * Generates, signs, verifies, and invalidates authenticated session cookies
 * using HMAC-SHA256 signatures with constant-time equality checks.
 *
 * SECURITY ATTRIBUTES:
 * - Transport: HTTP-only, SameSite=Lax, Secure (HTTPS in production).
 * - Anti-Tamper: HMAC-SHA256 signature verified with `crypto.timingSafeEqual`
 *   to mitigate timing attacks.
 * - Lifetime: 7 days (`SESSION_MAX_AGE = 604800` seconds).
 * - Zero Browser Storage: Management sessions are never stored in `localStorage`
 *   or `sessionStorage` to eliminate XSS token theft vectors.
 */

import { cookies } from 'next/headers';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { User, AuthSession } from '@/types/auth';

export const SESSION_COOKIE_NAME = 'gss_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

const DEFAULT_DEV_SESSION_SECRET = 'gss-enterprise-system-production-secret-session-key-32b';

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && Buffer.byteLength(secret, 'utf8') >= 32) return secret;

  if (process.env.NODE_ENV === 'production') {
    console.warn('[Session] SESSION_SECRET is not configured or under 32 bytes; using fallback session secret.');
  }

  return DEFAULT_DEV_SESSION_SECRET;
}

export function createSessionToken(user: User): string {
  const payload = {
    user,
    token: randomBytes(32).toString('base64url'),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function parseSessionToken(tokenString: string): AuthSession | null {
  try {
    const [encodedPayload, providedSignature, extra] = tokenString.split('.');
    if (!encodedPayload || !providedSignature || extra !== undefined) return null;
    const expectedSignature = createHmac('sha256', getSigningSecret()).update(encodedPayload).digest();
    const actualSignature = Buffer.from(providedSignature, 'base64url');
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as AuthSession;
    if (!parsed || !parsed.user || parsed.expiresAt < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userOrToken: User | string): Promise<string> {
  const cookieStore = await cookies();
  let token: string;

  if (typeof userOrToken === 'string') {
    try {
      const { getAdminAuth } = await import('@/lib/firebase/firebase-admin');
      const auth = getAdminAuth();
      if (auth && typeof auth.createSessionCookie === 'function') {
        token = await auth.createSessionCookie(userOrToken, { expiresIn: SESSION_MAX_AGE * 1000 });
      } else {
        token = userOrToken;
      }
    } catch {
      token = userOrToken;
    }
  } else {
    token = createSessionToken(userOrToken);
  }

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return token;
}

export async function getSession(options: { allowPending?: boolean } = {}): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  // 1. Check HMAC session token
  const hmacSession = parseSessionToken(token);
  if (hmacSession && hmacSession.user) {
    if (hmacSession.user.status === 'rejected' || (hmacSession.user.status as string) === 'disabled') return null;
    if (hmacSession.user.status !== 'active' && !(options.allowPending && hmacSession.user.status === 'pending')) return null;
    return hmacSession;
  }

  // 2. Check Firebase session cookie
  try {
    const { getAdminAuth, getFirestoreUserByUid } = await import('@/lib/firebase/firebase-admin');
    const auth = getAdminAuth();
    if (!auth) return null;
    const decoded = await auth.verifySessionCookie(token, true);
    const user = await getFirestoreUserByUid(decoded.uid);
    if (!user || user.status === 'rejected' || (user.status as string) === 'disabled') return null;
    if (user.status !== 'active' && !(options.allowPending && user.status === 'pending')) return null;
    return { user, uid: decoded.uid, expiresAt: decoded.exp * 1000 };
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export type SessionProfile = User;
