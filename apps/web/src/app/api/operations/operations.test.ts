import { NextRequest } from 'next/server';
import { GET as getBatches, POST as postBatches } from './batches/route';
import { GET as getLeaves, POST as postLeaves, PATCH as patchLeaves } from './leaves/route';
import { GET as getAnnouncements } from './announcements/route';
import { POST as postStudentAttendance } from './student-attendance/route';
import { getSession } from '@/lib/auth/session';
import {
  getFirestoreBatches,
  createFirestoreBatch,
  getFirestoreLeaveRequests,
  createFirestoreLeaveRequest,
  reviewFirestoreLeaveRequest,
  getFirestoreAnnouncements,
  recordStudentAttendanceBatch,
} from '@/lib/operations/operations-service';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/operations/operations-service', () => ({
  getFirestoreBatches: jest.fn(),
  createFirestoreBatch: jest.fn(),
  getFirestoreLeaveRequests: jest.fn(),
  createFirestoreLeaveRequest: jest.fn(),
  reviewFirestoreLeaveRequest: jest.fn(),
  getFirestoreAnnouncements: jest.fn(),
  recordStudentAttendanceBatch: jest.fn(),
}));

describe('Operations API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Batches API', () => {
    it('returns 401 if unauthenticated', async () => {
      (getSession as jest.Mock).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/operations/batches');
      const res = await getBatches(req);
      expect(res.status).toBe(401);
    });

    it('returns batches scoped to branch for branch admin', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        uid: 'admin-1',
        user: { id: 'admin-1', role: 'admin', branch: 'Coimbatore', name: 'Admin CBE' },
      });
      (getFirestoreBatches as jest.Mock).mockResolvedValue([
        { id: 'b1', name: 'Batch 1', branch: 'Coimbatore' },
      ]);

      const req = new NextRequest('http://localhost/api/operations/batches?branch=Chennai');
      const res = await getBatches(req);
      expect(res.status).toBe(200);
      expect(getFirestoreBatches).toHaveBeenCalledWith({
        branch: 'Coimbatore',
        status: undefined,
        mentorId: undefined,
      });
    });

    it('validates required fields when creating a batch', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        uid: 'admin-1',
        user: { id: 'admin-1', role: 'admin', branch: 'Coimbatore', name: 'Admin CBE' },
      });

      const req = new NextRequest('http://localhost/api/operations/batches', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const res = await postBatches(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Leaves API', () => {
    it('creates a leave request for the authenticated user', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        uid: 'emp-1',
        user: { id: 'emp-1', role: 'employee', branch: 'Chennai', name: 'John Doe' },
      });
      (createFirestoreLeaveRequest as jest.Mock).mockResolvedValue({
        id: 'leave_123',
        status: 'pending',
      });

      const req = new NextRequest('http://localhost/api/operations/leaves', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({
          leaveType: 'casual',
          startDate: '2026-10-05',
          endDate: '2026-10-06',
          daysCount: 2,
          reason: 'Personal family function',
        }),
      });

      const res = await postLeaves(req);
      expect(res.status).toBe(201);
      expect(createFirestoreLeaveRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          applicantId: 'emp-1',
          branch: 'Chennai',
          leaveType: 'casual',
        })
      );
    });

    it('prevents regular employees from approving leaves', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        uid: 'emp-1',
        user: { id: 'emp-1', role: 'employee', branch: 'Chennai', name: 'John Doe' },
      });

      const req = new NextRequest('http://localhost/api/operations/leaves', {
        method: 'PATCH',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({
          leaveId: 'leave_123',
          status: 'approved',
        }),
      });

      const res = await patchLeaves(req);
      expect(res.status).toBe(403);
      expect(reviewFirestoreLeaveRequest).not.toHaveBeenCalled();
    });
  });

  describe('Student Attendance API', () => {
    it('validates batch and date before bulk recording', async () => {
      (getSession as jest.Mock).mockResolvedValue({
        uid: 'emp-1',
        user: { id: 'emp-1', role: 'employee', branch: 'Chennai', name: 'Mentor' },
      });

      const req = new NextRequest('http://localhost/api/operations/student-attendance', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'application/json' },
        body: JSON.stringify({
          batchId: '',
          date: '',
          records: [],
        }),
      });

      const res = await postStudentAttendance(req);
      expect(res.status).toBe(400);
      expect(recordStudentAttendanceBatch).not.toHaveBeenCalled();
    });
  });
});
