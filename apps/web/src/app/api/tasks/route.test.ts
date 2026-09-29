import { PATCH } from './route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/firebase/firebase-admin', () => ({ getAdminFirestore: jest.fn() }));

describe('PATCH /api/tasks', () => {
  it('requires a meaningful reason when partially stopping a task', async () => {
    (getSession as jest.Mock).mockResolvedValue({ uid: 'uid-1', user: { id: 'EMP-1', name: 'Employee', role: 'employee', branch: 'Chennai' } });
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1', status: 'partially_stopped', reason: 'blocked' }),
    });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });

  it('prevents a user from changing another employee task', async () => {
    (getSession as jest.Mock).mockResolvedValue({ uid: 'uid-1', user: { id: 'EMP-1', name: 'Employee', role: 'employee', branch: 'Chennai' } });
    const transaction = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'pending', branch: 'Chennai', branchId: 'CHENNAI', assignedToUserIds: ['EMP-2'] }) }),
      update: jest.fn(), create: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(id => ({ id })) })),
      runTransaction: jest.fn(async fn => fn(transaction)),
    };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1', status: 'completed' }),
    });

    const response = await PATCH(req);
    expect(response.status).toBe(403);
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
