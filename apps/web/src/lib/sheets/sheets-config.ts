/**
 * ============================================================================
 * GSS — GOOGLE SHEETS CONFIGURATION
 * Column mappings, tab name generators, and template definitions
 * for the hybrid per-employee sheet architecture.
 * ============================================================================
 */

// ─── Tab Name Generators ───────────────────────────────────────────────────────

/**
 * Generate the worklog tab name for a staff member.
 * @example getWorklogTabName('EMP001') => 'WL_EMP001'
 */
export function getWorklogTabName(staffId: string): string {
  return `WL_${staffId}`;
}

/**
 * Generate the students tab name for a staff member.
 * @example getStudentTabName('EMP001') => 'STU_EMP001'
 */
export function getStudentTabName(staffId: string): string {
  return `STU_${staffId}`;
}

/**
 * Generate the task allocation tab name for a staff member.
 * @example getTaskTabName('EMP001') => 'TSK_EMP001'
 */
export function getTaskTabName(staffId: string): string {
  return `TSK_${staffId}`;
}

/**
 * Generate the monthly student attendance & task progress tracker tab name for a staff member.
 * @example getAttendanceTrackerTabName('EMP001') => 'ATT_EMP001'
 */
export function getAttendanceTrackerTabName(staffId: string): string {
  return `ATT_${staffId}`;
}

/**
 * Parse a tab name to extract type and staff ID.
 * @example parseTabName('WL_EMP001') => { type: 'worklog', staffId: 'EMP001' }
 */
export function parseTabName(tabName: string): { type: 'worklog' | 'student' | 'task' | 'attendance_tracker' | 'common'; staffId?: string } | null {
  if (tabName.startsWith('WL_')) return { type: 'worklog', staffId: tabName.slice(3) };
  if (tabName.startsWith('STU_')) return { type: 'student', staffId: tabName.slice(4) };
  if (tabName.startsWith('TSK_')) return { type: 'task', staffId: tabName.slice(4) };
  if (tabName.startsWith('ATT_')) return { type: 'attendance_tracker', staffId: tabName.slice(4) };
  if (tabName === '06_Student_Directory') return { type: 'common' };
  if (['02_Staff_Directory', '04_Staff_Attendance', '06_Student_Directory', '08_Candidate_Leads', '09_System_Audit_Log'].includes(tabName)) {
    return { type: 'common' };
  }
  return null;
}

// ─── Sheet Type Enum ───────────────────────────────────────────────────────────

export type SheetType = 'worklog' | 'student' | 'task' | 'attendance_tracker' | 'staff_directory' | 'staff_attendance' | 'branch_student_directory' | 'candidate_leads' | 'audit_log';


// ─── Column Definitions ────────────────────────────────────────────────────────

export const WORKLOG_COLUMNS = [
  'Log_ID',           // 0  — Auto: WL_{Staff_ID}_{YYYYMMDD}
  'Date',             // 1  — DD-MM-YYYY
  'Login_Time',       // 2  — HH:MM AM/PM
  'Logout_Time',      // 3  — HH:MM AM/PM (empty until EOD)
  'Tasks_Completed',  // 4  — Semicolon-separated list
  'Tasks_Pending',    // 5  — Semicolon-separated list
  'Incomplete_Reason',// 6  — Text, only if Tasks_Pending > 0
  'Total_Hours',      // 7  — Auto-calculated from login/logout
  'Verified_By',      // 8  — Admin/Manager who verified
] as const;

export const STUDENT_COLUMNS = [
  'Student_ID',       // 0
  'Student_Name',     // 1
  'College',          // 2
  'Department',       // 3
  'Year',             // 4
  'Email',            // 5
  'Mobile',           // 6
  'Course',           // 7
  'Domain',           // 8
  'Admission_Date',   // 9  — DD-MM-YYYY
  'End_Date',         // 10 — DD-MM-YYYY
  'Fee_Status',       // 11 — Paid / Partial / Pending
  'Project_Status',   // 12 — Not Started / Ongoing / Under Review / Completed
  'Student_Status',   // 13 — Active / Completed / Discontinued
  'Module_Name',      // 14
  'Topic_Covered',    // 15
  'Daily_Score',      // 16 — 1-10
  'Mentor_Remarks',   // 17
  'Attendance_Today', // 18 — Present / Absent / Holiday
] as const;

export const TASK_COLUMNS = [
  'Task_ID',          // 0  — Auto: TSK_{YYYYMMDD}_{seq}
  'Date_Assigned',    // 1  — DD-MM-YYYY
  'Assigned_By_ID',   // 2
  'Assigned_By_Name', // 3
  'Task_Title',       // 4
  'Description',      // 5
  'Priority',         // 6  — Low / Medium / High / Urgent
  'Category',         // 7  — Project / Admin / Training / Support
  'Start_Date',       // 8  — DD-MM-YYYY
  'Due_Date',         // 9  — DD-MM-YYYY
  'Completed_Date',   // 10 — DD-MM-YYYY
  'Status',           // 11 — Assigned / On Progress / Completed / Partially Stopped
  'Progress_Pct',     // 12 — 0-100
  'Remarks',          // 13
] as const;

export const STAFF_DIRECTORY_COLUMNS = [
  'Staff_ID', 'Full_Name', 'Role', 'Designation', 'Department',
  'Email', 'Mobile', 'Joining_Date', 'Reporting_Manager',
  'Account_Status', 'Firebase_UID', 'Updated_At'
] as const;

export const STAFF_ATTENDANCE_COLUMNS = [
  'Attendance_ID', 'Date', 'Day', 'Staff_ID', 'Staff_Name', 'Role',
  'Check_In', 'Check_Out', 'Total_Hours', 'Status', 'Marked_By', 'Timestamp'
] as const;

export const BRANCH_STUDENT_DIRECTORY_COLUMNS = [
  'Student_ID',       // 0
  'Student_Name',     // 1
  'College',          // 2
  'Department',       // 3
  'Year',             // 4
  'Email',            // 5
  'Mobile',           // 6
  'Course',           // 7
  'Domain',           // 8
  'Mentor_Staff_ID',  // 9
  'Mentor_Name',      // 10
  'Admission_Date',   // 11 — DD-MM-YYYY
  'End_Date',         // 12 — DD-MM-YYYY
  'Fee_Status',       // 13 — Paid / Partial / Pending
  'Project_Status',   // 14 — Not Started / Ongoing / Under Review / Completed
  'Student_Status',   // 15 — Active / Completed / Discontinued
] as const;

/**
 * Generate Mon-Fri working days for any given year and month (1-indexed, e.g. 9 for Sept, 10 for Oct).
 */
export function getWorkingDaysForMonth(year: number, month: number): { date: string; day: string }[] {
  const days: { date: string; day: string }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalDays = new Date(year, month, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month - 1, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const yyyy = year;
      const mm = String(month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push({ date: `${yyyy}-${mm}-${dd}`, day: dayNames[dayOfWeek] });
    }
  }
  return days;
}

export const WORKING_DAYS_SEP_2026 = getWorkingDaysForMonth(2026, 9);
export const WORKING_DAYS_OCT_2026 = getWorkingDaysForMonth(2026, 10);

export const ATTENDANCE_TRACKER_COLUMNS = [
  'Intern_Name_Or_Domain',
  'Tracking_Metric_Or_Log_Type',
  ...WORKING_DAYS_SEP_2026.map(w => w.date),
  'Total_Present',
  'Total_Absent',
  'Attendance_Pct',
  'Tasks_Completed',
  'Completion_Pct'
] as const;

export interface StudentTrackerItem {
  studentId?: string;
  studentName: string;
  domain: string;
  startDate?: string;      // "2026-09-01" or "2026-09-22"
  endDate?: string;        // "2026-11-30" or "2026-12-22"
  tenureDays?: number;     // 30, 60, 90, 180
  eligibleDays?: number;   // Active working days within cycle
  attendance: string[];    // Entries: 'Present', 'Absent', 'Holiday', 'On Leave', 'Not Joined', ''
  tasks: string[];         // Entries: 'Completed', 'Not Completed', 'In Progress', 'Holiday', ''
  totalPresent?: number;
  totalAbsent?: number;
  attendancePct?: string;
  tasksCompleted?: number;
  completionPct?: string;
}

export interface AttendanceTrackerData {
  staffId: string;
  monthKey: string;        // e.g. "2026-09" or "2026-10"
  monthTitle: string;
  subTitle: string;
  workingDays: { date: string; day: string }[];
  students: StudentTrackerItem[];
  availableMonths?: { monthKey: string; title: string }[];
}

/**
 * Format ISO date string (YYYY-MM-DD) or DD-MM-YYYY to human-readable format (e.g., "07 Sep 2026").
 */
export function formatHumanReadableDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  return dateStr;
}

/**
 * Check if a date string is strictly before another date string.
 */
export function isDateBefore(d1Str: string, d2Str: string): boolean {
  try {
    const parse = (s: string) => {
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-');
        return new Date(`${y}-${m}-${d}`).getTime();
      }
      return new Date(s).getTime();
    };
    return parse(d1Str) < parse(d2Str);
  } catch {
    return false;
  }
}

/**
 * Check if a date string is strictly after another date string.
 */
export function isDateAfter(d1Str: string, d2Str: string): boolean {
  try {
    const parse = (s: string) => {
      if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
        const [d, m, y] = s.split('-');
        return new Date(`${y}-${m}-${d}`).getTime();
      }
      return new Date(s).getTime();
    };
    return parse(d1Str) > parse(d2Str);
  } catch {
    return false;
  }
}

/**
 * Get the logical attendance state for a given working day based on student start and end dates.
 */
export function getStudentDateEnrollmentState(
  dateStr: string,
  startDate?: string,
  endDate?: string
): 'NOT_JOINED' | 'COURSE_ENDED' | 'ACTIVE' {
  if (startDate && isDateBefore(dateStr, startDate)) {
    return 'NOT_JOINED';
  }
  if (endDate && isDateAfter(dateStr, endDate)) {
    return 'COURSE_ENDED';
  }
  return 'ACTIVE';
}

// ─── Column Index Helpers ──────────────────────────────────────────────────────

/**
 * Get the column index (0-based) for a given column name in a sheet type.
 */
export function getColumnIndex(sheetType: SheetType, columnName: string): number {
  const columns = getColumnsForType(sheetType);
  const idx = columns.indexOf(columnName);
  if (idx === -1) throw new Error(`Column "${columnName}" not found in ${sheetType} sheet`);
  return idx;
}

/**
 * Get the column letter (A, B, ..., AA, etc.) for a given column name.
 */
export function getColumnLetter(sheetType: SheetType, columnName: string): string {
  const idx = getColumnIndex(sheetType, columnName);
  return numberToColumnLetter(idx + 1);
}

/**
 * Get all column definitions for a given sheet type.
 */
export function getColumnsForType(sheetType: SheetType): readonly string[] {
  switch (sheetType) {
    case 'worklog': return WORKLOG_COLUMNS;
    case 'student': return STUDENT_COLUMNS;
    case 'task': return TASK_COLUMNS;
    case 'attendance_tracker': return ATTENDANCE_TRACKER_COLUMNS;
    case 'staff_directory': return STAFF_DIRECTORY_COLUMNS;
    case 'staff_attendance': return STAFF_ATTENDANCE_COLUMNS;
    case 'branch_student_directory': return BRANCH_STUDENT_DIRECTORY_COLUMNS;
    default: throw new Error(`Unknown sheet type: ${sheetType}`);
  }
}

/**
 * Convert 1-based column number to letter (1=A, 2=B, ..., 27=AA).
 */
function numberToColumnLetter(n: number): string {
  let r = '';
  while (n > 0) {
    n--;
    r = String.fromCharCode(65 + (n % 26)) + r;
    n = Math.floor(n / 26);
  }
  return r;
}

// ─── Common Sheet Names ────────────────────────────────────────────────────────

export const COMMON_SHEET_NAMES = {
  STAFF_DIRECTORY: '02_Staff_Directory',
  STAFF_ATTENDANCE: '04_Staff_Attendance',
  STUDENT_DIRECTORY: '06_Student_Directory',
  CANDIDATE_LEADS: '08_Candidate_Leads',
  SYSTEM_AUDIT_LOG: '09_System_Audit_Log',
} as const;

// ─── ID Generators ─────────────────────────────────────────────────────────────

/**
 * Generate a worklog ID for a given staff and date.
 */
export function generateWorklogId(staffId: string, date: string): string {
  const clean = date.replace(/[-/]/g, '');
  return `WL_${staffId}_${clean}`;
}

/**
 * Generate a task ID with auto-incrementing sequence.
 */
export function generateTaskId(seq: number = 1): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  return `TSK_${dateStr}_${String(seq).padStart(3, '0')}`;
}

/**
 * Format a date as DD-MM-YYYY for Google Sheets.
 */
export function formatSheetDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}
