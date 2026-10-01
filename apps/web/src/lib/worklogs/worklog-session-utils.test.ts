import {
  evaluateEntryPunctuality,
  calculateWorkingTime,
  parseTimeString,
  formatMinutesTo12Hour,
} from './worklog-session-utils';

describe('Worklog & Attendance Precision Utilities', () => {
  describe('evaluateEntryPunctuality', () => {
    it('recognizes arrival before shift start as on-time', () => {
      const result = evaluateEntryPunctuality('08:50 AM');
      expect(result.isLate).toBe(false);
      expect(result.minutesLate).toBe(0);
      expect(result.entryStatus).toBe('on_time');
    });

    it('recognizes arrival within the 30-min grace period (up to 09:30 AM) as on-time', () => {
      const result = evaluateEntryPunctuality('09:30 AM');
      expect(result.isLate).toBe(false);
      expect(result.minutesLate).toBe(0);
      expect(result.entryStatus).toBe('on_time');
    });

    it('correctly flags arrival after grace period as late and computes minutes late', () => {
      const result = evaluateEntryPunctuality('09:45 AM');
      expect(result.isLate).toBe(true);
      expect(result.minutesLate).toBe(15);
      expect(result.entryStatus).toBe('late');
      expect(result.statusLabel).toBe('Late by 15 mins');
    });

    it('correctly calculates 45 minutes late for 10:15 AM arrival', () => {
      const result = evaluateEntryPunctuality('10:15 AM');
      expect(result.isLate).toBe(true);
      expect(result.minutesLate).toBe(45);
      expect(result.entryStatus).toBe('late');
    });

    it('flags post-1:00 PM arrival as half-day session entry', () => {
      const result = evaluateEntryPunctuality('01:30 PM');
      expect(result.isLate).toBe(true);
      expect(result.entryStatus).toBe('half_day');
      expect(result.statusLabel).toContain('Half-Day Session');
    });
  });

  describe('calculateWorkingTime', () => {
    it('credits full day on on-time arrival with >= 7.5 hours worked', () => {
      const result = calculateWorkingTime('09:15 AM', '05:45 PM'); // 8.5 hours
      expect(result).not.toBeNull();
      expect(result!.isFullDay).toBe(true);
      expect(result!.isHalfDay).toBe(false);
      expect(result!.attendanceStatus).toBe('present');
      expect(result!.decimalHours).toBe(8.5);
    });

    it('credits full day with late status when staff arrives late but completes shift', () => {
      const result = calculateWorkingTime('09:50 AM', '06:00 PM'); // 8 hrs 10 mins (8.17 hrs)
      expect(result).not.toBeNull();
      expect(result!.isFullDay).toBe(true);
      expect(result!.attendanceStatus).toBe('late');
    });

    it('credits half day when worked between 4.0 and 7.5 hours', () => {
      const result = calculateWorkingTime('09:00 AM', '02:00 PM'); // 5.0 hours
      expect(result).not.toBeNull();
      expect(result!.isFullDay).toBe(false);
      expect(result!.isHalfDay).toBe(true);
      expect(result!.attendanceStatus).toBe('half_day');
    });

    it('flags under 4 hours as absent / short attendance', () => {
      const result = calculateWorkingTime('09:00 AM', '11:30 AM'); // 2.5 hours
      expect(result).not.toBeNull();
      expect(result!.isFullDay).toBe(false);
      expect(result!.isHalfDay).toBe(false);
      expect(result!.attendanceStatus).toBe('absent');
    });
  });

  describe('parseTimeString and formatMinutesTo12Hour', () => {
    it('accurately parses 12-hour AM and PM timestamps', () => {
      expect(parseTimeString('09:00 AM')).toBe(540);
      expect(parseTimeString('12:00 PM')).toBe(720);
      expect(parseTimeString('01:30 PM')).toBe(810);
      expect(parseTimeString('11:59 PM')).toBe(1439);
    });

    it('accurately formats minutes to 12-hour AM/PM string', () => {
      expect(formatMinutesTo12Hour(540)).toBe('09:00 AM');
      expect(formatMinutesTo12Hour(720)).toBe('12:00 PM');
      expect(formatMinutesTo12Hour(810)).toBe('01:30 PM');
    });
  });
});
