import { PATCH } from './route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getFirestoreUsers } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/firebase/firebase-admin', () => ({ getFirestoreUsers: jest.fn() }));

describe('PATCH /api/auth/users', () => {
  it('does not allow a branch admin to grant an elevated role', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'ADM-1', role: 'admin', branch: 'Chennai' } });
    (getFirestoreUsers as jest.Mock).mockResolvedValue([{ id: 'EMP-1', uid: 'uid-1', role: 'employee', branch: 'Chennai', status: 'active' }]);
    const req = new NextRequest('http://localhost/api/auth/users', {
      method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'EMP-1', action: 'update_role', role: 'superadmin' }),
    });
    const response = await PATCH(req);
    expect(response.status).toBe(403);
  });
});
