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

export interface WorkingTimeCalculation {
  totalMinutes: number;
  hours: number;
  minutes: number;
  decimalHours: number;   // e.g. 9.25
  formatted: string;      // e.g. "9 hrs 15 mins"
  shortFormatted: string; // e.g. "9h 15m"
  isFullDay: boolean;     // >= 8.5 hours standard threshold
}

/**
 * Get dynamic live date and time details based on the user's system clock.
 */
export function getLiveDateInfo(referenceDate?: Date): LiveDateInfo {
  const d = referenceDate || new Date();
  
  const yyyy = d.getFullYear();
  const monthNum = d.getMonth() + 1;
  const dayNum = d.getDate();
  const mm = String(monthNum).padStart(2, '0');
  const dd = String(dayNum).padStart(2, '0');
  
  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
  const shortDay = d.toLocaleDateString('en-US', { weekday: 'short' });
  const formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const fullDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

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
 * Calculate total working time between login and logout times.
 */
export function calculateWorkingTime(loginTime?: string | null, logoutTime?: string | null): WorkingTimeCalculation | null {
  const loginMinutes = parseTimeString(loginTime);
  const logoutMinutes = parseTimeString(logoutTime);

  if (loginMinutes === null || logoutMinutes === null) return null;

  let diffMinutes = logoutMinutes - loginMinutes;
  // If logout spans past midnight
  if (diffMinutes < 0) {
    diffMinutes += 1440;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const decimalHours = Math.round((diffMinutes / 60) * 100) / 100;

  const formatted = `${hours} hr${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min${minutes !== 1 ? 's' : ''}` : ''}`;
  const shortFormatted = `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  const isFullDay = decimalHours >= 8.5;

  return {
    totalMinutes: diffMinutes,
    hours,
    minutes,
    decimalHours,
    formatted,
    shortFormatted,
    isFullDay,
  };
}

/**
 * Calculate live elapsed working time from login time until right now.
 */
export function calculateLiveElapsedWorkingTime(loginTime?: string | null): { hours: number; minutes: number; formatted: string; shortFormatted: string } | null {
  const loginMinutes = parseTimeString(loginTime);
  if (loginMinutes === null) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let diff = currentMinutes - loginMinutes;
  if (diff < 0) diff += 1440;

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  return {
    hours,
    minutes,
    formatted: `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`,
    shortFormatted: `${hours}h ${minutes}m`,
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
