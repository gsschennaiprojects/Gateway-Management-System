/**
 * Worklog & Daily Session Utilities
 * Provides live date/day formatting, time parsing, working hours calculation,
 * and seamless point-by-point <-> semicolon-separated string serialization.
 */

export interface LiveDateInfo {
  isoDate: string;        // "2026-09-23"
  sheetDate: string;      // "23-09-2026"
  dayOfWeek: string;      // "Wednesday"
  shortDay: string;       // "Wed"
  formattedDate: string;  // "23 Sep 2026"
  fullDate: string;       // "Wednesday, September 23, 2026"
  monthName: string;      // "September 2026"
  currentTime: string;    // "01:15 PM"
  year: number;           // 2026
  month: number;          // 9 (1-indexed)
  day: number;            // 23
}

export interface PunctualityEvaluation {
  isLate: boolean;
  minutesLate: number;
  entryStatus: 'on_time' | 'late' | 'half_day';
  statusLabel: string;
}

export interface WorkingTimeCalculation {
  totalMinutes: number;
  hours: number;
  minutes: number;
  decimalHours: number;   // e.g. 9.25
  formatted: string;      // e.g. "9 hrs 15 mins"
  shortFormatted: string; // e.g. "9h 15m"
  isFullDay: boolean;     // >= 7.5 hours standard threshold
  isHalfDay: boolean;     // >= 4.0 hours and < 7.5 hours
  attendanceStatus: 'present' | 'late' | 'half_day' | 'absent';
}

/**
 * Get dynamic live date and time details based on the user's system clock.
 */
export function getLiveDateInfo(referenceDate?: Date): LiveDateInfo {
  const d = referenceDate || new Date();
  const timeZone = 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  const yyyy = Number(part('year'));
  const monthNum = Number(part('month'));
  const dayNum = Number(part('day'));
  const mm = String(monthNum).padStart(2, '0');
  const dd = String(dayNum).padStart(2, '0');
  
  const dayOfWeek = d.toLocaleDateString('en-US', { timeZone, weekday: 'long' });
  const shortDay = d.toLocaleDateString('en-US', { timeZone, weekday: 'short' });
  const formattedDate = d.toLocaleDateString('en-GB', { timeZone, day: '2-digit', month: 'short', year: 'numeric' });
  const fullDate = d.toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const monthName = d.toLocaleDateString('en-US', { timeZone, month: 'long', year: 'numeric' });
  const currentTime = d.toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true });

  return {
    isoDate: `${yyyy}-${mm}-${dd}`,
    sheetDate: `${dd}-${mm}-${yyyy}`,
    dayOfWeek,
    shortDay,
    formattedDate,
    fullDate,
    monthName,
    currentTime,
    year: yyyy,
    month: monthNum,
    day: dayNum,
  };
}

/**
 * Parse any 12-hour (e.g. "09:15 AM", "9:00 PM") or 24-hour (e.g. "14:30") time string
 * into total minutes from midnight. Returns null if invalid.
 */
export function parseTimeString(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  // Match 12-hour format: "09:15 AM" or "9:00PM"
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3]?.toUpperCase();

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Format total minutes from midnight into 12-hour AM/PM string (e.g. "09:15 AM").
 */
export function formatMinutesTo12Hour(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  let hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
}

/**
 * Evaluate entry time punctuality against GSS office shift policy:
 * - 09:00 AM standard arrival.
 * - Grace period up to 09:30 AM (inclusive) -> On Time.
 * - 09:31 AM to 01:00 PM -> Late with calculated minutes late.
 * - After 01:00 PM -> Half-day entry session.
 */
export function evaluateEntryPunctuality(timeStr?: string | null): PunctualityEvaluation {
  const minutes = parseTimeString(timeStr);
  if (minutes === null) {
    return { isLate: false, minutesLate: 0, entryStatus: 'on_time', statusLabel: 'On Time' };
  }

  const graceMinutes = 570; // 09:30 AM (9*60 + 30)
  const afternoonMinutes = 780; // 01:00 PM (13*60)

  if (minutes <= graceMinutes) {
    return {
      isLate: false,
      minutesLate: 0,
      entryStatus: 'on_time',
      statusLabel: 'On Time (Within Grace Period)',
    };
  } else if (minutes <= afternoonMinutes) {
    const lateBy = minutes - graceMinutes;
    return {
      isLate: true,
      minutesLate: lateBy,
      entryStatus: 'late',
      statusLabel: `Late by ${lateBy} min${lateBy !== 1 ? 's' : ''}`,
    };
  } else {
    const lateBy = minutes - graceMinutes;
    return {
      isLate: true,
      minutesLate: lateBy,
      entryStatus: 'half_day',
      statusLabel: 'Afternoon Entry (Half-Day Session)',
    };
  }
}

/**
 * Computes calendar days difference between two ISO dates (YYYY-MM-DD).
 */
export function differenceInCalendarDays(startDateStr?: string | null, endDateStr?: string | null): number {
  if (!startDateStr || !endDateStr) return 0;
  try {
    const d1 = new Date(startDateStr + 'T00:00:00Z').getTime();
    const d2 = new Date(endDateStr + 'T00:00:00Z').getTime();
    if (isNaN(d1) || isNaN(d2)) return 0;
    return Math.round((d2 - d1) / (86400 * 1000));
  } catch {
    return 0;
  }
}

/**
 * Returns an array of YYYY-MM-DD date strings for all dates from startDate to endDate inclusive.
 */
export function getDatesBetween(startDateStr?: string | null, endDateStr?: string | null): string[] {
  if (!startDateStr || !endDateStr) return [];
  const results: string[] = [];
  try {
    const curr = new Date(startDateStr + 'T00:00:00Z');
    const end = new Date(endDateStr + 'T00:00:00Z');
    if (isNaN(curr.getTime()) || isNaN(end.getTime())) return [startDateStr];
    // Safety cap at 60 days to prevent runaway loops on malformed inputs
    let count = 0;
    while (curr.getTime() <= end.getTime() && count < 60) {
      const yyyy = curr.getUTCFullYear();
      const mm = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(curr.getUTCDate()).padStart(2, '0');
      results.push(`${yyyy}-${mm}-${dd}`);
      curr.setUTCDate(curr.getUTCDate() + 1);
      count++;
    }
  } catch {
    return [startDateStr];
  }
  return results.length > 0 ? results : [startDateStr];
}

/**
 * Calculate total working time between login and logout times.
 * Supports multi-day continuous sessions (e.g. login on Oct 1, logout on Oct 3).
 * Integrates punctuality and minimum hours thresholds:
 * - Full-day: >= 7.5 hours (or >= 450 minutes)
 * - Half-day: >= 4.0 hours and < 7.5 hours
 * - Incomplete/Absent: < 4.0 hours
 */
export function calculateWorkingTime(
  loginTime?: string | null,
  logoutTime?: string | null,
  startDate?: string | null,
  endDate?: string | null
): WorkingTimeCalculation | null {
  const loginMinutes = parseTimeString(loginTime);
  const logoutMinutes = parseTimeString(logoutTime);

  if (loginMinutes === null || logoutMinutes === null) return null;

  let diffMinutes = 0;
  const daysDiff = (startDate && endDate) ? differenceInCalendarDays(startDate, endDate) : 0;

  if (daysDiff > 0) {
    // Multi-day active session spanning calendar days
    diffMinutes = (daysDiff * 1440) - loginMinutes + logoutMinutes;
    if (diffMinutes < 0) diffMinutes = 0;
  } else {
    diffMinutes = logoutMinutes - loginMinutes;
    // If logout spans past midnight in a single overnight shift
    if (diffMinutes < 0) {
      diffMinutes += 1440;
    }
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const decimalHours = Math.round((diffMinutes / 60) * 100) / 100;

  let formatted = '';
  let shortFormatted = '';

  if (daysDiff > 0) {
    const remHours = hours % 24;
    formatted = `${daysDiff} day${daysDiff > 1 ? 's' : ''} ${remHours} hr${remHours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min${minutes !== 1 ? 's' : ''}` : ''} (${decimalHours}h total)`;
    shortFormatted = `${daysDiff}d ${remHours}h ${minutes}m`;
  } else {
    formatted = `${hours} hr${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min${minutes !== 1 ? 's' : ''}` : ''}`;
    shortFormatted = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }
  
  const isFullDay = decimalHours >= 7.5;
  const isHalfDay = decimalHours >= 4.0 && decimalHours < 7.5;

  const punctuality = evaluateEntryPunctuality(loginTime);
  let attendanceStatus: 'present' | 'late' | 'half_day' | 'absent' = 'present';

  if (daysDiff > 0) {
    // Continuous multi-day attendance is credited as present
    attendanceStatus = 'present';
  } else if (!isFullDay && !isHalfDay) {
    attendanceStatus = 'absent';
  } else if (isHalfDay || punctuality.entryStatus === 'half_day') {
    attendanceStatus = 'half_day';
  } else if (punctuality.isLate) {
    attendanceStatus = 'late';
  } else {
    attendanceStatus = 'present';
  }

  return {
    totalMinutes: diffMinutes,
    hours,
    minutes,
    decimalHours,
    formatted,
    shortFormatted,
    isFullDay: daysDiff > 0 ? true : isFullDay,
    isHalfDay: daysDiff > 0 ? false : isHalfDay,
    attendanceStatus,
  };
}

/**
 * Calculate live elapsed working time from login time until right now,
 * supporting multi-day continuous work sessions.
 */
export function calculateLiveElapsedWorkingTime(
  loginTime?: string | null,
  startDate?: string | null
): { hours: number; minutes: number; days: number; formatted: string; shortFormatted: string } | null {
  const loginMinutes = parseTimeString(loginTime);
  if (loginMinutes === null) return null;

  const live = getLiveDateInfo();
  const currentMinutes = parseTimeString(live.currentTime) ?? (new Date().getHours() * 60 + new Date().getMinutes());
  const daysDiff = startDate ? differenceInCalendarDays(startDate, live.isoDate) : 0;

  let diff = 0;
  if (daysDiff > 0) {
    diff = (daysDiff * 1440) - loginMinutes + currentMinutes;
    if (diff < 0) diff = 0;
  } else {
    diff = currentMinutes - loginMinutes;
    if (diff < 0) diff += 1440;
  }

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  const remHours = hours % 24;

  let formatted = '';
  let shortFormatted = '';

  if (daysDiff > 0) {
    formatted = `${daysDiff} day${daysDiff > 1 ? 's' : ''} ${remHours} hr${remHours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    shortFormatted = `${daysDiff}d ${remHours}h ${minutes}m`;
  } else {
    formatted = `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    shortFormatted = `${hours}h ${minutes}m`;
  }

  return {
    hours,
    minutes,
    days: daysDiff,
    formatted,
    shortFormatted,
  };
}

/**
 * Serializes an array of task points into a clean semicolon-separated string
 * for storage in Google Sheets (e.g. 03_Daily_Worklogs and staff WL_<ID> sheets).
 */
export function serializeTasks(tasks: string[]): string {
  if (!Array.isArray(tasks)) return '';
  return tasks
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .join('; ');
}

/**
 * Parses semicolon-separated strings (or multiline text / arrays) from Google Sheets or API
 * into an array of clean, discrete task point strings for the point-by-point UI.
 */
export function parseTasks(input?: string | string[] | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(t => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  }
  if (typeof input !== 'string') return [];

  // Split by semicolon OR newline to support both storage formats and multiline pastes
  return input
    .split(/[;\r\n]+/)
    .map(t => t.trim())
    .filter(Boolean);
}
