import { registerStaffAttendanceOnLogin } from './auto-attendance-service';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';
import type { User } from '@/types/auth';

jest.mock('@/lib/firebase/firebase-admin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/worklogs/worklog-store', () => ({
  addWorkLog: jest.fn(),
}));

jest.mock('@/lib/attendance/month-rollover-service', () => ({
  checkAndAutoExecuteMonthRollover: jest.fn().mockResolvedValue({ triggered: false }),
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
    batch: jest.Mock;
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
      batch: jest.fn(() => ({
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      })),
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

  it('registers attendance as present on login when within shift entry timing', async () => {
    // User configured with late shift so current test execution time is on-time
    const onTimeUser: User = {
      ...activeUser,
      entryTime: '11:59 PM',
      shiftTiming: { entryTime: '11:59 PM', exitTime: '11:59 PM' },
    };

    await registerStaffAttendanceOnLogin(onTimeUser);

    expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.get).toHaveBeenCalledTimes(3);

    const { getLiveDateInfo } = await import('@/lib/worklogs/worklog-session-utils');
    const { day } = getLiveDateInfo();

    // Matrix grid set as present
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

  it('registers attendance as late on login when past shift entry timing even by 1 minute', async () => {
    // User configured with early morning shift so current execution time is late
    const lateUser: User = {
      ...activeUser,
      id: 'GSSEMP685',
      employeeId: 'GSSEMP685',
      entryTime: '06:00 AM',
      shiftTiming: { entryTime: '06:00 AM', exitTime: '03:00 PM' },
    };

    await registerStaffAttendanceOnLogin(lateUser);

    const { getLiveDateInfo } = await import('@/lib/worklogs/worklog-session-utils');
    const { day } = getLiveDateInfo();

    // Matrix grid set as late
    expect(mockTransaction.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringContaining('att_GSSEMP685_') }),
      expect.objectContaining({
        staffId: 'GSSEMP685',
        attendance: expect.objectContaining({
          [day]: expect.stringMatching(/late|half_day/),
        }),
      }),
      { merge: true }
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
