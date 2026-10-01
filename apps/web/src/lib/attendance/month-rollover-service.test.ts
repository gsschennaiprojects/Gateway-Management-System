import {
  getPreviousMonthPeriod,
  getWorkingDaysInMonth,
  formatMonthName,
  executeMonthRolloverAndArchive,
} from './month-rollover-service';

jest.mock('@/lib/firebase/firebase-admin', () => ({
  getAdminFirestore: jest.fn(() => null),
  getFirestoreUsers: jest.fn().mockResolvedValue([]),
  getFirestoreWorklogs: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/audit/audit-service', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(true),
}));

describe('month-rollover-service', () => {
  it('correctly calculates previous month period', () => {
    // September -> August
    const sepDate = new Date(2026, 8, 15); // Month index 8 is September
    expect(getPreviousMonthPeriod(sepDate)).toEqual({ year: 2026, month: 8 });

    // January -> December of previous year
    const janDate = new Date(2027, 0, 10); // Month index 0 is January
    expect(getPreviousMonthPeriod(janDate)).toEqual({ year: 2026, month: 12 });
  });

  it('correctly formats human readable month name', () => {
    const formatted = formatMonthName(2026, 9);
    expect(formatted).toContain('September');
    expect(formatted).toContain('2026');
  });

  it('calculates working days excluding Sundays', () => {
    // September 2026 has 30 days, starts on Tuesday, 4 Sundays -> 26 working days
    const workingDaysSep = getWorkingDaysInMonth(2026, 9);
    expect(workingDaysSep).toBe(26);
  });

  it('executes month rollover and archives attendance and worklogs to separate collections', async () => {
    const result = await executeMonthRolloverAndArchive({
      targetYear: 2026,
      targetMonth: 9,
      actor: {
        id: 'SA_TEST',
        name: 'Super Admin',
        role: 'superadmin',
        branch: 'Coimbatore',
      },
    });

    expect(result.success).toBe(true);
    expect(result.previousPeriod.year).toBe(2026);
    expect(result.previousPeriod.month).toBe(9);
    expect(result.currentPeriod.year).toBe(new Date().getFullYear());
    expect(result.branchesUpdated).toEqual(
      expect.arrayContaining(['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad'])
    );
    expect(result.message).toContain('monthly_attendance_archives');
    expect(result.message).toContain('monthly_worklog_archives');
  });
});
