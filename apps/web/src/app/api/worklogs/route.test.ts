import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreWorklogs, getFirestoreUserById } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/firebase/firebase-admin', () => ({
  getAdminFirestore: jest.fn(),
  getFirestoreWorklogs: jest.fn(),
  getFirestoreUserById: jest.fn(),
}));

const makePostRequest = (body: unknown) => new NextRequest('http://localhost/api/worklogs', {
  method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(body),
});

const makeGetRequest = (query: string = '') => new NextRequest(`http://localhost/api/worklogs${query}`, {
  method: 'GET', headers: { origin: 'http://localhost' },
});

describe('Worklogs API Route — Multi-Day Continuous Work Sessions', () => {
  const session = { user: { id: 'GSS_EMP_001', name: 'Staff', role: 'employee', status: 'active', branch: 'Chennai' } };
  let created: Record<string, unknown>;
  let updated: Record<string, unknown>;
  const transaction: {
    get: jest.Mock<any>;
    create: jest.Mock<any>;
    set: jest.Mock<any>;
    update: jest.Mock<any>;
  } = {
    get: jest.fn(async () => ({ exists: false, data: () => undefined })),
    create: jest.fn((_ref, data) => { created = data; }),
    set: jest.fn(),
    update: jest.fn((_ref, data) => { updated = data; }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    created = {};
    updated = {};
    (getSession as jest.Mock).mockResolvedValue(session);
    (getFirestoreUserById as jest.Mock).mockResolvedValue(session.user);
    (getFirestoreWorklogs as jest.Mock).mockResolvedValue([]);
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(id => ({ id, ref: { id } })),
        where: jest.fn(() => ({
          where: jest.fn(() => ({
            get: jest.fn(async () => ({ empty: true, docs: [] })),
          })),
          get: jest.fn(async () => ({ empty: true, docs: [] })),
        })),
      })),
      runTransaction: jest.fn(async fn => fn(transaction)),
    };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
  });

  describe('GET /api/worklogs', () => {
    it('returns an active unclosed session from an earlier day when queried for today', async () => {
      // Simulate unclosed worklog started 2 days ago
      const priorLog = {
        id: 'WL_GSS_EMP_001_20261001',
        userId: 'GSS_EMP_001',
        date: '2026-10-01',
        loginTime: '09:15 AM',
        logoutTime: null,
        plannedTasks: ['Task A', 'Task B'],
        completedTasks: [],
        attendanceStatus: 'present',
      };
      (getFirestoreWorklogs as jest.Mock).mockResolvedValue([priorLog]);

      const res = await GET(makeGetRequest('?today=true&targetUserId=GSS_EMP_001'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isPunchedIn).toBe(true);
      expect(data.isPunchedOut).toBe(false);
      expect(data.todayLog).not.toBeNull();
      expect(data.todayLog.loginTime).toBe('09:15 AM');
      expect(data.todayLog.plannedTasks).toEqual(['Task A', 'Task B']);
      expect(data.todayLog.sessionStartDate).toBe('2026-10-01');
      expect(data.isSpanningDays).toBe(true);
      expect(data.daysElapsed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/worklogs', () => {
    it('uses server-owned date, ID and time; ignores caller supplied values', async () => {
      const response = await POST(makePostRequest({ action: 'punchIn', id: 'forged', logId: 'forged', date: '2000-01-01', loginTime: '09:00 AM', plannedTasks: ['Plan'] }));
      expect(response.status).toBe(201);
      expect(created.id).toBe('WL_GSS_EMP_001_' + String(created.date).replace(/-/g, ''));
      expect(created.date).not.toBe('2000-01-01');
      expect(created.loginTime).not.toBe('09:00 AM');
    });

    it('rejects clear and generic save mutations instead of deleting attendance history', async () => {
      expect((await POST(makePostRequest({ action: 'clearPunch' }))).status).toBe(400);
      expect((await POST(makePostRequest({ action: 'save' }))).status).toBe(409);
    });

    it('rejects cross-origin punch requests', async () => {
      const req = new NextRequest('http://localhost/api/worklogs', { method: 'POST', headers: { origin: 'https://evil.invalid' }, body: '{}' });
      expect((await POST(req)).status).toBe(403);
      expect(getAdminFirestore).not.toHaveBeenCalled();
    });

    it('successfully punches out an active multi-day session with completed tasks', async () => {
      const activeMultiDayDoc = {
        id: 'WL_GSS_EMP_001_20261001',
        userId: 'GSS_EMP_001',
        userName: 'Staff',
        userRole: 'employee',
        branch: 'Chennai',
        date: '2026-10-01',
        loginTime: '09:00 AM',
        logoutTime: null,
        plannedTasks: ['Finish Project Alpha', 'Write Docs'],
        completedTasks: [],
        attendanceStatus: 'present',
      };

      // Mock transaction returning active unclosed doc
      transaction.get = jest.fn(async () => ({
        exists: true,
        data: () => activeMultiDayDoc,
        ref: { id: activeMultiDayDoc.id },
      }));

      const res = await POST(makePostRequest({
        action: 'punchOut',
        logId: activeMultiDayDoc.id,
        completedTasks: ['Finish Project Alpha', 'Write Docs'],
        incompleteReason: '',
      }));

      expect(res.status).toBe(200);
      expect(updated.completedTasks).toEqual(['Finish Project Alpha', 'Write Docs']);
      expect(updated.logoutTime).toBeDefined();
      expect(updated.attendanceStatus).toBe('present');
    });

    it('rejects punch out if no completed tasks are provided', async () => {
      const activeDoc = {
        id: 'WL_GSS_EMP_001_20261001',
        userId: 'GSS_EMP_001',
        date: '2026-10-01',
        loginTime: '09:00 AM',
        logoutTime: null,
        plannedTasks: ['Task A'],
      };
      transaction.get = jest.fn(async () => ({
        exists: true,
        data: () => activeDoc,
        ref: { id: activeDoc.id },
      }));

      const res = await POST(makePostRequest({
        action: 'punchOut',
        completedTasks: [],
      }));
      expect(res.status).toBe(400);
    });

    it('rejects punch out if completed tasks are fewer than planned tasks without reason', async () => {
      const activeDoc = {
        id: 'WL_GSS_EMP_001_20261001',
        userId: 'GSS_EMP_001',
        date: '2026-10-01',
        loginTime: '09:00 AM',
        logoutTime: null,
        plannedTasks: ['Task 1', 'Task 2', 'Task 3'],
      };
      transaction.get = jest.fn(async () => ({
        exists: true,
        data: () => activeDoc,
        ref: { id: activeDoc.id },
      }));

      const res = await POST(makePostRequest({
        action: 'punchOut',
        completedTasks: ['Task 1'],
        incompleteReason: '', // missing reason
      }));
      expect(res.status).toBe(400);
    });
  });
});

