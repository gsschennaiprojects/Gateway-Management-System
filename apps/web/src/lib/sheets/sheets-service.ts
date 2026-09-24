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
  getWorkingDaysForMonth,
  isDateBefore,
  isDateAfter,
  COMMON_SHEET_NAMES,
  STAFF_DIRECTORY_COLUMNS,
  WORKLOG_COLUMNS,
  STUDENT_COLUMNS,
  TASK_COLUMNS,
  ATTENDANCE_TRACKER_COLUMNS,
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
export async function getSheetsApi(): Promise<sheets_v4.Sheets> {
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
    path.join(process.cwd(), 'management-system-509313-306faa5b0c5e.json'),
    path.join(process.cwd(), '../management-system-509313-306faa5b0c5e.json'),
    path.join(process.cwd(), '../../management-system-509313-306faa5b0c5e.json'),
    path.join(process.cwd(), 'apps/web/management-system-509313-306faa5b0c5e.json'),
    path.resolve(__dirname, '../../management-system-509313-306faa5b0c5e.json'),
    path.resolve(__dirname, '../../../management-system-509313-306faa5b0c5e.json'),
    SERVICE_ACCOUNT_KEY_PATH,
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

// ─── Enterprise Google Sheets Quota & Rate-Limiter Manager ──────────────────────

/**
 * Google Cloud Quota Limits for Sheets API:
 * - 300 requests per minute per project (Global Hard Limit)
 * - 60 requests per minute per user/service account
 * 
 * Our Enterprise Protective Thresholds:
 * - Max Safe Watermark: 240 req/min (80% ceiling, reserving 20% safe buffer)
 * - Minimum spacing between consecutive requests: 250ms (up to ~240 calls/min)
 */
export const GOOGLE_SHEETS_MINUTE_QUOTA = 300;
export const MAX_SAFE_REQUESTS_PER_MINUTE = 240;
const BASE_MIN_INTERVAL_MS = 250;

// Rolling 60-second sliding window request timestamps
const recentRequestTimestamps: number[] = [];

// Daily cumulative metrics
let totalDailyRequests = 0;
let totalThrottled = 0;
let totalRetries = 0;
let activeQueueDepth = 0;
let lastCallTimestamp: string | null = null;
let lastCallLabel: string | null = null;

// Promise FIFO serialization queue to eliminate concurrent race bursts
let executionQueue: Promise<unknown> = Promise.resolve();

export interface SheetsQuotaMetrics {
  requestsInLastMinute: number;
  maxSafeMinuteLimit: number;
  googleMinuteQuota: number;
  minuteUtilizationPercent: number;
  totalDailyRequests: number;
  totalThrottled: number;
  totalRetries: number;
  activeQueueDepth: number;
  status: 'HEALTHY' | 'WARNING' | 'THROTTLED';
  lastCallTimestamp: string | null;
  lastCallLabel: string | null;
}

/**
 * Clean up timestamps older than 60 seconds from the sliding window.
 */
function pruneSlidingWindow(): void {
  const now = Date.now();
  const cutoff = now - 60000;
  while (recentRequestTimestamps.length > 0 && recentRequestTimestamps[0] < cutoff) {
    recentRequestTimestamps.shift();
  }
}

/**
 * Get real-time metrics on Google Sheets API quota utilization.
 */
export function getSheetsQuotaMetrics(): SheetsQuotaMetrics {
  pruneSlidingWindow();
  const currentCount = recentRequestTimestamps.length;
  const utilization = Math.round((currentCount / GOOGLE_SHEETS_MINUTE_QUOTA) * 100);

  let status: 'HEALTHY' | 'WARNING' | 'THROTTLED' = 'HEALTHY';
  if (currentCount >= MAX_SAFE_REQUESTS_PER_MINUTE) {
    status = 'THROTTLED';
  } else if (currentCount >= 180) {
    status = 'WARNING';
  }

  return {
    requestsInLastMinute: currentCount,
    maxSafeMinuteLimit: MAX_SAFE_REQUESTS_PER_MINUTE,
    googleMinuteQuota: GOOGLE_SHEETS_MINUTE_QUOTA,
    minuteUtilizationPercent: utilization,
    totalDailyRequests,
    totalThrottled,
    totalRetries,
    activeQueueDepth,
    status,
    lastCallTimestamp,
    lastCallLabel,
  };
}

/**
 * Reset quota counters (useful for unit testing or scheduled midnight roll).
 */
export function resetSheetsQuotaMetrics(): void {
  recentRequestTimestamps.length = 0;
  totalDailyRequests = 0;
  totalThrottled = 0;
  totalRetries = 0;
  activeQueueDepth = 0;
  lastCallTimestamp = null;
  lastCallLabel = null;
}

let lastDispatchedTime = 0;

/**
 * Serialized, rate-limited executor with exponential backoff and jitter for Google Sheets API.
 */
async function rateLimitedCall<T>(fn: () => Promise<T>, label = ''): Promise<T> {
  activeQueueDepth++;

  // Enqueue onto promise chain to serialize concurrent invocations safely
  const task = executionQueue.then(async () => {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        pruneSlidingWindow();

        // 1. Sliding window quota backpressure
        if (recentRequestTimestamps.length >= MAX_SAFE_REQUESTS_PER_MINUTE) {
          totalThrottled++;
          const oldest = recentRequestTimestamps[0];
          const waitTime = Math.max(100, 60000 - (Date.now() - oldest) + 50);
          console.warn(`[SheetsQuotaManager] Minute watermark reached (${recentRequestTimestamps.length}/${GOOGLE_SHEETS_MINUTE_QUOTA}). Throttling call '${label}' for ${waitTime}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
          pruneSlidingWindow();
        }

        // 2. Minimum interval pacing
        const now = Date.now();
        const elapsed = now - lastDispatchedTime;
        const requiredInterval = recentRequestTimestamps.length > 180 ? 400 : BASE_MIN_INTERVAL_MS;

        if (elapsed < requiredInterval) {
          await new Promise(r => setTimeout(r, requiredInterval - elapsed));
        }

        lastDispatchedTime = Date.now();
        recentRequestTimestamps.push(lastDispatchedTime);
        totalDailyRequests++;
        lastCallTimestamp = new Date(lastDispatchedTime).toISOString();
        lastCallLabel = label;

        return await fn();
      } catch (err: unknown) {
        const error = err as { message?: string; code?: number; status?: number };
        const isQuotaError =
          error.code === 429 ||
          error.status === 429 ||
          (typeof error.message === 'string' && (
            error.message.includes('Quota exceeded') ||
            error.message.includes('rate limit') ||
            error.message.includes('RESOURCE_EXHAUSTED')
          ));

        if (isQuotaError && attempt < MAX_RETRIES) {
          totalRetries++;
          // Exponential backoff with full randomized jitter
          const baseDelay = Math.min(30000, Math.pow(2, attempt) * 2000);
          const jitter = Math.floor(Math.random() * 1000);
          const waitMs = baseDelay + jitter;

          console.warn(`[SheetsQuotaManager] Quota 429 hit for '${label}' (Attempt ${attempt + 1}/${MAX_RETRIES}). Backing off with jitter for ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        throw err;
      }
    }

    throw new Error(`[SheetsQuotaManager] Maximum retries exceeded for call: ${label}`);
  }).finally(() => {
    activeQueueDepth = Math.max(0, activeQueueDepth - 1);
  });

  // Catch errors in the chain so subsequent queue items can still execute
  executionQueue = task.then(() => {}, () => {});

  return task as Promise<T>;
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

/**
 * Delete rows matching a filter predicate (from row 2 onwards, preserving header).
 */
export async function deleteRowsMatching(
  spreadsheetId: string,
  tabName: string,
  filterFn: (row: string[]) => boolean
): Promise<number> {
  const api = await getSheetsApi();
  const meta = await rateLimitedCall(
    () => api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' }),
    'get sheetId for delete'
  );
  const sheet = (meta.data.sheets || []).find(s => s.properties?.title === tabName);
  if (!sheet || sheet.properties?.sheetId === undefined) return 0;
  const sheetId = sheet.properties.sheetId;

  const rows = await readSheet(spreadsheetId, tabName);
  const matchingIndices: number[] = [];
  // Skip header (index 0)
  for (let i = 1; i < rows.length; i++) {
    if (filterFn(rows[i])) {
      matchingIndices.push(i);
    }
  }

  if (matchingIndices.length === 0) return 0;

  // Delete from bottom to top so indices don't shift
  matchingIndices.sort((a, b) => b - a);
  const requests: sheets_v4.Schema$Request[] = matchingIndices.map(idx => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: idx,
        endIndex: idx + 1
      }
    }
  }));

  await rateLimitedCall(
    () => api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    }),
    `delete matching rows in ${tabName}`
  );

  return matchingIndices.length;
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

/**
 * Automatically mark/upsert staff attendance as Present in 04_Staff_Attendance upon login.
 * Idempotent: If a record exists for today, keeps status as Present and updates check-in time without creating duplicate rows.
 */
export async function upsertStaffAttendanceRecord(
  spreadsheetId: string,
  values: (string | number)[]
): Promise<void> {
  const tabName = COMMON_SHEET_NAMES.STAFF_ATTENDANCE;
  const attId = String(values[0]);
  const existing = await findRow(spreadsheetId, tabName, 0, attId);
  if (existing) {
    // Preserve existing check-in time if already punched in
    if (existing.data[6] && existing.data[6] !== '-') {
      values[6] = existing.data[6];
    }
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, values.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

/**
 * Update an existing attendance record in 04_Staff_Attendance upon Punch Out / Logout.
 * Sets Check_Out time, Total_Hours, and preserves the original Check_In time.
 */
export async function punchOutStaffAttendanceRecord(
  spreadsheetId: string,
  params: {
    staffId: string;
    staffName: string;
    role: string;
    date: string;
    day: string;
    checkOutTime: string;
    totalHours: number | string;
    markedBy?: string;
  }
): Promise<void> {
  const tabName = COMMON_SHEET_NAMES.STAFF_ATTENDANCE;
  const dateKey = params.date.replace(/-/g, '');
  const attId = `ATT_${params.staffId}_${dateKey}`;

  const existing = await findRow(spreadsheetId, tabName, 0, attId);
  const nowIso = new Date().toISOString();

  if (existing) {
    const updatedValues = [...existing.data];
    while (updatedValues.length < 12) updatedValues.push('');
    
    // Column 7: Check_Out
    updatedValues[7] = params.checkOutTime;
    // Column 8: Total_Hours
    updatedValues[8] = String(params.totalHours);
    // Column 9: Status
    updatedValues[9] = 'Present';
    // Column 10: Marked_By
    updatedValues[10] = params.markedBy || 'Self (Punch Out)';
    // Column 11: Timestamp
    updatedValues[11] = nowIso;

    await updateRow(spreadsheetId, tabName, existing.rowNumber, updatedValues, updatedValues.length);
  } else {
    const values = [
      attId,
      params.date,
      params.day,
      params.staffId,
      params.staffName,
      params.role,
      params.checkOutTime,
      params.checkOutTime,
      String(params.totalHours),
      'Present',
      params.markedBy || 'Self (Punch Out)',
      nowIso
    ];
    await appendRow(spreadsheetId, tabName, values);
  }
}

/**
 * Append or update a staff member in 02_Staff_Directory.
 */
export async function upsertStaffDirectory(
  spreadsheetId: string,
  staff: {
    staffId: string;
    fullName: string;
    role: string;
    designation?: string;
    department?: string;
    email: string;
    mobile?: string;
    joiningDate?: string;
    reportingManager?: string;
    accountStatus?: string;
    firebaseUid?: string;
  }
): Promise<void> {
  const tabName = COMMON_SHEET_NAMES.STAFF_DIRECTORY;
  const columns = STAFF_DIRECTORY_COLUMNS;
  await ensureTabExists(spreadsheetId, tabName, columns);

  const values = [
    staff.staffId,
    staff.fullName,
    staff.role,
    staff.designation || staff.role,
    staff.department || 'Operations',
    staff.email,
    staff.mobile || '',
    staff.joiningDate || new Date().toISOString().split('T')[0],
    staff.reportingManager || 'Management',
    staff.accountStatus || 'Active',
    staff.firebaseUid || staff.staffId,
    new Date().toISOString(),
  ];

  const existing = await findRow(spreadsheetId, tabName, 0, staff.staffId);
  if (existing) {
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, columns.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

/**
 * Append or update a worklog entry in the master 03_Daily_Worklogs sheet.
 */
export async function appendBranchDailyWorklog(
  spreadsheetId: string,
  entry: {
    logId: string;
    staffId: string;
    staffName: string;
    role: string;
    branchId: string;
    date: string;
    loginTime: string;
    logoutTime: string;
    tasksCompleted: string;
    tasksPending: string;
    incompleteReason?: string;
    totalHours: number | string;
    verifiedBy?: string;
  }
): Promise<void> {
  const tabName = '03_Daily_Worklogs';
  const headers = ['Log_ID', 'Staff_ID', 'Staff_Name', 'Role', 'Branch_ID', 'Date', 'Login_Time', 'Logout_Time', 'Tasks_Completed', 'Tasks_Pending', 'Incomplete_Reason', 'Total_Hours', 'Verified_By', 'Timestamp'];
  await ensureTabExists(spreadsheetId, tabName, headers);
  const values = [
    entry.logId,
    entry.staffId,
    entry.staffName,
    entry.role,
    entry.branchId,
    entry.date,
    entry.loginTime,
    entry.logoutTime,
    entry.tasksCompleted,
    entry.tasksPending,
    entry.incompleteReason || '',
    String(entry.totalHours),
    entry.verifiedBy || 'Pending',
    new Date().toISOString()
  ];
  await appendRow(spreadsheetId, tabName, values);
}

/**
 * Append or update a task entry in the master 05_Task_Allocation sheet.
 */
export async function appendBranchTaskAllocation(
  spreadsheetId: string,
  task: {
    taskId: string;
    dateAssigned: string;
    assignedById: string;
    assignedByName: string;
    assignedToId: string;
    assignedToName: string;
    taskTitle: string;
    description: string;
    priority: string;
    category: string;
    startDate: string;
    dueDate: string;
    completedDate: string;
    status: string;
    progressPct: string | number;
    remarks: string;
  }
): Promise<void> {
  const tabName = '05_Task_Allocation';
  const headers = ['Task_ID', 'Date_Assigned', 'Assigned_By_ID', 'Assigned_By_Name', 'Assigned_To_ID', 'Assigned_To_Name', 'Task_Title', 'Description', 'Priority', 'Category', 'Start_Date', 'Due_Date', 'Completed_Date', 'Status', 'Progress_Pct', 'Remarks'];
  await ensureTabExists(spreadsheetId, tabName, headers);
  const values = [
    task.taskId,
    task.dateAssigned,
    task.assignedById,
    task.assignedByName,
    task.assignedToId,
    task.assignedToName,
    task.taskTitle,
    task.description,
    task.priority,
    task.category,
    task.startDate,
    task.dueDate,
    task.completedDate,
    task.status,
    String(task.progressPct),
    task.remarks
  ];
  const existing = await findRow(spreadsheetId, tabName, 0, task.taskId);
  if (existing) {
    await updateRow(spreadsheetId, tabName, existing.rowNumber, values, headers.length);
  } else {
    await appendRow(spreadsheetId, tabName, values);
  }
}

/**
 * Automatically create the 4 dedicated operational subsheets for any staff member in their branch spreadsheet:
 * 1. WL_<Staff_ID> (Daily Worklogs)
 * 2. STU_<Staff_ID> (Assigned Students)
 * 3. TSK_<Staff_ID> (Task Allocation)
 * 4. ATT_<Staff_ID> (Monthly Student Attendance & Progress Tracker)
 */
export async function createStaffSubsheets(
  spreadsheetId: string,
  staffId: string,
  staffName?: string,
  role?: string
): Promise<{ success: boolean; createdTabs: string[] }> {
  const wlTab = getWorklogTabName(staffId);
  const stuTab = getStudentTabName(staffId);
  const tskTab = getTaskTabName(staffId);
  const attTab = getAttendanceTrackerTabName(staffId);

  await ensureTabExists(spreadsheetId, wlTab, WORKLOG_COLUMNS);
  await ensureTabExists(spreadsheetId, stuTab, STUDENT_COLUMNS);
  await ensureTabExists(spreadsheetId, tskTab, TASK_COLUMNS);
  await ensureTabExists(spreadsheetId, attTab, ATTENDANCE_TRACKER_COLUMNS);

  return {
    success: true,
    createdTabs: [wlTab, stuTab, tskTab, attTab]
  };
}

/**
 * Delete staff subsheets (for testing cleanup or staff archival)
 */
export async function deleteStaffSubsheets(
  spreadsheetId: string,
  staffId: string
): Promise<void> {
  const api = await getSheetsApi();
  const tabsToDelete = new Set([
    getWorklogTabName(staffId),
    getStudentTabName(staffId),
    getTaskTabName(staffId),
    getAttendanceTrackerTabName(staffId)
  ]);

  try {
    const meta = await rateLimitedCall(
      () => api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' }),
      `check tabs for deletion`
    );
    const requests: sheets_v4.Schema$Request[] = [];
    for (const s of meta.data.sheets || []) {
      if (s.properties?.title && tabsToDelete.has(s.properties.title) && s.properties.sheetId !== undefined) {
        requests.push({
          deleteSheet: { sheetId: s.properties.sheetId }
        });
      }
    }
    if (requests.length > 0) {
      await rateLimitedCall(
        () => api.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests }
        }),
        `delete staff subsheets ${staffId}`
      );
    }
  } catch (err) {
    console.warn(`[SheetsService] Note deleting tabs for ${staffId}:`, err);
  }
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
 * Dynamic working days calculation for any month key (YYYY-MM).
 */
export function getWorkingDaysForMonthKey(mk?: string): { date: string; day: string }[] {
  if (mk) {
    const parts = mk.split('-');
    if (parts.length === 2) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10);
      if (!isNaN(yr) && !isNaN(mo)) return getWorkingDaysForMonth(yr, mo);
    }
  }
  const now = new Date();
  return getWorkingDaysForMonth(now.getFullYear(), now.getMonth() + 1);
}

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

  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const effectiveMonthKey = targetMonthKey || curMonthKey;

  // Generate available months dynamically: 3 months back + current + 2 months forward
  const availableFallbackMonths: { monthKey: string; title: string }[] = [];
  for (let delta = -3; delta <= 2; delta++) {
    const d = new Date(now.getFullYear(), now.getMonth() + delta, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const title = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    availableFallbackMonths.push({ monthKey: mk, title });
  }

  if (!rows || rows.length < 4) {
    const targetTitle = new Date(effectiveMonthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return {
      staffId,
      monthKey: effectiveMonthKey,
      monthTitle: `MONTHLY ATTENDANCE & TASK TRACKER — ${targetTitle.toUpperCase()}`,
      subTitle: 'Mon-Fri Tracking | Rolling Monthly Lifecycle',
      workingDays: getWorkingDaysForMonthKey(effectiveMonthKey),
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
    : getWorkingDaysForMonthKey(selectedBlock.monthKey);

  const students: StudentTrackerItem[] = [];
  for (let r = startRow + 4; r < rows.length; r += 2) {
    const rowA = rows[r] || [];
    const rowB = rows[r + 1] || [];

    const internName = (rowA[0] || '').trim();
    if (!internName || internName.startsWith('Daily') || internName.toUpperCase().startsWith('MONTHLY ATTENDANCE')) break;

    const domainRaw = (rowB[0] || '').trim();
    let domain = domainRaw;
    // Derive default start/end from the block's month key dynamically
    const blkParts = selectedBlock.monthKey.split('-');
    const blkYear = parseInt(blkParts[0] || '2026', 10);
    const blkMonth = parseInt(blkParts[1] || '9', 10);
    const blkFirstDay = `${blkYear}-${String(blkMonth).padStart(2, '0')}-01`;
    // Default end = last day of month 3 months later
    const endMonthDate = new Date(blkYear, blkMonth + 2, 0); // month+2 since month is 1-indexed and getDate returns last day
    const blkEndDay = `${endMonthDate.getFullYear()}-${String(endMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endMonthDate.getDate()).padStart(2, '0')}`;
    let startDate = blkFirstDay;
    let endDate = blkEndDay;
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

  const workingDays: { date: string; day: string }[] = data.workingDays && data.workingDays.length > 0 
    ? data.workingDays 
    : getWorkingDaysForMonthKey(data.monthKey);

  const totalCols = 2 + workingDays.length + 5;
  const lastColLetter = numberToColLetter(totalCols);

  const blockRows: (string | number)[][] = [];

  // Row 1: Banner
  const row1 = Array(totalCols).fill('');
  row1[0] = data.monthTitle || (() => {
    const targetTitle = new Date(data.monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `MONTHLY ATTENDANCE & TASK TRACKER \u2014 ${targetTitle.toUpperCase()}`;
  })();
  blockRows.push(row1);

  // Row 2: Sub-banner
  const row2 = Array(totalCols).fill('');
  row2[0] = data.subTitle || 'Cohort Tracking | Mon-Fri Tracking | Dropdown Validation';
  blockRows.push(row2);

  // Row 3: Header 1
  blockRows.push([
    'Intern Name',
    'Tracking Metric',
    ...workingDays.map((w: { date: string; day: string }) => w.date),
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
    ...workingDays.map((w: { date: string; day: string }) => w.day),
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
    ...workingDays.map((_: { date: string; day: string }, i: number) => {
      const cLetter = numberToColLetter(i + 3);
      return `=COUNTIF(${cLetter}${firstStuRow}:${cLetter}${lastStuRow}, "Present")`;
    }),
    students.map((_: any, i: number) => `${colTotPres}${firstStuRow + i * 2}`).join('+') ? `=${students.map((_: any, i: number) => `${colTotPres}${firstStuRow + i * 2}`).join('+')}` : '',
    students.map((_: any, i: number) => `${colTotAbs}${firstStuRow + i * 2}`).join('+') ? `=${students.map((_: any, i: number) => `${colTotAbs}${firstStuRow + i * 2}`).join('+')}` : '',
    '',
    '',
    ''
  ];
  blockRows.push(dailyPresentRow);

  const dailyTasksRow = [
    'Daily Tasks Completed',
    'Cohort Tasks',
    ...workingDays.map((_: { date: string; day: string }, i: number) => {
      const cLetter = numberToColLetter(i + 3);
      return `=COUNTIF(${cLetter}${firstStuRow}:${cLetter}${lastStuRow}, "Completed")`;
    }),
    '',
    '',
    '',
    students.map((_: any, i: number) => `${colTskComp}${firstStuRow + 1 + i * 2}`).join('+') ? `=${students.map((_: any, i: number) => `${colTskComp}${firstStuRow + 1 + i * 2}`).join('+')}` : '',
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



