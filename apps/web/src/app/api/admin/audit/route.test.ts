import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/audit-service';
import { GET, POST } from './route';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/audit/audit-service', () => ({
  getAuditLogs: jest.fn().mockResolvedValue([]),
  logAuditEvent: jest.fn().mockResolvedValue('audit-1'),
}));

const mockedGetSession = jest.mocked(getSession);
const mockedLogAuditEvent = jest.mocked(logAuditEvent);

describe('/api/admin/audit access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSession.mockResolvedValue(null);
  });

  it('rejects anonymous audit reads', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/audit'));
    expect(response.status).toBe(401);
  });

  it('rejects anonymous writes even when the body claims to be a superadmin', async () => {
    const response = await POST(new NextRequest('http://localhost/api/admin/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'attacker', role: 'superadmin', action: 'FORGED' }),
    }));

    expect(response.status).toBe(401);
    expect(mockedLogAuditEvent).not.toHaveBeenCalled();
  });
});
