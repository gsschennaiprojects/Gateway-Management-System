import {
  calculateDuration,
  formatStudentDate,
  calculateTenureProgress,
  SEP_WORKING_DAYS,
} from './student';

describe('Student Domain Calculations & Tenure Logic', () => {
  describe('calculateDuration', () => {
    it('calculates week durations correctly for short tenures', () => {
      expect(calculateDuration('2026-09-01', '2026-09-15')).toBe('2 Weeks');
      expect(calculateDuration('2026-09-01', '2026-09-08')).toBe('1 Week');
    });

    it('calculates month durations correctly for standard programs', () => {
      expect(calculateDuration('2026-07-01', '2026-09-30')).toBe('3 Months');
      expect(calculateDuration('2026-01-01', '2026-06-30')).toBe('6 Months');
    });

    it('returns empty string on invalid inputs', () => {
      expect(calculateDuration('', '')).toBe('');
      expect(calculateDuration('invalid', 'date')).toBe('');
      expect(calculateDuration('2026-09-30', '2026-09-01')).toBe(''); // end before start
    });
  });

  describe('formatStudentDate', () => {
    it('formats YYYY-MM-DD to localized date display', () => {
      const formatted = formatStudentDate('2026-09-12');
      expect(formatted).toContain('Sep');
      expect(formatted).toContain('2026');
    });

    it('returns fallback dash for undefined dates', () => {
      expect(formatStudentDate(undefined)).toBe('—');
      expect(formatStudentDate('')).toBe('—');
    });
  });

  describe('calculateTenureProgress', () => {
    it('computes exact days and percentage relative to reference date', () => {
      const res = calculateTenureProgress('2026-07-01', '2026-09-30');
      expect(res.totalDays).toBeGreaterThan(80);
      expect(res.elapsedDays).toBeGreaterThan(0);
      expect(res.remainingDays).toBeGreaterThan(0);
      expect(res.percentage).toBeGreaterThanOrEqual(0);
      expect(res.percentage).toBeLessThanOrEqual(100);
    });

    it('handles fallback defaults gracefully for bad inputs', () => {
      const fallback = calculateTenureProgress('invalid', 'dates');
      expect(fallback.totalDays).toBe(90);
      expect(fallback.percentage).toBe(50);
    });
  });

  describe('SEP_WORKING_DAYS', () => {
    it('contains exactly 26 working days for September 2026 (omitting Sundays)', () => {
      expect(SEP_WORKING_DAYS.length).toBe(26);
      expect(SEP_WORKING_DAYS).not.toContain(6);  // Sunday Sep 6
      expect(SEP_WORKING_DAYS).not.toContain(13); // Sunday Sep 13
      expect(SEP_WORKING_DAYS).not.toContain(20); // Sunday Sep 20
      expect(SEP_WORKING_DAYS).not.toContain(27); // Sunday Sep 27
    });
  });
});
