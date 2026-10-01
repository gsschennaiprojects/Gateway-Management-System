import { GET, POST } from './route';
import { getSession } from '@/lib/auth/session';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/api/request-security', () => ({
  isSameOriginRequest: jest.fn(() => true),
  hasOversizedBody: jest.fn(() => false),
}));

jest.mock('@/lib/attendance/month-rollover-service', () => ({
  executeMonthRolloverAndArchive: jest.fn().mockResolvedValue({
    success: true,
    message: 'Month rollover completed successfully.',
    previousPeriod: { year: 2026, month: 9, monthName: 'September 2026' },
    currentPeriod: { year: 2026, month: 10, monthName: 'October 2026' },
    archivedAttendanceCount: 15,
    archivedWorklogCount: 15,
    initializedStaffCount: 15,
    branchesUpdated: ['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad'],
    archivedAt: '2026-10-01T00:00:00.000Z',
  }),
  getMonthlyRolloverStatus: jest.fn().mockResolvedValue({
    currentActiveYear: 2026,
    currentActiveMonth: 10,
    lastArchivedYear: 2026,
    lastArchivedMonth: 9,
    lastRolloverAt: '2026-10-01T00:00:00.000Z',
    totalEmployeesArchived: 15,
    branchesUpdated: ['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad'],
    status: 'ACTIVE_AND_ARCHIVED',
  }),
  getPreviousMonthPeriod: jest.fn(() => ({ year: 2026, month: 9 })),
  formatMonthName: jest.fn((y, m) => `${m}/${y}`),
}));

describe('/api/admin/rollover-month', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      (getSession as jest.Mock).mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('returns 403 when role is employee', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: 'EMP_1', role: 'employee' },
      });
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it('returns rollover status when role is superadmin', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: 'SA_1', role: 'superadmin' },
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status.currentActiveMonth).toBe(10);
    });
  });

  describe('POST', () => {
    it('returns 403 when non-admin attempts rollover', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: 'EMP_1', role: 'employee' },
      });
      const req = new NextRequest('http://localhost:3000/api/admin/rollover-month', {
        method: 'POST',
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('executes rollover successfully when superadmin triggers it', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        user: { id: 'SA_1', name: 'Super Admin', role: 'superadmin', branch: 'Coimbatore' },
      });
      const req = new NextRequest('http://localhost:3000/api/admin/rollover-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.result.archivedAttendanceCount).toBe(15);
      expect(data.result.archivedWorklogCount).toBe(15);
    });
  });
});
