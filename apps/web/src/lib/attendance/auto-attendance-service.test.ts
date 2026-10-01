import { registerStaffAttendanceOnLogin } from './auto-attendance-service';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';
import type { User } from '@/types/auth';

jest.mock('@/lib/firebase/firebase-admin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/worklogs/worklog-store', () => ({
  addWorkLog: jest.fn(),
}));

describe('auto-attendance-service: registerStaffAttendanceOnLogin', () => {
  const activeUser: User = {
    id: 'GSSEMP684',
    employeeId: 'GSSEMP684',
    name: 'Jasvanth',
    email: 'jasvanth@gss.com',
    mobile: '9876543210',
    role: 'employee',
    status: 'active',
    branch: 'Chennai',
    createdAt: '2026-01-01',
  };

  const disabledUser: User = {
    ...activeUser,
    id: 'GSSEMP999',
    status: 'disabled',
  };

  let mockTransaction: {
    get: jest.Mock;
    set: jest.Mock;
    update: jest.Mock;
  };
  let mockDb: {
    collection: jest.Mock;
    runTransaction: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        return Promise.resolve({
          exists: false,
          data: () => null,
        });
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    const docMock = jest.fn((id: string) => ({ id }));
    const collectionMock = jest.fn(() => ({ doc: docMock }));

    mockDb = {
      collection: collectionMock,
      runTransaction: jest.fn(async (cb) => {
        return await cb(mockTransaction);
      }),
    };

    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb);
  });

  it('does not register attendance for inactive users or null users', async () => {
    await registerStaffAttendanceOnLogin(disabledUser);
    expect(mockDb.runTransaction).not.toHaveBeenCalled();

    // @ts-expect-error testing null safety
    await registerStaffAttendanceOnLogin(null);
    expect(mockDb.runTransaction).not.toHaveBeenCalled();
  });

  it('registers attendance as present across staff_attendance, attendance, and daily_worklogs on login', async () => {
    await registerStaffAttendanceOnLogin(activeUser);

    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.get).toHaveBeenCalledTimes(3);

    const { getLiveDateInfo } = await import('@/lib/worklogs/worklog-session-utils');
    const { day } = getLiveDateInfo();

    // Matrix grid set
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringContaining('att_GSSEMP684_') }),
      expect.objectContaining({
        staffId: 'GSSEMP684',
        name: 'Jasvanth',
        attendance: expect.objectContaining({
          [day]: 'present',
        }),
      }),
      { merge: true }
    );

    // Daily attendance doc set
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringContaining('ATT_GSSEMP684_') }),
      expect.objectContaining({
        staffId: 'GSSEMP684',
        status: 'Present',
        markedBy: 'Auto-Login (System)',
      })
    );

    // Daily worklog doc set
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringContaining('WL_GSSEMP684_') }),
      expect.objectContaining({
        userId: 'GSSEMP684',
        attendanceStatus: 'present',
      })
    );
  });

  it('preserves existing attendance status (like late or half_day) if already recorded for today', async () => {
    mockTransaction.get.mockImplementation((ref) => {
      if (ref.id && ref.id.startsWith('att_')) {
        return Promise.resolve({
          exists: true,
          data: () => ({
            id: ref.id,
            staffId: 'GSSEMP684',
            attendance: {
              1: 'late',
            },
          }),
        });
      }
      return Promise.resolve({ exists: true, data: () => ({ loginTime: '09:45 AM' }) });
    });

    await registerStaffAttendanceOnLogin(activeUser);

    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringContaining('att_GSSEMP684_') }),
      expect.objectContaining({
        attendance: expect.objectContaining({
          1: 'late',
        }),
      }),
      { merge: true }
    );
  });
});
