import { POST } from './route';
import { NextRequest } from 'next/server';
import { getFirestoreUserByIdentifier } from '@/lib/firebase/firebase-admin';
import { setSessionCookie } from '@/lib/auth/session';

jest.mock('@/lib/firebase/firebase-admin', () => ({
  getFirestoreUserByIdentifier: jest.fn(),
  syncUserToFirestore: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/lib/auth/session', () => ({ setSessionCookie: jest.fn().mockResolvedValue('token') }));
jest.mock('@/lib/auth/login-rate-limit', () => ({ checkLoginRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/attendance/auto-attendance-service', () => ({
  registerStaffAttendanceOnLogin: jest.fn().mockResolvedValue(undefined),
}));

const request = (body: unknown) => new NextRequest('http://localhost/api/auth/login', {
  method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/auth/login', () => {
  const profile = {
    id: 'EMP-1',
    name: 'Staff',
    email: 'staff@example.invalid',
    mobile: '',
    role: 'employee',
    status: 'active',
    branch: 'Chennai',
    password: 'secret-password',
    createdAt: '2026-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirestoreUserByIdentifier as jest.Mock).mockResolvedValue(profile);
  });

  it('verifies credentials and creates a secure session', async () => {
    const { registerStaffAttendanceOnLogin } = await import('@/lib/attendance/auto-attendance-service');
    const response = await POST(request({ identifier: profile.email, password: 'secret-password' }));
    expect(response.status).toBe(200);
    expect(setSessionCookie).toHaveBeenCalledWith(expect.objectContaining({ id: 'EMP-1', email: profile.email }));
    expect(registerStaffAttendanceOnLogin).toHaveBeenCalledWith(expect.objectContaining({ id: 'EMP-1', email: profile.email }));
  });

  it('uses the same public error for unknown account and incorrect password', async () => {
    (getFirestoreUserByIdentifier as jest.Mock).mockResolvedValueOnce(null);
    const unknown = await POST(request({ identifier: 'unknown@example.invalid', password: 'bad' }));
    (getFirestoreUserByIdentifier as jest.Mock).mockResolvedValueOnce(profile);
    const wrongPassword = await POST(request({ identifier: profile.email, password: 'bad' }));
    expect(unknown.status).toBe(wrongPassword.status);
    await expect(unknown.json()).resolves.toEqual(await wrongPassword.json());
  });

  it('rejects cross-origin requests before credential processing', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.invalid' }, body: '{}' });
    expect((await POST(req)).status).toBe(403);
    expect(getFirestoreUserByIdentifier).not.toHaveBeenCalled();
  });
});
