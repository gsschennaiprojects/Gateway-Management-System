import { POST } from './route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/firebase/firebase-admin', () => ({ getAdminFirestore: jest.fn() }));

const makeRequest = (body: unknown) => new NextRequest('http://localhost/api/worklogs', {
  method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/worklogs', () => {
  const session = { user: { id: 'GSS_EMP_001', name: 'Staff', role: 'employee', status: 'active', branch: 'Chennai' } };
  let created: Record<string, unknown>;
  const transaction = {
    get: jest.fn(async () => ({ exists: false, data: () => undefined })),
    create: jest.fn((_ref, data) => { created = data; }),
    set: jest.fn(), update: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    created = {};
    (getSession as jest.Mock).mockResolvedValue(session);
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(id => ({ id })) })),
      runTransaction: jest.fn(async fn => fn(transaction)),
    };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
  });

  it('uses server-owned date, ID and time; ignores caller supplied values', async () => {
    const response = await POST(makeRequest({ action: 'punchIn', id: 'forged', logId: 'forged', date: '2000-01-01', loginTime: '09:00 AM', plannedTasks: ['Plan'] }));
    expect(response.status).toBe(201);
    expect(created.id).toBe('WL_GSS_EMP_001_' + String(created.date).replace(/-/g, ''));
    expect(created.date).not.toBe('2000-01-01');
    expect(created.loginTime).not.toBe('09:00 AM');
  });

  it('rejects clear and generic save mutations instead of deleting attendance history', async () => {
    expect((await POST(makeRequest({ action: 'clearPunch' }))).status).toBe(400);
    expect((await POST(makeRequest({ action: 'save' }))).status).toBe(409);
  });

  it('rejects cross-origin punch requests', async () => {
    const req = new NextRequest('http://localhost/api/worklogs', { method: 'POST', headers: { origin: 'https://evil.invalid' }, body: '{}' });
    expect((await POST(req)).status).toBe(403);
    expect(getAdminFirestore).not.toHaveBeenCalled();
  });
});
