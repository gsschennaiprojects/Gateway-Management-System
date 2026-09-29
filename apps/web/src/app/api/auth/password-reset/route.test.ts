import { POST } from './route';
import { NextRequest } from 'next/server';
import { getFirestoreUserByIdentifier } from '@/lib/firebase/firebase-admin';
import { checkLoginRateLimit } from '@/lib/auth/login-rate-limit';

jest.mock('@/lib/firebase/firebase-admin', () => ({ getFirestoreUserByIdentifier: jest.fn() }));
jest.mock('@/lib/auth/login-rate-limit', () => ({ checkLoginRateLimit: jest.fn().mockResolvedValue(true) }));

const makeRequest = (identifier: string) => new NextRequest('http://localhost/api/auth/password-reset', {
  method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ identifier }),
});

describe('POST /api/auth/password-reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
  });

  it('returns the same confirmation for unknown and known accounts', async () => {
    (getFirestoreUserByIdentifier as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce({ email: 'staff@example.invalid' });
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const unknown = await POST(makeRequest('missing@example.invalid'));
    const known = await POST(makeRequest('staff@example.invalid'));
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
  });

  it('requires same-origin requests', async () => {
    const request = new NextRequest('http://localhost/api/auth/password-reset', { method: 'POST', headers: { origin: 'https://evil.invalid' }, body: '{}' });
    expect((await POST(request)).status).toBe(403);
    expect(checkLoginRateLimit).not.toHaveBeenCalled();
  });
});
