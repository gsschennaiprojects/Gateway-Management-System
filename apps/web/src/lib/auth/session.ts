import { cookies } from 'next/headers';
import { User, AuthSession } from '@/types/auth';

export const SESSION_COOKIE_NAME = 'gss_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export function createSessionToken(user: User): string {
  const payload = {
    user,
    token: `tok_${Math.random().toString(36).substring(2)}${Date.now()}`,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function parseSessionToken(tokenString: string): AuthSession | null {
  try {
    const json = Buffer.from(tokenString, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as AuthSession;
    if (!parsed || !parsed.user || parsed.expiresAt < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return parseSessionToken(token);
}

export async function setSessionCookie(user: User): Promise<string> {
  const cookieStore = await cookies();
  const token = createSessionToken(user);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  });

  return token;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
