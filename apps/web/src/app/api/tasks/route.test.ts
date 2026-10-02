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

  it('allows an assigned employee to resume a partially stopped task', async () => {
    (getSession as jest.Mock).mockResolvedValue({ uid: 'uid-1', user: { id: 'EMP-1', name: 'Employee', role: 'employee', branch: 'Chennai' } });
    const transaction = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          status: 'partially_stopped',
          branch: 'Chennai',
          branchId: 'CHENNAI',
          assignedToUserIds: ['EMP-1'],
          startedAt: '2026-09-01T10:00:00.000Z',
          stopReason: 'Awaiting client approval',
        }),
      }),
      update: jest.fn(),
      create: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(id => ({ id })) })),
      runTransaction: jest.fn(async fn => fn(transaction)),
    };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: 'task-1', status: 'in_progress', reason: 'Resumed by user' }),
    });

    const response = await PATCH(req);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.task.status).toBe('in_progress');
    expect(transaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'in_progress' })
    );
  });

  it('allows Super Admin to edit task details', async () => {
    (getSession as jest.Mock).mockResolvedValue({ uid: 'uid-sa', user: { id: 'SA-1', name: 'Super Admin', role: 'superadmin', branch: 'Coimbatore' } });
    const transaction = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          title: 'Old Title',
          description: 'Old Description',
          priority: 'low',
          status: 'pending',
          branch: 'Chennai',
          branchId: 'CHENNAI',
        }),
      }),
      update: jest.fn(),
      create: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(id => ({ id })) })),
      runTransaction: jest.fn(async fn => fn(transaction)),
    };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'edit_task',
        taskId: 'task-1',
        title: 'Updated Master Task Title',
        priority: 'high',
        dueDate: '2026-10-15',
      }),
    });

    const response = await PATCH(req);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.task.title).toBe('Updated Master Task Title');
    expect(json.task.priority).toBe('high');
    expect(transaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Updated Master Task Title', priority: 'high' })
    );
  });
});
