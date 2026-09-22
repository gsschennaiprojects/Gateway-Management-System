/**
 * ============================================================================
 * GSS — GOOGLE SHEETS API SERVICE (Server-Side Only)
 * Rate-limited CRUD operations for per-employee and common sheets.
 * 
 * This service runs ONLY on the server (Next.js API routes / Server Actions).
 * It uses the Service Account credentials for authentication.
 * ============================================================================
 */

import { google, type sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import {
  getWorklogTabName,
  getStudentTabName,
  getTaskTabName,
  getAttendanceTrackerTabName,
  getColumnsForType,
  WORKING_DAYS_SEP_2026,
  WORKING_DAYS_OCT_2026,
  getWorkingDaysForMonth,
  isDateBefore,
  isDateAfter,
  COMMON_SHEET_NAMES,
  type SheetType,
  type StudentTrackerItem,
  type AttendanceTrackerData,
} from './sheets-config';

// ─── Service Account Setup ─────────────────────────────────────────────────────

const SERVICE_ACCOUNT_KEY_PATH = path.join(process.cwd(), '../../management-system-509313-306faa5b0c5e.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let sheetsApiInstance: sheets_v4.Sheets | null = null;

/**
 * Get or create the Google Sheets API client.
 */
async function getSheetsApi(): Promise<sheets_v4.Sheets> {
  if (sheetsApiInstance) return sheetsApiInstance;

  // First check if credentials are provided in an environment variable
  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      const credentials = JSON.parse(envJson);
      const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
      sheetsApiInstance = google.sheets({ version: 'v4', auth });
      return sheetsApiInstance;
    } catch {
      // Fall through to filesystem lookup
    }
  }

  // Try multiple paths for the service account key
  const possiblePaths = [
    SERVICE_ACCOUNT_KEY_PATH,
    path.join(process.cwd(), 'management-system-509313-306faa5b0c5e.json'),
    path.join(process.cwd(), '../../../management-system-509313-306faa5b0c5e.json'),
  ];

  let keyPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      keyPath = p;
      break;
    }
  }

  if (!keyPath) {
    throw new Error('Service account key file not found. Check SERVICE_ACCOUNT_KEY_PATH or set GOOGLE_SERVICE_ACCOUNT_JSON.');
  }

  const keyFile = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ keyPath, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials: keyFile, scopes: SCOPES });
  sheetsApiInstance = google.sheets({ version: 'v4', auth });
  return sheetsApiInstance;
}

// ─── Rate Limiter ──────────────────────────────────────────────────────────────

let lastCallTime = 0;
const MIN_INTERVAL_MS = 1100; // ~54 calls/min, well under the 60/min limit

async function rateLimitedCall<T>(fn: () => Promise<T>, label = ''): Promise<T> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Enforce minimum interval between calls
      const now = Date.now();
      const elapsed = now - lastCallTime;
      if (elapsed < MIN_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
      }
      lastCallTime = Date.now();

      return await fn();
    } catch (err: unknown) {
      const error = err as { message?: string; code?: number };
      const isQuota = error.message && (
        error.message.includes('Quota exceeded') ||
        error.message.includes('rate limit') ||
        error.code === 429
      );
      if (isQuota && attempt < MAX_RETRIES) {
        const waitMs = Math.pow(2, attempt + 2) * 5000; // 20s, 40s, 80s
        console.warn(`[SheetsService] Rate limit hit (${label}). Retrying in ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`[SheetsService] Max retries exceeded for: ${label}`);
}

// ─── Core Read/Write Operations ────────────────────────────────────────────────

/**
 * Ensure a tab exists in the spreadsheet. If missing, creates it and writes the header row.
 */
export async function ensureTabExists(
  spreadsheetId: string,
  tabName: string,
  headers: readonly string[] | string[]
): Promise<void> {
  const api = await getSheetsApi();
  try {
    const meta = await rateLimitedCall(
      () => api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' }),
      `check tab ${tabName}`
    );
    const existing = meta.data.sheets?.some(s => s.properties?.title === tabName);
    if (!existing) {
      await rateLimitedCall(
        () => api.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: tabName }
              }
            }]
          }
        }),
        `create tab ${tabName}`
      );
      if (headers && headers.length > 0) {
        await rateLimitedCall(
          () => api.spreadsheets.values.update({
            spreadsheetId,
            range: `'${tabName}'!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [Array.from(headers)] }
          }),
          `write headers ${tabName}`
        );
      }
    }
  } catch (err) {
    console.warn(`[SheetsService] Note checking/creating tab ${tabName}:`, err);
  }
}

/**
 * Read all rows from a specific tab in a spreadsheet.
 * Returns rows as arrays of strings (excluding the header row).
 */
export async function readSheet(
  spreadsheetId: string,
  tabName: string,
  range?: string // e.g. 'A2:I100' — defaults to entire sheet
): Promise<string[][]> {
  const api = await getSheetsApi();
  const fullRange = range ? `'${tabName}'!${range}` : `'${tabName}'`;

  try {
    const resp = await rateLimitedCall(
      () => api.spreadsheets.values.get({ spreadsheetId, range: fullRange }),
      `read ${tabName}`
    );
    return resp.data.values || [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unable to parse range') || msg.includes('not found')) {
      return [];
    }
    throw err;
  }
}

/**
 * Append a new row to a tab.
 */
export async function appendRow(
  spreadsheetId: string,
  tabName: string,
  values: (string | number)[]
): Promise<void> {
  const api = await getSheetsApi();
  await rateLimitedCall(
    () => api.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    }),
    `append ${tabName}`
  );
}

/**
 * Update a specific row (by row number, 1-indexed).
 */
export async function updateRow(
  spreadsheetId: string,
  tabName: string,
  rowNumber: number,
  values: (string | number)[],
  colCount: number
): Promise<void> {
  const api = await getSheetsApi();
  const colLetter = numberToColLetter(colCount);
  await rateLimitedCall(
    () => api.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tabName}'!A${rowNumber}:${colLetter}${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    }),
    `update ${tabName} row ${rowNumber}`
  );
}

/**
 * Find a row by matching a value in a specific column.
 * Returns { rowIndex, rowNumber, data } or null.
 */
export async function findRow(
  spreadsheetId: string,
  tabName: string,
  columnIndex: number,
  searchValue: string
): Promise<{ rowIndex: number; rowNumber: number; data: string[] } | null> {
  const rows = await readSheet(spreadsheetId, tabName);
  // rows[0] is the header, data starts at rows[1]
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][columnIndex] === searchValue) {
      return { rowIndex: i, rowNumber: i + 1, data: rows[i] }; // +1 for 1-indexed sheet rows
    }
  }
  return null;
}

// ─── Typed Worklog Operations ──────────────────────────────────────────────────

export interface WorklogRow {
  logId: string;
  date: string;
  loginTime: string;
  logoutTime: string;
  tasksCompleted: string;
  tasksPending: string;
  incompleteReason: string;
  totalHours: string;
  verifiedBy: string;
}

/**
 * Read all worklogs for a staff member.
 */
export async function getStaffWorklogs(
  spreadsheetId: string,
  staffId: string
): Promise<WorklogRow[]> {
  const tabName = getWorklogTabName(staffId);
  const rows = await readSheet(spreadsheetId, tabName);

  // Skip header row
  return rows.slice(1).map(row => ({
    logId: row[0] || '',
    date: row[1] || '',
    loginTime: row[2] || '',
    logoutTime: row[3] || '',
    tasksCompleted: row[4] || '',
    tasksPending: row[5] || '',
    incompleteReason: row[6] || '',
    totalHours: row[7] || '',
    verifiedBy: row[8] || '',
  }));
}

/**
 * Add or update a worklog entry for a date.
 */
export async function upsertWorklog(
  spreadsheetId: string,
  staffId: string,
  worklog: WorklogRow
): Promise<void> {
  const tabName = getWorklogTabName(staffId);
  const columns = getColumnsForType('worklog');
  await ensureTabExists(spreadsheetId, tabName, columns);
  const values = [
    worklog.logId,
    worklog.date,
    worklog.loginTime,
    worklog.logoutTime,
    worklog.tasksCompleted,
    worklog.tasksPending,
    worklog.incompleteReason,
    worklog.totalHours,
    worklog.verifiedBy,
  ];

  // Try to find existing row by logId
  const existing = await findRow(spreadsheetId, tabName, 0, worklog.logId);
  if (existing) {
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, columns.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

// ─── Typed Student Operations ──────────────────────────────────────────────────

export interface StudentRow {
  studentId: string;
  studentName: string;
  college: string;
  department: string;
  year: string;
  email: string;
  mobile: string;
  course: string;
  domain: string;
  admissionDate: string;
  endDate: string;
  feeStatus: string;
  projectStatus: string;
  studentStatus: string;
  moduleName: string;
  topicCovered: string;
  dailyScore: string;
  mentorRemarks: string;
  attendanceToday: string;
}

/**
 * Read all students for a staff member (mentor).
 */
export async function getMentorStudents(
  spreadsheetId: string,
  staffId: string
): Promise<StudentRow[]> {
  const tabName = getStudentTabName(staffId);
  const rows = await readSheet(spreadsheetId, tabName);

  return rows.slice(1).map(row => ({
    studentId: row[0] || '',
    studentName: row[1] || '',
    college: row[2] || '',
    department: row[3] || '',
    year: row[4] || '',
    email: row[5] || '',
    mobile: row[6] || '',
    course: row[7] || '',
    domain: row[8] || '',
    admissionDate: row[9] || '',
    endDate: row[10] || '',
    feeStatus: row[11] || '',
    projectStatus: row[12] || '',
    studentStatus: row[13] || '',
    moduleName: row[14] || '',
    topicCovered: row[15] || '',
    dailyScore: row[16] || '',
    mentorRemarks: row[17] || '',
    attendanceToday: row[18] || '',
  }));
}

/**
 * Add or update a student record in a mentor's tab.
 */
export async function upsertStudent(
  spreadsheetId: string,
  staffId: string,
  student: StudentRow
): Promise<void> {
  const tabName = getStudentTabName(staffId);
  const columns = getColumnsForType('student');
  await ensureTabExists(spreadsheetId, tabName, columns);
  const values = [
    student.studentId, student.studentName, student.college,
    student.department, student.year, student.email, student.mobile,
    student.course, student.domain, student.admissionDate,
    student.endDate, student.feeStatus, student.projectStatus,
    student.studentStatus, student.moduleName, student.topicCovered,
    student.dailyScore, student.mentorRemarks, student.attendanceToday,
  ];

  const existing = await findRow(spreadsheetId, tabName, 0, student.studentId);
  if (existing) {
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, columns.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

// ─── Typed Task Operations ─────────────────────────────────────────────────────

export interface TaskRow {
  taskId: string;
  dateAssigned: string;
  assignedById: string;
  assignedByName: string;
  taskTitle: string;
  description: string;
  priority: string;
  category: string;
  startDate: string;
  dueDate: string;
  completedDate: string;
  status: string;
  progressPct: string;
  remarks: string;
}

/**
 * Read all tasks for a staff member.
 */
export async function getStaffTasks(
  spreadsheetId: string,
  staffId: string
): Promise<TaskRow[]> {
  const tabName = getTaskTabName(staffId);
  const rows = await readSheet(spreadsheetId, tabName);

  return rows.slice(1).map(row => ({
    taskId: row[0] || '',
    dateAssigned: row[1] || '',
    assignedById: row[2] || '',
    assignedByName: row[3] || '',
    taskTitle: row[4] || '',
    description: row[5] || '',
    priority: row[6] || '',
    category: row[7] || '',
    startDate: row[8] || '',
    dueDate: row[9] || '',
    completedDate: row[10] || '',
    status: row[11] || '',
    progressPct: row[12] || '',
    remarks: row[13] || '',
  }));
}

/**
 * Add or update a task in a staff member's tab.
 */
export async function upsertTask(
  spreadsheetId: string,
  staffId: string,
  task: TaskRow
): Promise<void> {
  const tabName = getTaskTabName(staffId);
  const columns = getColumnsForType('task');
  await ensureTabExists(spreadsheetId, tabName, columns);
  const values = [
    task.taskId, task.dateAssigned, task.assignedById, task.assignedByName,
    task.taskTitle, task.description, task.priority, task.category,
    task.startDate, task.dueDate, task.completedDate, task.status,
    task.progressPct, task.remarks,
  ];

  const existing = await findRow(spreadsheetId, tabName, 0, task.taskId);
  if (existing) {
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, columns.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

// ─── Common Sheet Operations ───────────────────────────────────────────────────

/**
 * Read the Staff Directory (common sheet) for a branch.
 */
export async function readStaffDirectory(spreadsheetId: string): Promise<string[][]> {
  return readSheet(spreadsheetId, COMMON_SHEET_NAMES.STAFF_DIRECTORY);
}

/**
 * Read Staff Attendance (common sheet) for a branch, optionally filtered by date.
 */
export async function readStaffAttendance(spreadsheetId: string): Promise<string[][]> {
  return readSheet(spreadsheetId, COMMON_SHEET_NAMES.STAFF_ATTENDANCE);
}

/**
 * Append an attendance record to the common attendance sheet.
 */
export async function appendAttendanceRecord(
  spreadsheetId: string,
  values: (string | number)[]
): Promise<void> {
  await appendRow(spreadsheetId, COMMON_SHEET_NAMES.STAFF_ATTENDANCE, values);
}

export interface BranchStudentRow {
  studentId: string;
  studentName: string;
  college: string;
  department: string;
  year: string;
  email: string;
  mobile: string;
  course: string;
  domain: string;
  mentorStaffId: string;
  mentorName: string;
  admissionDate: string;
  endDate: string;
  feeStatus: string;
  projectStatus: string;
  studentStatus: string;
}

/**
 * Read the Branch-wide Student Directory (06_Student_Directory) containing all staff students.
 */
export async function readBranchStudentDirectory(
  spreadsheetId: string
): Promise<BranchStudentRow[]> {
  const rows = await readSheet(spreadsheetId, COMMON_SHEET_NAMES.STUDENT_DIRECTORY);
  if (!rows || rows.length <= 1) return [];

  return rows.slice(1).map(row => ({
    studentId: row[0] || '',
    studentName: row[1] || '',
    college: row[2] || '',
    department: row[3] || '',
    year: row[4] || '',
    email: row[5] || '',
    mobile: row[6] || '',
    course: row[7] || '',
    domain: row[8] || '',
    mentorStaffId: row[9] || '',
    mentorName: row[10] || '',
    admissionDate: row[11] || '',
    endDate: row[12] || '',
    feeStatus: row[13] || '',
    projectStatus: row[14] || '',
    studentStatus: row[15] || '',
  }));
}

/**
 * Add or update a student record in the central Branch Student Directory.
 */
export async function upsertBranchStudent(
  spreadsheetId: string,
  student: BranchStudentRow
): Promise<void> {
  const tabName = COMMON_SHEET_NAMES.STUDENT_DIRECTORY;
  const columns = getColumnsForType('branch_student_directory');
  await ensureTabExists(spreadsheetId, tabName, columns);
  const values = [
    student.studentId, student.studentName, student.college,
    student.department, student.year, student.email, student.mobile,
    student.course, student.domain, student.mentorStaffId, student.mentorName,
    student.admissionDate, student.endDate, student.feeStatus,
    student.projectStatus, student.studentStatus
  ];

  const existing = await findRow(spreadsheetId, tabName, 0, student.studentId);
  if (existing) {
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, columns.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

// ─── Monthly Attendance & Task Tracker Matrix ─────────────────────────────────

/**
 * Read the monthly attendance & task tracker matrix for a staff member.
 * Supports multi-month vertical stacking separated by 4-row gaps.
 */
export async function getAttendanceTracker(
  spreadsheetId: string,
  staffId: string,
  targetMonthKey?: string
): Promise<AttendanceTrackerData> {
  const tabName = getAttendanceTrackerTabName(staffId);
  const rows = await readSheet(spreadsheetId, tabName);

  const availableFallbackMonths = [
    { monthKey: '2026-09', title: 'September 2026' },
    { monthKey: '2026-10', title: 'October 2026' },
  ];

  if (!rows || rows.length < 4) {
    const isOct = targetMonthKey === '2026-10';
    return {
      staffId,
      monthKey: isOct ? '2026-10' : '2026-09',
      monthTitle: isOct ? 'MONTHLY ATTENDANCE & TASK TRACKER — OCTOBER 2026' : 'MONTHLY ATTENDANCE & TASK TRACKER — SEPTEMBER 2026',
      subTitle: isOct ? 'Cohort: Q4 2026 | Mon-Fri Tracking | Rolling Monthly Lifecycle' : 'Cohort: Q3-Q4 2026 | Mon-Fri Tracking | Dropdown Validation',
      workingDays: isOct ? [...WORKING_DAYS_OCT_2026] : [...WORKING_DAYS_SEP_2026],
      students: [],
      availableMonths: availableFallbackMonths,
    };
  }

  // Scan all rows to discover stacked month blocks
  interface BlockMeta {
    startRow: number;
    monthKey: string;
    monthTitle: string;
    subTitle: string;
  }
  const blocks: BlockMeta[] = [];

  for (let r = 0; r < rows.length; r++) {
    const banner = (rows[r]?.[0] || '').trim();
    if (banner.toUpperCase().startsWith('MONTHLY ATTENDANCE & TASK TRACKER')) {
      let monthKey = '2026-09';
      let monthTitle = 'September 2026';
      const bUpper = banner.toUpperCase();
      if (bUpper.includes('OCTOBER')) { monthKey = '2026-10'; monthTitle = 'October 2026'; }
      else if (bUpper.includes('SEPTEMBER')) { monthKey = '2026-09'; monthTitle = 'September 2026'; }
      else if (bUpper.includes('NOVEMBER')) { monthKey = '2026-11'; monthTitle = 'November 2026'; }
      else if (bUpper.includes('DECEMBER')) { monthKey = '2026-12'; monthTitle = 'December 2026'; }

      blocks.push({
        startRow: r,
        monthKey,
        monthTitle,
        subTitle: rows[r + 1]?.[0] || 'Cohort Tracking'
      });
    }
  }

  // Determine target block to return
  let selectedBlock = blocks[0];
  if (targetMonthKey) {
    const match = blocks.find(b => b.monthKey === targetMonthKey);
    if (match) selectedBlock = match;
  }
  if (!selectedBlock) {
    selectedBlock = {
      startRow: 0,
      monthKey: '2026-09',
      monthTitle: 'September 2026',
      subTitle: 'Cohort Tracking'
    };
  }

  const startRow = selectedBlock.startRow;
  const monthTitle = rows[startRow]?.[0] || `MONTHLY ATTENDANCE & TASK TRACKER — ${selectedBlock.monthTitle.toUpperCase()}`;
  const subTitle = rows[startRow + 1]?.[0] || selectedBlock.subTitle;

  const header1 = rows[startRow + 2] || [];
  const header2 = rows[startRow + 3] || [];

  const parsedWorkingDays: { date: string; day: string }[] = [];
  for (let c = 2; c < header1.length; c++) {
    const dVal = (header1[c] || '').trim();
    if (!dVal || dVal.toLowerCase().includes('total') || dVal.toLowerCase().includes('summary') || dVal.toLowerCase().includes('attendance')) break;
    const dayVal = (header2[c] || '').trim();
    parsedWorkingDays.push({ date: dVal, day: dayVal || 'Day' });
  }

  const finalWorkingDays = parsedWorkingDays.length > 0 
    ? parsedWorkingDays 
    : (selectedBlock.monthKey === '2026-10' ? WORKING_DAYS_OCT_2026 : WORKING_DAYS_SEP_2026);

  const students: StudentTrackerItem[] = [];
  for (let r = startRow + 4; r < rows.length; r += 2) {
    const rowA = rows[r] || [];
    const rowB = rows[r + 1] || [];

    const internName = (rowA[0] || '').trim();
    if (!internName || internName.startsWith('Daily') || internName.toUpperCase().startsWith('MONTHLY ATTENDANCE')) break;

    const domainRaw = (rowB[0] || '').trim();
    let domain = domainRaw;
    let startDate = selectedBlock.monthKey === '2026-10' ? '2026-10-01' : '2026-09-01';
    let endDate = selectedBlock.monthKey === '2026-10' ? '2026-12-31' : '2026-11-30';
    const tenureDays = 90;

    const dateMatch = domainRaw.match(/^(.*?)\s*\[(.*?)\s*→\s*(.*?)\]$/);
    if (dateMatch) {
      domain = dateMatch[1].trim();
      startDate = dateMatch[2].trim();
      endDate = dateMatch[3].trim();
    }

    const attendance = finalWorkingDays.map((_, i) => (rowA[2 + i] || '').trim());
    const tasks = finalWorkingDays.map((_, i) => (rowB[2 + i] || '').trim());

    const activeDays = tasks.filter(t => t === 'Completed' || t === 'Not Completed').length;
    const eligibleDays = attendance.filter(a => a && a !== 'Not Joined').length || 1;
    const totalPresent = parseInt(rowA[2 + finalWorkingDays.length] || '0', 10) || attendance.filter(a => a === 'Present').length;
    const totalAbsent = parseInt(rowA[3 + finalWorkingDays.length] || '0', 10) || attendance.filter(a => a === 'Absent').length;
    const attendancePct = rowA[4 + finalWorkingDays.length] || (totalPresent + totalAbsent > 0 ? `${Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)}%` : '100%');
    const tasksCompleted = parseInt(rowB[5 + finalWorkingDays.length] || '0', 10) || tasks.filter(t => t === 'Completed').length;
    const completionPct = rowB[6 + finalWorkingDays.length] || (activeDays > 0 ? `${Math.round((tasksCompleted / activeDays) * 100)}%` : (eligibleDays > 0 ? `${Math.round((tasksCompleted / eligibleDays) * 100)}%` : '100%'));

    students.push({
      studentName: internName,
      domain,
      startDate,
      endDate,
      tenureDays,
      eligibleDays,
      attendance,
      tasks,
      totalPresent,
      totalAbsent,
      attendancePct,
      tasksCompleted,
      completionPct,
    });
  }

  const availableMonths = blocks.map(b => ({ monthKey: b.monthKey, title: b.monthTitle }));
  if (!availableMonths.some(m => m.monthKey === '2026-10')) {
    availableMonths.push({ monthKey: '2026-10', title: 'October 2026' });
  }

  return {
    staffId,
    monthKey: selectedBlock.monthKey,
    monthTitle,
    subTitle,
    workingDays: finalWorkingDays,
    students,
    availableMonths,
  };
}

/**
 * Save / sync the monthly attendance & task tracker matrix back to Google Sheets.
 * Updates the specific month's range in-place without wiping stacked months.
 */
export async function saveAttendanceTracker(
  spreadsheetId: string,
  staffId: string,
  data: AttendanceTrackerData
): Promise<void> {
  const sheets = await getSheetsApi();
  const tabName = getAttendanceTrackerTabName(staffId);
  const rows = await readSheet(spreadsheetId, tabName);

  // Find start row of data.monthKey
  let startRow = 0;
  for (let r = 0; r < rows.length; r++) {
    const banner = (rows[r]?.[0] || '').trim().toUpperCase();
    if (banner.startsWith('MONTHLY ATTENDANCE & TASK TRACKER')) {
      if (data.monthKey === '2026-10' && banner.includes('OCTOBER')) { startRow = r; break; }
      if (data.monthKey === '2026-09' && banner.includes('SEPTEMBER')) { startRow = r; break; }
      if (banner.includes((data.monthTitle || '').toUpperCase())) { startRow = r; break; }
    }
  }

  const workingDays = data.workingDays && data.workingDays.length > 0 
    ? data.workingDays 
    : (data.monthKey === '2026-10' ? WORKING_DAYS_OCT_2026 : WORKING_DAYS_SEP_2026);

  const totalCols = 2 + workingDays.length + 5;
  const lastColLetter = numberToColLetter(totalCols);

  const blockRows: (string | number)[][] = [];

  // Row 1: Banner
  const row1 = Array(totalCols).fill('');
  row1[0] = data.monthTitle || (data.monthKey === '2026-10' ? 'MONTHLY ATTENDANCE & TASK TRACKER — OCTOBER 2026' : 'MONTHLY ATTENDANCE & TASK TRACKER — SEPTEMBER 2026');
  blockRows.push(row1);

  // Row 2: Sub-banner
  const row2 = Array(totalCols).fill('');
  row2[0] = data.subTitle || 'Cohort Tracking | Mon-Fri Tracking | Dropdown Validation';
  blockRows.push(row2);

  // Row 3: Header 1
  blockRows.push([
    'Intern Name',
    'Tracking Metric',
    ...workingDays.map(w => w.date),
    'Total Present',
    'Total Absent',
    'Attendance %',
    'Tasks Completed',
    'Completion %'
  ]);

  // Row 4: Header 2
  blockRows.push([
    'Domain / Track & Tenure',
    'Daily Log Type',
    ...workingDays.map(w => w.day),
    'Summary',
    'Summary',
    'Rate %',
    'Summary',
    'Rate %'
  ]);

  const students = data.students || [];
  const colLastDay = numberToColLetter(2 + workingDays.length);
  const colTotPres = numberToColLetter(3 + workingDays.length);
  const colTotAbs = numberToColLetter(4 + workingDays.length);
  const colTskComp = numberToColLetter(6 + workingDays.length);

  students.forEach((s, idx) => {
    const rAtt = startRow + 5 + idx * 2;
    const rTsk = startRow + 6 + idx * 2;

    const attRow = [
      s.studentName,
      'Attendance',
      ...s.attendance,
      `=COUNTIF(C${rAtt}:${colLastDay}${rAtt}, "Present")`,
      `=COUNTIF(C${rAtt}:${colLastDay}${rAtt}, "Absent")`,
      `=IF(${colTotPres}${rAtt}+${colTotAbs}${rAtt}>0, ROUND(${colTotPres}${rAtt}/(${colTotPres}${rAtt}+${colTotAbs}${rAtt})*100, 1) & "%", "100%")`,
      '',
      ''
    ];
    blockRows.push(attRow);

    const tskRow = [
      `${s.domain} [${s.startDate || '2026-09-01'} → ${s.endDate || '2026-11-30'}]`,
      'Task Completion',
      ...s.tasks,
      '',
      '',
      '',
      `=COUNTIF(C${rTsk}:${colLastDay}${rTsk}, "Completed")`,
      `=IF(COUNTIF(C${rTsk}:${colLastDay}${rTsk}, "Completed")+COUNTIF(C${rTsk}:${colLastDay}${rTsk}, "Not Completed")>0, ROUND(${colTskComp}${rTsk}/(COUNTIF(C${rTsk}:${colLastDay}${rTsk}, "Completed")+COUNTIF(C${rTsk}:${colLastDay}${rTsk}, "Not Completed"))*100, 1) & "%", "100%")`
    ];
    blockRows.push(tskRow);
  });

  const studentCount = students.length;
  const firstStuRow = startRow + 5;
  const lastStuRow = startRow + 4 + studentCount * 2;

  const dailyPresentRow = [
    'Daily Total Present',
    'Cohort Attendance',
    ...workingDays.map((_, i) => {
      const cLetter = numberToColLetter(i + 3);
      return `=COUNTIF(${cLetter}${firstStuRow}:${cLetter}${lastStuRow}, "Present")`;
    }),
    students.map((_, i) => `${colTotPres}${firstStuRow + i * 2}`).join('+') ? `=${students.map((_, i) => `${colTotPres}${firstStuRow + i * 2}`).join('+')}` : '',
    students.map((_, i) => `${colTotAbs}${firstStuRow + i * 2}`).join('+') ? `=${students.map((_, i) => `${colTotAbs}${firstStuRow + i * 2}`).join('+')}` : '',
    '',
    '',
    ''
  ];
  blockRows.push(dailyPresentRow);

  const dailyTasksRow = [
    'Daily Tasks Completed',
    'Cohort Tasks',
    ...workingDays.map((_, i) => {
      const cLetter = numberToColLetter(i + 3);
      return `=COUNTIF(${cLetter}${firstStuRow}:${cLetter}${lastStuRow}, "Completed")`;
    }),
    '',
    '',
    '',
    students.map((_, i) => `${colTskComp}${firstStuRow + 1 + i * 2}`).join('+') ? `=${students.map((_, i) => `${colTskComp}${firstStuRow + 1 + i * 2}`).join('+')}` : '',
    ''
  ];
  blockRows.push(dailyTasksRow);

  const targetRange = `'${tabName}'!A${startRow + 1}:${lastColLetter}${startRow + blockRows.length}`;

  await rateLimitedCall(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: targetRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: blockRows },
  }), `update ${tabName} range ${targetRange}`);
}

/**
 * Append the next month's attendance matrix block below the previous month with a 4-row gap.
 * Enforces dynamic lifecycle rollover: students whose End Date completed in the previous month
 * will NOT arise in the next month's data!
 */
export async function appendNextMonthAttendanceTracker(
  spreadsheetId: string,
  staffId: string,
  targetYear: number = 2026,
  targetMonth: number = 10
): Promise<AttendanceTrackerData> {
  const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const targetMonthName = targetMonth === 10 ? 'October' : (targetMonth === 11 ? 'November' : 'December');
  const targetMonthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;

  // Check if target month is already stacked
  const existing = await getAttendanceTracker(spreadsheetId, staffId, targetMonthKey);
  if (existing.monthKey === targetMonthKey && existing.students.length > 0) {
    return existing;
  }

  // Read raw sheet rows to find last row
  const tabName = getAttendanceTrackerTabName(staffId);
  const rows = await readSheet(spreadsheetId, tabName);

  // Fetch all students for this mentor to filter active vs completed
  const dirStudents = await getMentorStudents(spreadsheetId, staffId);

  // LIFECYCLE FILTER: Omit students whose course completed in previous month
  const activeStudents = dirStudents.filter(s => {
    let endDateISO = s.endDate;
    if (/^\d{2}-\d{2}-\d{4}$/.test(s.endDate)) {
      const [d, m, y] = s.endDate.split('-');
      endDateISO = `${y}-${m}-${d}`;
    }
    // Student must not have completed before the start of the target month
    return !isDateBefore(endDateISO, targetMonthStart);
  });

  const workingDays = getWorkingDaysForMonth(targetYear, targetMonth);
  const startRowOffset = rows.length + 4; // 4-row gap

  const trackerStudents: StudentTrackerItem[] = activeStudents.map(s => ({
    studentId: s.studentId,
    studentName: s.studentName,
    domain: s.domain,
    startDate: s.admissionDate,
    endDate: s.endDate,
    tenureDays: 90,
    eligibleDays: workingDays.length,
    attendance: Array(workingDays.length).fill(''),
    tasks: Array(workingDays.length).fill(''),
    totalPresent: 0,
    totalAbsent: 0,
    attendancePct: '100%',
    tasksCompleted: 0,
    completionPct: '100%',
  }));

  const newMonthData: AttendanceTrackerData = {
    staffId,
    monthKey: targetMonthKey,
    monthTitle: `MONTHLY ATTENDANCE & TASK TRACKER — ${targetMonthName.toUpperCase()} ${targetYear}`,
    subTitle: `Cohort: Q4 ${targetYear} | Mon-Fri Tracking | Rolling Monthly Lifecycle`,
    workingDays,
    students: trackerStudents,
  };

  await saveAttendanceTracker(spreadsheetId, staffId, newMonthData);
  return getAttendanceTracker(spreadsheetId, staffId, targetMonthKey);
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function numberToColLetter(n: number): string {
  let r = '';
  while (n > 0) {
    n--;
    r = String.fromCharCode(65 + (n % 26)) + r;
    n = Math.floor(n / 26);
  }
  return r;
}

