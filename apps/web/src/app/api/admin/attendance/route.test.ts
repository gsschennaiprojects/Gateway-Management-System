import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getFirestoreStaffAttendanceGrid, saveFirestoreStaffAttendanceGrid } from '@/lib/attendance/attendance-service';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/attendance/attendance-service', () => ({
  getFirestoreStaffAttendanceGrid: jest.fn(),
  saveFirestoreStaffAttendanceGrid: jest.fn(),
}));

describe('/api/admin/attendance access control & validation', () => {
  const mockedGetSession = jest.mocked(getSession);
  const mockedGetGrid = jest.mocked(getFirestoreStaffAttendanceGrid);
  const mockedSaveGrid = jest.mocked(saveFirestoreStaffAttendanceGrid);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockedGetSession.mockResolvedValue(null);
    const response = await GET(new NextRequest('http://localhost/api/admin/attendance'));
    expect(response.status).toBe(401);
  });

  it('rejects employee role with 403', async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: 'EMP_1', name: 'Staff', role: 'employee', branch: 'Chennai', email: 'emp@test.com', status: 'active', specialization: 'Dev' },
    } as any);
    const response = await GET(new NextRequest('http://localhost/api/admin/attendance'));
    expect(response.status).toBe(403);
  });

  it('allows superadmin to fetch attendance grid', async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: 'SA_1', name: 'Super Admin', role: 'superadmin', branch: 'Coimbatore', email: 'sa@test.com', status: 'active', specialization: 'Ops' },
    } as any);
    mockedGetGrid.mockResolvedValue({
      records: [
        { id: 'EMP_1', name: 'Employee One', role: 'EMPLOYEE', branch: 'Coimbatore', attendance: { 1: 'present' } },
      ],
      lastUpdated: '2026-09-30T00:00:00.000Z',
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/attendance?year=2026&month=9'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.records).toHaveLength(1);
    expect(json.records[0].name).toBe('Employee One');
  });

  it('allows admin to save attendance grid changes', async () => {
    mockedGetSession.mockResolvedValue({
      user: { id: 'ADM_1', name: 'Branch Admin', role: 'admin', branch: 'Chennai', email: 'adm@test.com', status: 'active', specialization: 'Admin' },
    } as any);
    mockedSaveGrid.mockResolvedValue({ count: 1, updatedAt: '2026-09-30T10:00:00.000Z' });

    const request = new NextRequest('http://localhost/api/admin/attendance', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({
        year: 2026,
        month: 9,
        records: [
          { staffId: 'EMP_1', name: 'Employee One', attendance: { 1: 'present', 2: 'absent' } },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(mockedSaveGrid).toHaveBeenCalledWith(expect.objectContaining({
      year: 2026,
      month: 9,
      records: expect.any(Array),
      actor: expect.objectContaining({ id: 'ADM_1', role: 'admin' }),
    }));
  });
});
