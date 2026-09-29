import { POST } from './route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
  clearSessionCookie: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/firebase/firebase-admin', () => ({
  syncAttendanceToFirestore: jest.fn(),
}));

describe('POST /api/auth/logout', () => {
  it('only clears the session and never invents an attendance punch-out', async () => {
    const { getSession, clearSessionCookie } = await import('@/lib/auth/session');
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'EMP-1' } });
    const request = new NextRequest('http://localhost/api/auth/logout', { method: 'POST', headers: { origin: 'http://localhost' } });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(clearSessionCookie).toHaveBeenCalledTimes(1);
    const { syncAttendanceToFirestore } = await import('@/lib/firebase/firebase-admin');
    expect(syncAttendanceToFirestore).not.toHaveBeenCalled();
  });
});
