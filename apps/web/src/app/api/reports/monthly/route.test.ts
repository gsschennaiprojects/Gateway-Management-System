import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSession } from '@/lib/auth/session';
import {
  getFirestoreUserById,
  getFirestoreStudents,
  getFirestoreTasks,
  getFirestoreWorklogs,
  getFirestoreUsers,
} from '@/lib/firebase/firebase-admin';
import { getFirestoreStaffAttendanceGrid } from '@/lib/attendance/attendance-service';

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/firebase/firebase-admin', () => ({
  getAdminFirestore: jest.fn(),
  getFirestoreUsers: jest.fn(),
  getFirestoreUserById: jest.fn(),
  getFirestoreStudents: jest.fn(),
  getFirestoreTasks: jest.fn(),
  getFirestoreWorklogs: jest.fn(),
}));

jest.mock('@/lib/attendance/attendance-service', () => ({
  getFirestoreStaffAttendanceGrid: jest.fn(),
}));

describe('GET /api/reports/monthly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user session is not present', async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/reports/monthly');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 if an employee attempts to view another staff member report', async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: {
        id: 'GSSEMP684',
        name: 'Jasvanth S',
        role: 'employee',
        branch: 'Chennai',
      },
    });

    const req = new NextRequest('http://localhost/api/reports/monthly?targetUserId=GSSHR401');
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('generates accurate live monthly report for authorized employee', async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: {
        id: 'GSSEMP684',
        employeeId: 'GSSEMP684',
        name: 'Jasvanth S',
        role: 'employee',
        branch: 'Chennai',
        specialization: 'AIML',
      },
    });

    (getFirestoreStaffAttendanceGrid as jest.Mock).mockResolvedValue({
      records: [
        {
          id: 'GSSEMP684',
          name: 'Jasvanth S',
          role: 'employee',
          branch: 'Chennai',
          attendance: {
            1: 'present',
            2: 'present',
            3: 'present',
            4: 'absent',
            5: 'present',
          },
        },
      ],
      lastUpdated: '2026-10-01T12:00:00.000Z',
    });

    (getFirestoreStudents as jest.Mock).mockResolvedValue([
      {
        id: 'stu_1',
        studentName: 'Alice',
        course: 'Python Data Science',
        domain: 'Python Data Science',
        mentorStaffId: 'GSSEMP684',
        feeStatus: 'Paid',
        projectStatus: 'Active',
      },
      {
        id: 'stu_2',
        studentName: 'Bob',
        course: 'Python Data Science',
        domain: 'Python Data Science',
        mentorStaffId: 'GSSEMP684',
        feeStatus: 'Paid',
        projectStatus: 'Completed',
      },
    ]);

    (getFirestoreTasks as jest.Mock).mockResolvedValue([
      {
        id: 'task_1',
        title: 'Review Capstone Models',
        status: 'completed',
        dueDate: '2026-10-15',
        assignedToUserIds: ['GSSEMP684'],
      },
    ]);

    (getFirestoreWorklogs as jest.Mock).mockResolvedValue([
      {
        id: 'wl_1',
        userId: 'GSSEMP684',
        date: '2026-10-01',
        hoursLogged: 8,
        completedTasks: ['Trained LSTM model for time-series forecasting'],
      },
    ]);

    const req = new NextRequest('http://localhost/api/reports/monthly?year=2026&month=10');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.report.staff.employeeId).toBe('GSSEMP684');
    expect(body.report.metrics.presentDays).toBe(4);
    expect(body.report.metrics.absentDays).toBe(1);
    expect(body.report.metrics.totalInternsMentored).toBe(2);
    expect(body.report.metrics.tasksConcluded).toBe(1);
    expect(body.report.domainCohorts).toHaveLength(1);
    expect(body.report.domainCohorts[0].domain).toBe('Python Data Science');
    expect(body.report.keyDeliverables).toContain('Trained LSTM model for time-series forecasting');
  });

  it('allows superadmin to audit any staff member and provides staff list', async () => {
    (getSession as jest.Mock).mockResolvedValue({
      user: {
        id: 'GSSSA432',
        employeeId: 'GSSSA432',
        name: 'SABARINATHAN Muthu',
        role: 'superadmin',
        branch: 'Coimbatore',
      },
    });

    (getFirestoreUserById as jest.Mock).mockResolvedValue({
      id: 'GSSHR401',
      employeeId: 'GSSHR401',
      name: 'Srinithi S',
      role: 'hr',
      branch: 'Chennai',
      specialization: 'HR Operation',
    });

    (getFirestoreStaffAttendanceGrid as jest.Mock).mockResolvedValue({
      records: [
        {
          id: 'GSSHR401',
          name: 'Srinithi S',
          attendance: { 1: 'present' },
        },
      ],
      lastUpdated: '2026-10-01T12:00:00.000Z',
    });

    (getFirestoreStudents as jest.Mock).mockResolvedValue([]);
    (getFirestoreTasks as jest.Mock).mockResolvedValue([]);
    (getFirestoreWorklogs as jest.Mock).mockResolvedValue([]);
    (getFirestoreUsers as jest.Mock).mockResolvedValue([
      { id: 'GSSSA432', name: 'SABARINATHAN Muthu', role: 'superadmin', branch: 'Coimbatore', status: 'active' },
      { id: 'GSSHR401', name: 'Srinithi S', role: 'hr', branch: 'Chennai', status: 'active' },
    ]);

    const req = new NextRequest('http://localhost/api/reports/monthly?year=2026&month=10&targetUserId=GSSHR401');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.report.staff.employeeId).toBe('GSSHR401');
    expect(body.report.staff.name).toBe('Srinithi S');
    expect(body.availableStaff).toHaveLength(2);
  });
});
