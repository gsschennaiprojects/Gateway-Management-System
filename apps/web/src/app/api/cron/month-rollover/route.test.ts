import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { checkAndAutoExecuteMonthRollover } from '@/lib/attendance/month-rollover-service';

jest.mock('@/lib/attendance/month-rollover-service', () => ({
  checkAndAutoExecuteMonthRollover: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn().mockResolvedValue(null),
}));

describe('Cron Month-End Rollover Route (/api/cron/month-rollover)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret-key-123', NODE_ENV: 'production' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects unauthorized requests in production without cron header or secret', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/month-rollover');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(checkAndAutoExecuteMonthRollover).not.toHaveBeenCalled();
  });

  it('authorizes requests with Vercel Cron header and executes rollover check', async () => {
    (checkAndAutoExecuteMonthRollover as jest.Mock).mockResolvedValue({
      triggered: true,
      message: 'Archived September 2026 into monthly_attendance_archives',
    });

    const req = new NextRequest('http://localhost:3000/api/cron/month-rollover', {
      headers: {
        'x-vercel-cron': '1',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.triggered).toBe(true);
    expect(data.message).toContain('Archived September 2026');
    expect(checkAndAutoExecuteMonthRollover).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'CRON_SCHEDULED_JOB' })
    );
  });

  it('authorizes requests with matching Bearer token in Authorization header', async () => {
    (checkAndAutoExecuteMonthRollover as jest.Mock).mockResolvedValue({
      triggered: false,
      message: 'Current active calendar period is up-to-date; no rollover required.',
    });

    const req = new NextRequest('http://localhost:3000/api/cron/month-rollover', {
      headers: {
        authorization: 'Bearer test-secret-key-123',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.triggered).toBe(false);
  });
});
