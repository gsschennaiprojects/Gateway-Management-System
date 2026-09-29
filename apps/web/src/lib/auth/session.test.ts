import { getSession, setSessionCookie, createSessionToken, parseSessionToken, SESSION_COOKIE_NAME } from './session';
import { cookies } from 'next/headers';
import { getAdminAuth, getFirestoreUserByUid } from '@/lib/firebase/firebase-admin';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/firebase/firebase-admin', () => ({
  getAdminAuth: jest.fn(), getFirestoreUserByUid: jest.fn(),
}));

describe('Session management', () => {
  const user = { id: 'EMP-1', uid: 'EMP-1', name: 'Test', email: 'test@example.invalid', mobile: '', role: 'employee' as const, status: 'active' as const, branch: 'Chennai' as const, createdAt: '2026-01-01' };
  const cookieStore = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
  const auth = { createSessionCookie: jest.fn(), verifySessionCookie: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (cookies as jest.Mock).mockResolvedValue(cookieStore);
    (getAdminAuth as jest.Mock).mockReturnValue(auth);
    (getFirestoreUserByUid as jest.Mock).mockResolvedValue(user);
    cookieStore.get.mockReturnValue({ value: 'firebase-session' });
    auth.verifySessionCookie.mockResolvedValue({ uid: 'firebase-uid', exp: 2000000000 });
  });

  describe('HMAC sessions', () => {
    it('creates and parses signed session tokens', () => {
      const token = createSessionToken(user);
      expect(typeof token).toBe('string');
      expect(token).toContain('.');
      const session = parseSessionToken(token);
      expect(session?.user).toEqual(user);
      expect(session?.expiresAt).toBeGreaterThan(Date.now());
    });

    it('sets HMAC session cookie when user object is provided', async () => {
      await setSessionCookie(user);
      expect(cookieStore.set).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.stringContaining('.'),
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
      );
    });

    it('retrieves user from HMAC session cookie without calling Firebase Auth', async () => {
      const token = createSessionToken(user);
      cookieStore.get.mockReturnValue({ value: token });
      const session = await getSession();
      expect(session?.user).toEqual(user);
      expect(auth.verifySessionCookie).not.toHaveBeenCalled();
    });
  });

  describe('Firebase session cookies', () => {
    it('issues a Firebase Admin session cookie when idToken is provided and auth is available', async () => {
      auth.createSessionCookie.mockResolvedValue('signed-by-firebase');
      await setSessionCookie('firebase-id-token');
      expect(auth.createSessionCookie).toHaveBeenCalledWith('firebase-id-token', expect.any(Object));
      expect(cookieStore.set).toHaveBeenCalledWith(SESSION_COOKIE_NAME, 'signed-by-firebase', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    });

    it('verifies revocation and fetches current Firestore profile', async () => {
      const session = await getSession();
      expect(auth.verifySessionCookie).toHaveBeenCalledWith('firebase-session', true);
      expect(getFirestoreUserByUid).toHaveBeenCalledWith('firebase-uid');
      expect(session?.user).toEqual(user);
    });

    it('fails closed when profile is missing or no longer active', async () => {
      (getFirestoreUserByUid as jest.Mock).mockResolvedValueOnce(null).mockResolvedValue({ ...user, status: 'pending' });
      expect(await getSession()).toBeNull();
      expect(await getSession()).toBeNull();
      expect((await getSession({ allowPending: true }))?.user.status).toBe('pending');
    });

    it('fails closed when Firebase rejects the cookie', async () => {
      auth.verifySessionCookie.mockRejectedValueOnce(new Error('invalid cookie'));
      expect(await getSession()).toBeNull();
    });
  });
});
