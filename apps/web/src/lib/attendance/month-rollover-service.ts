/**
 * GSS Enterprise Month Rollover & Archiving Service
 *
 * PURPOSE:
 * 1. Automatically detects month changes across all branch operations.
 * 2. Archives the complete previous month's attendance records and punch matrices
 *    for every employee into Firestore collection: `monthly_attendance_archives`.
 * 3. Archives the complete previous month's daily worklogs and completed deliverables
 *    for every employee into Firestore collection: `monthly_worklog_archives`.
 * 4. Updates database in all places for the new month:
 *    - Initializes fresh monthly records in `staff_attendance` for all active staff.
 *    - Resets and initializes `branch_metrics` for all 4 branches (CBE, CHE, BLR, HYD).
 *    - Updates `systemConfig/monthly_state` with current active period & audit tracking.
 *    - Commits immutable audit events to `audit_logs`.
 */

import {
  getAdminFirestore,
  getFirestoreUsers,
  getFirestoreWorklogs,
} from '@/lib/firebase/firebase-admin';
import { logAuditEvent } from '@/lib/audit/audit-service';
import { BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';
import type { GSSMonthlyAttendanceArchive, GSSMonthlyWorklogArchive } from '@/lib/firestore';
import type { UserRole } from '@/types/auth';

export interface MonthPeriod {
  year: number;
  month: number; // 1-12
}

export interface RolloverResult {
  success: boolean;
  message: string;
  previousPeriod: {
    year: number;
    month: number;
    monthName: string;
  };
  currentPeriod: {
    year: number;
    month: number;
    monthName: string;
  };
  archivedAttendanceCount: number;
  archivedWorklogCount: number;
  initializedStaffCount: number;
  branchesUpdated: string[];
  archivedAt: string;
}

export interface MonthlyStateDoc {
  currentActiveYear: number;
  currentActiveMonth: number;
  lastArchivedYear: number;
  lastArchivedMonth: number;
  lastRolloverAt: string;
  totalEmployeesArchived: number;
  branchesUpdated: string[];
  status: string;
  isRolloverRunning?: boolean;
  rolloverLockUntil?: string | null;
  rolloverStartedAt?: string | null;
}

/**
 * Scalable Firestore Batch Manager
 * Overcomes Firestore's 500-write limit per batch by buffering operations
 * and automatically committing in chunks of 350 writes max.
 */
export class ChunkedBatchWriter {
  private currentBatch: FirebaseFirestore.WriteBatch | null = null;
  private currentCount = 0;
  private totalCommitted = 0;
  private readonly maxChunkSize = 350; // Well below 500 limit for absolute safety
  private commitPromises: Promise<void>[] = [];

  constructor(private db: FirebaseFirestore.Firestore | null) {
    if (this.db && typeof this.db.batch === 'function') {
      this.currentBatch = this.db.batch();
    }
  }

  set(
    ref: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.WithFieldValue<FirebaseFirestore.DocumentData>,
    options?: FirebaseFirestore.SetOptions
  ) {
    if (!this.db || !this.currentBatch) return;

    if (options) {
      this.currentBatch.set(ref, data, options);
    } else {
      this.currentBatch.set(ref, data);
    }
    this.currentCount++;

    if (this.currentCount >= this.maxChunkSize) {
      const batchToCommit = this.currentBatch;
      this.commitPromises.push(
        batchToCommit.commit().then(() => {
          this.totalCommitted += this.maxChunkSize;
        })
      );
      this.currentBatch = this.db.batch();
      this.currentCount = 0;
    }
  }

  async commit(): Promise<number> {
    if (!this.db || !this.currentBatch) return 0;

    if (this.currentCount > 0) {
      const remainingBatch = this.currentBatch;
      const count = this.currentCount;
      this.commitPromises.push(
        remainingBatch.commit().then(() => {
          this.totalCommitted += count;
        })
      );
      this.currentBatch = null;
      this.currentCount = 0;
    }

    await Promise.all(this.commitPromises);
    return this.totalCommitted;
  }
}

// In-memory fallback cache for development or when Firestore is unconfigured
const memoryMonthlyArchives = {
  attendance: new Map<string, GSSMonthlyAttendanceArchive>(),
  worklogs: new Map<string, GSSMonthlyWorklogArchive>(),
  state: {
    currentActiveYear: new Date().getFullYear(),
    currentActiveMonth: new Date().getMonth() + 1,
    lastArchivedYear: 0,
    lastArchivedMonth: 0,
    lastRolloverAt: '',
    totalEmployeesArchived: 0,
    branchesUpdated: ['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad'],
    status: 'INITIAL',
  } as MonthlyStateDoc,
};

/**
 * Calculates previous calendar month period.
 */
export function getPreviousMonthPeriod(referenceDate: Date = new Date()): MonthPeriod {
  const currentMonth = referenceDate.getMonth() + 1; // 1-12
  const currentYear = referenceDate.getFullYear();

  if (currentMonth === 1) {
    return { year: currentYear - 1, month: 12 };
  }
  return { year: currentYear, month: currentMonth - 1 };
}

/**
 * Formats period into human-readable month title (e.g. "September 2026").
 */
export function formatMonthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Computes non-Sunday working days in a given month.
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() !== 0) {
      // Exclude Sundays
      workingDays++;
    }
  }
  return workingDays;
}

/**
 * Archives complete previous month attendance & worklogs for all employees,
 * and updates the database in all places for the new month.
 */
export async function executeMonthRolloverAndArchive(options?: {
  targetYear?: number;
  targetMonth?: number;
  actor?: {
    id: string;
    name: string;
    role: UserRole;
    branch?: string;
  };
  force?: boolean;
}): Promise<RolloverResult> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Target previous month to archive
  const prevPeriod = options?.targetYear && options?.targetMonth
    ? { year: options.targetYear, month: options.targetMonth }
    : getPreviousMonthPeriod(now);

  const prevYear = prevPeriod.year;
  const prevMonth = prevPeriod.month;
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const prevMonthName = formatMonthName(prevYear, prevMonth);

  const newYear = currentYear;
  const newMonth = currentMonth;
  const newMonthName = formatMonthName(newYear, newMonth);

  const actor = options?.actor || {
    id: 'SYSTEM_ROLLOVER',
    name: 'Automated Month Rollover Engine',
    role: 'superadmin' as UserRole,
    branch: 'All',
  };

  const db = getAdminFirestore();

  // 1. Fetch active employees across all branches
  let activeUsers: Array<{
    id: string;
    name: string;
    email: string;
    mobile?: string;
    branch: string;
    role: string;
    status: string;
    employeeId?: string;
  }> = [];

  if (db) {
    try {
      const allUsers = await getFirestoreUsers();
      activeUsers = allUsers.filter(u => u.status === 'active' || u.status === 'pending');
    } catch (err) {
      console.warn('[MonthRollover] Could not read Firestore users, using memory:', err);
    }
  }

  if (activeUsers.length === 0) {
    // Fallback to local memory user store
    try {
      const { getAllUsers } = await import('@/lib/auth/user-store');
      const memUsers = getAllUsers();
      activeUsers = memUsers.filter((u) => u.status === 'active' || u.status === 'pending');
    } catch {
      // Empty fallback
    }
  }

  // 2. Fetch previous month staff attendance documents
  const savedAttendanceMap = new Map<string, Record<number, 'present' | 'absent' | 'holiday' | 'half_day' | 'late'>>();
  if (db) {
    try {
      const attSnap = await db.collection('staff_attendance')
        .where('year', '==', prevYear)
        .where('month', '==', prevMonth)
        .get();

      attSnap.forEach(doc => {
        const d = doc.data();
        if (d.staffId && d.attendance) {
          savedAttendanceMap.set(d.staffId, d.attendance);
        }
      });
    } catch (err) {
      console.warn('[MonthRollover] Error fetching previous month staff_attendance:', err);
    }
  }

  // 3. Fetch previous month worklogs
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const startDateStr = `${prevYear}-${prevMonthStr}-01`;
  const endDateStr = `${prevYear}-${prevMonthStr}-${String(daysInPrevMonth).padStart(2, '0')}`;

  let worklogs: Array<{
    id: string;
    userId: string;
    date: string;
    loginTime?: string;
    logoutTime?: string;
    tasksCompleted?: string[];
    tasksPending?: string[];
    incompleteReason?: string;
    totalHours?: number;
    attendanceStatus?: string;
    verifiedBy?: string;
  }> = [];

  if (db) {
    try {
      const allLogs = await getFirestoreWorklogs();
      worklogs = (allLogs as typeof worklogs).filter(l => l.date >= startDateStr && l.date <= endDateStr);
    } catch (err) {
      console.warn('[MonthRollover] Error fetching previous month worklogs:', err);
    }
  }

  const worklogsByStaff = new Map<string, typeof worklogs>();
  for (const log of worklogs) {
    if (!worklogsByStaff.has(log.userId)) {
      worklogsByStaff.set(log.userId, []);
    }
    worklogsByStaff.get(log.userId)!.push(log);
  }

  const totalWorkingDays = getWorkingDaysInMonth(prevYear, prevMonth);
  const nowIso = now.toISOString();

  let archivedAttendanceCount = 0;
  let archivedWorklogCount = 0;
  let initializedStaffCount = 0;

  const writer = new ChunkedBatchWriter(db);

  // 4. Archive complete previous month data for each employee
  for (const user of activeUsers) {
    const staffId = user.id;
    const branch = user.branch || 'Coimbatore';
    const branchCode = BRANCH_NAME_TO_CODE[branch] || branch.slice(0, 3).toUpperCase();
    const userRole = user.role || 'employee';
    const employeeId = user.employeeId || staffId;

    // --- Build Attendance Archive ---
    const savedGrid = savedAttendanceMap.get(staffId) || {};
    const staffWorklogs = worklogsByStaff.get(staffId) || [];

    // Map daily worklogs into day entries
    const worklogDayMap = new Map<number, typeof staffWorklogs[0]>();
    for (const wl of staffWorklogs) {
      const parts = wl.date.split('-');
      const d = parseInt(parts[2], 10);
      if (!isNaN(d)) {
        worklogDayMap.set(d, wl);
      }
    }

    const attendanceGrid: Record<number, 'present' | 'absent' | 'holiday' | 'half_day' | 'late'> = {};
    const dailyRecords: GSSMonthlyAttendanceArchive['dailyRecords'] = [];

    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let holidayDays = 0;
    let totalHoursWorked = 0;

    for (let d = 1; d <= daysInPrevMonth; d++) {
      const dateStr = `${prevYear}-${prevMonthStr}-${String(d).padStart(2, '0')}`;
      const dt = new Date(prevYear, prevMonth - 1, d);
      const isSunday = dt.getDay() === 0;

      const wl = worklogDayMap.get(d);
      let status: 'present' | 'absent' | 'holiday' | 'half_day' | 'late';

      if (savedGrid[d]) {
        status = savedGrid[d];
      } else if (wl) {
        const st = (wl.attendanceStatus as string) || '';
        status = st === 'late' ? 'late'
          : st === 'half_day' || st === 'half-day' ? 'half_day'
          : st === 'holiday' ? 'holiday'
          : st === 'absent' ? 'absent'
          : 'present';
      } else {
        status = isSunday ? 'holiday' : 'absent';
      }

      attendanceGrid[d] = status;

      const hours = wl?.totalHours || (status === 'present' ? 8.5 : status === 'half_day' ? 4.5 : status === 'late' ? 7.5 : 0);
      totalHoursWorked += hours;

      if (status === 'present') presentDays++;
      else if (status === 'late') lateDays++;
      else if (status === 'half_day') halfDays++;
      else if (status === 'holiday') holidayDays++;
      else absentDays++;

      dailyRecords.push({
        day: d,
        date: dateStr,
        status,
        punchIn: wl?.loginTime,
        punchOut: wl?.logoutTime,
        totalHours: hours > 0 ? Number(hours.toFixed(1)) : 0,
      });
    }

    const effectivePresentDays = presentDays + lateDays + (halfDays * 0.5);
    const attendanceRate = totalWorkingDays > 0
      ? Number(((effectivePresentDays / totalWorkingDays) * 100).toFixed(1))
      : 100;
    const punctualityRate = (presentDays + lateDays) > 0
      ? Number(((presentDays / (presentDays + lateDays)) * 100).toFixed(1))
      : 100;
    const averageHoursPerDay = effectivePresentDays > 0
      ? Number((totalHoursWorked / effectivePresentDays).toFixed(1))
      : 0;

    const attArchiveId = `att_archive_${prevYear}_${prevMonthStr}_${staffId}`;
    const attArchiveDoc: GSSMonthlyAttendanceArchive = {
      archiveId: attArchiveId,
      staffId,
      employeeId,
      employeeName: user.name,
      email: user.email,
      branch,
      branchCode,
      role: userRole,
      year: prevYear,
      month: prevMonth,
      monthName: prevMonthName,
      totalCalendarDays: daysInPrevMonth,
      totalWorkingDays,
      presentDays,
      lateDays,
      halfDays,
      absentDays,
      holidayDays,
      attendanceRate,
      punctualityRate,
      totalHoursWorked: Number(totalHoursWorked.toFixed(1)),
      averageHoursPerDay,
      attendanceGrid,
      dailyRecords,
      archivedAt: nowIso,
      archivedBy: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
      status: 'FINALIZED',
    };

    // Save attendance archive into primary monthly_attendance_archives collection
    if (db) {
      const attRef = db.collection('monthly_attendance_archives').doc(attArchiveId);
      writer.set(attRef, attArchiveDoc, { merge: true });

      // Dual-write to staff_attendance_history for fast per-staff lifetime timeline queries
      const histRef = db.collection('staff_attendance_history').doc(`hist_${staffId}_${prevYear}_${prevMonthStr}`);
      writer.set(histRef, attArchiveDoc, { merge: true });
    }
    memoryMonthlyArchives.attendance.set(attArchiveId, attArchiveDoc);
    archivedAttendanceCount++;

    // --- Build Worklog Archive ---
    const completedTasksSummary: string[] = [];
    let totalTasksCompleted = 0;
    let totalTasksPending = 0;
    let totalHoursLogged = 0;

    const formattedWorklogs: GSSMonthlyWorklogArchive['worklogs'] = staffWorklogs.map(wl => {
      const tasksComp = Array.isArray(wl.tasksCompleted) ? wl.tasksCompleted : [];
      const tasksPend = Array.isArray(wl.tasksPending) ? wl.tasksPending : [];
      totalTasksCompleted += tasksComp.length;
      totalTasksPending += tasksPend.length;
      totalHoursLogged += (wl.totalHours || 0);

      tasksComp.forEach(t => {
        if (t && typeof t === 'string' && !completedTasksSummary.includes(t)) {
          completedTasksSummary.push(t);
        }
      });

      return {
        logId: wl.id,
        date: wl.date,
        loginTime: wl.loginTime || '09:00 AM',
        logoutTime: wl.logoutTime,
        tasksCompleted: tasksComp,
        tasksPending: tasksPend,
        incompleteReason: wl.incompleteReason,
        totalHours: wl.totalHours,
        verifiedBy: wl.verifiedBy,
      };
    });

    const wlArchiveId = `wl_archive_${prevYear}_${prevMonthStr}_${staffId}`;
    const wlArchiveDoc: GSSMonthlyWorklogArchive = {
      archiveId: wlArchiveId,
      staffId,
      employeeId,
      employeeName: user.name,
      branch,
      role: userRole,
      year: prevYear,
      month: prevMonth,
      monthName: prevMonthName,
      totalWorklogsCount: staffWorklogs.length,
      totalTasksCompleted,
      totalTasksPending,
      totalHoursLogged: Number(totalHoursLogged.toFixed(1)),
      completedTasksSummary,
      worklogs: formattedWorklogs,
      archivedAt: nowIso,
      archivedBy: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
      status: 'FINALIZED',
    };

    // Save worklog archive
    if (db) {
      const wlRef = db.collection('monthly_worklog_archives').doc(wlArchiveId);
      writer.set(wlRef, wlArchiveDoc, { merge: true });
    }
    memoryMonthlyArchives.worklogs.set(wlArchiveId, wlArchiveDoc);
    archivedWorklogCount++;

    // 5. Initialize fresh attendance document for current month in staff_attendance
    const newMonthDocId = `att_${staffId}_${newYear}_${newMonth}`;
    if (db) {
      const newMonthRef = db.collection('staff_attendance').doc(newMonthDocId);
      writer.set(newMonthRef, {
        id: newMonthDocId,
        staffId,
        name: user.name,
        branch,
        role: userRole,
        year: newYear,
        month: newMonth,
        attendance: {},
        updatedAt: nowIso,
        updatedBy: {
          id: actor.id,
          name: actor.name,
          role: actor.role,
        },
      }, { merge: true });
    }
    initializedStaffCount++;
  }

  // 6. Update database in all places: branch_metrics for all 4 branches
  const branches = ['Coimbatore', 'Chennai', 'Bangalore', 'Hyderabad'];
  const newMonthStr = String(newMonth).padStart(2, '0');
  const expectedWorkingDaysNewMonth = getWorkingDaysInMonth(newYear, newMonth);

  for (const bName of branches) {
    const bCode = BRANCH_NAME_TO_CODE[bName] || bName.slice(0, 3).toUpperCase();
    const branchStaff = activeUsers.filter(u => u.branch?.toLowerCase() === bName.toLowerCase());
    const metricsDocId = `metrics_${bCode}_${newYear}_${newMonth}`;

    if (db) {
      const metricRef = db.collection('branch_metrics').doc(metricsDocId);
      writer.set(metricRef, {
        branchId: bCode,
        branchCode: bCode,
        branch: bName,
        branchName: `Gateway ${bName} Branch`,
        period: `${newYear}-${newMonthStr}`,
        year: newYear,
        month: newMonth,
        monthName: newMonthName,
        activeStaffCount: branchStaff.length,
        expectedWorkingDays: expectedWorkingDaysNewMonth,
        totalAttendanceMarked: 0,
        currentAttendanceRate: 0,
        status: 'Active',
        updatedAt: nowIso,
      }, { merge: true });
    }
  }

  // 7. Update global tracking document in systemConfig/monthly_state
  const systemStateData: MonthlyStateDoc = {
    currentActiveYear: newYear,
    currentActiveMonth: newMonth,
    lastArchivedYear: prevYear,
    lastArchivedMonth: prevMonth,
    lastRolloverAt: nowIso,
    totalEmployeesArchived: activeUsers.length,
    branchesUpdated: branches,
    status: 'ACTIVE_AND_ARCHIVED',
    isRolloverRunning: false,
    rolloverLockUntil: null,
    rolloverStartedAt: null,
  };

  if (db) {
    const stateRef = db.collection('systemConfig').doc('monthly_state');
    writer.set(stateRef, systemStateData, { merge: true });
    await writer.commit();
  }

  memoryMonthlyArchives.state = systemStateData;

  // 8. Commit immutable audit event
  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: 'MONTH_ROLLOVER_COMPLETED',
    module: 'ATTENDANCE',
    recordId: `rollover_${prevYear}_${prevMonth}_to_${newYear}_${newMonth}`,
    branch: actor.branch || 'All',
    newValue: JSON.stringify({
      previousMonth: `${prevYear}-${prevMonthStr}`,
      newMonth: `${newYear}-${newMonthStr}`,
      archivedAttendanceCount,
      archivedWorklogCount,
      initializedStaffCount,
      branchesUpdated: branches,
      timestamp: nowIso,
    }),
  }).catch(err => console.warn('[MonthRollover] Audit log error:', err));

  return {
    success: true,
    message: `Successfully completed month rollover. Previous month (${prevMonthName}) archived in collections 'monthly_attendance_archives' and 'monthly_worklog_archives' for ${activeUsers.length} staff across all branches. New month (${newMonthName}) initialized in all database locations.`,
    previousPeriod: {
      year: prevYear,
      month: prevMonth,
      monthName: prevMonthName,
    },
    currentPeriod: {
      year: newYear,
      month: newMonth,
      monthName: newMonthName,
    },
    archivedAttendanceCount,
    archivedWorklogCount,
    initializedStaffCount,
    branchesUpdated: branches,
    archivedAt: nowIso,
  };
}

/**
 * Checks whether the current calendar month has rolled over and automatically
 * triggers the archive of the previous month if not yet performed.
 */
/**
 * Checks whether the current calendar month has rolled over and automatically
 * triggers the archive of the previous month if not yet performed.
 * Employs a distributed transaction lock to prevent race conditions across serverless instances.
 */
export async function checkAndAutoExecuteMonthRollover(options?: {
  force?: boolean;
  actorId?: string;
  actorName?: string;
}): Promise<{ triggered: boolean; message?: string }> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const db = getAdminFirestore();

  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function' || typeof db.batch !== 'function') {
    if (
      memoryMonthlyArchives.state.currentActiveYear === currentYear &&
      memoryMonthlyArchives.state.currentActiveMonth === currentMonth &&
      !options?.force
    ) {
      return { triggered: false };
    }
    const res = await executeMonthRolloverAndArchive({ force: options?.force });
    return { triggered: true, message: res.message };
  }

  const stateRef = db.collection('systemConfig').doc('monthly_state');

  // Distributed transaction lock to guarantee strictly once execution across serverless containers
  let acquiredLock = false;
  try {
    acquiredLock = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(stateRef);
      const state = snap.exists ? (snap.data() as MonthlyStateDoc) : null;
      const nowTime = Date.now();

      if (state && !options?.force) {
        // If already rolled over to current or future month, no rollover needed
        if (state.currentActiveYear === currentYear && state.currentActiveMonth === currentMonth) {
          return false;
        }

        // If another serverless container is executing rollover and holds a valid lock (< 5 mins)
        if (state.isRolloverRunning && state.rolloverLockUntil) {
          const lockUntilTime = new Date(state.rolloverLockUntil).getTime();
          if (lockUntilTime > nowTime) {
            console.log('[MonthRollover] Another worker holds the active rollover lock until', state.rolloverLockUntil);
            return false;
          }
        }
      }

      // Acquire lock for 5 minutes
      const lockUntil = new Date(nowTime + 5 * 60 * 1000).toISOString();
      transaction.set(
        stateRef,
        {
          isRolloverRunning: true,
          rolloverLockUntil: lockUntil,
          rolloverStartedAt: new Date(nowTime).toISOString(),
          updatedAt: new Date(nowTime).toISOString(),
        },
        { merge: true }
      );

      return true;
    });
  } catch (lockErr) {
    console.error('[MonthRollover] Failed to acquire rollover transaction lock:', lockErr);
    return { triggered: false, message: 'Could not acquire lock for month rollover.' };
  }

  if (!acquiredLock) {
    return { triggered: false };
  }

  // Execute rollover under acquired distributed lock
  try {
    const res = await executeMonthRolloverAndArchive({
      actor: {
        id: options?.actorId || 'SYSTEM_AUTO_ROLLOVER',
        name: options?.actorName || 'Automated Calendar Month Rollover',
        role: 'superadmin',
        branch: 'All',
      },
      force: options?.force,
    });
    return { triggered: true, message: res.message };
  } catch (execErr) {
    console.error('[MonthRollover] Automated rollover execution failed:', execErr);
    // Release lock on failure so subsequent attempts can proceed
    try {
      await stateRef.set({
        isRolloverRunning: false,
        rolloverLockUntil: null,
      }, { merge: true });
    } catch {
      // Non-blocking cleanup
    }
    return { triggered: false, message: 'Automated rollover encountered an error.' };
  }
}

/**
 * Fetch archived monthly attendance records.
 * Returns records sorted by year descending, month descending, and employee name ascending.
 */
export async function getFirestoreMonthlyAttendanceArchives(filters: {
  year?: number;
  month?: number;
  branch?: string;
  staffId?: string;
}): Promise<GSSMonthlyAttendanceArchive[]> {
  const db = getAdminFirestore();
  if (!db) {
    const filtered = Array.from(memoryMonthlyArchives.attendance.values()).filter(a => {
      if (filters.year && a.year !== filters.year) return false;
      if (filters.month && a.month !== filters.month) return false;
      if (filters.branch && filters.branch !== 'All' && a.branch.toLowerCase() !== filters.branch.toLowerCase()) return false;
      if (filters.staffId && a.staffId !== filters.staffId && a.employeeId !== filters.staffId) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return (a.employeeName || '').localeCompare(b.employeeName || '');
    });
  }

  try {
    let q: FirebaseFirestore.Query = db.collection('monthly_attendance_archives');

    if (filters.year) q = q.where('year', '==', filters.year);
    if (filters.month) q = q.where('month', '==', filters.month);
    if (filters.staffId) q = q.where('staffId', '==', filters.staffId);
    if (filters.branch && filters.branch !== 'All' && filters.branch !== 'all') {
      q = q.where('branch', '==', filters.branch);
    }

    const snap = await q.get();
    const archives = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GSSMonthlyAttendanceArchive));

    return archives.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.month !== b.month) return b.month - a.month;
      return (a.employeeName || '').localeCompare(b.employeeName || '');
    });
  } catch (err) {
    console.error('[MonthRollover] Error fetching attendance archives:', err);
    return [];
  }
}

export interface StaffLifetimeAttendanceHistory {
  staffId: string;
  employeeName: string;
  totalMonthsArchived: number;
  lifetimeWorkingDays: number;
  lifetimePresentDays: number;
  lifetimeLateDays: number;
  lifetimeHalfDays: number;
  lifetimeAbsentDays: number;
  overallAttendancePercentage: number;
  overallPunctualityPercentage: number;
  totalLifetimeHours: number;
  monthlyRecords: GSSMonthlyAttendanceArchive[];
}

/**
 * Retrieves the complete lifetime month-by-month attendance history and
 * cumulative performance metrics for a specific staff member.
 */
export async function getStaffLifetimeAttendanceHistory(
  staffId: string
): Promise<StaffLifetimeAttendanceHistory | null> {
  const records = await getFirestoreMonthlyAttendanceArchives({ staffId });
  if (records.length === 0) return null;

  let totalWorkingDays = 0;
  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let totalHours = 0;

  for (const r of records) {
    totalWorkingDays += r.totalWorkingDays || 0;
    presentDays += r.presentDays || 0;
    lateDays += r.lateDays || 0;
    halfDays += r.halfDays || 0;
    absentDays += r.absentDays || 0;
    totalHours += r.totalHoursWorked || 0;
  }

  const effectivePresent = presentDays + lateDays + (halfDays * 0.5);
  const overallAttendancePercentage = totalWorkingDays > 0
    ? Number(((effectivePresent / totalWorkingDays) * 100).toFixed(1))
    : 100;
  const overallPunctualityPercentage = (presentDays + lateDays) > 0
    ? Number(((presentDays / (presentDays + lateDays)) * 100).toFixed(1))
    : 100;

  return {
    staffId,
    employeeName: records[0].employeeName,
    totalMonthsArchived: records.length,
    lifetimeWorkingDays: totalWorkingDays,
    lifetimePresentDays: presentDays,
    lifetimeLateDays: lateDays,
    lifetimeHalfDays: halfDays,
    lifetimeAbsentDays: absentDays,
    overallAttendancePercentage,
    overallPunctualityPercentage,
    totalLifetimeHours: Number(totalHours.toFixed(1)),
    monthlyRecords: records,
  };
}

/**
 * Fetch archived monthly worklogs records.
 */
export async function getFirestoreMonthlyWorklogArchives(filters: {
  year?: number;
  month?: number;
  branch?: string;
  staffId?: string;
}): Promise<GSSMonthlyWorklogArchive[]> {
  const db = getAdminFirestore();
  if (!db) {
    return Array.from(memoryMonthlyArchives.worklogs.values()).filter(w => {
      if (filters.year && w.year !== filters.year) return false;
      if (filters.month && w.month !== filters.month) return false;
      if (filters.branch && filters.branch !== 'All' && w.branch.toLowerCase() !== filters.branch.toLowerCase()) return false;
      if (filters.staffId && w.staffId !== filters.staffId) return false;
      return true;
    });
  }

  try {
    let q: FirebaseFirestore.Query = db.collection('monthly_worklog_archives');

    if (filters.year) q = q.where('year', '==', filters.year);
    if (filters.month) q = q.where('month', '==', filters.month);
    if (filters.staffId) q = q.where('staffId', '==', filters.staffId);
    if (filters.branch && filters.branch !== 'All' && filters.branch !== 'all') {
      q = q.where('branch', '==', filters.branch);
    }

    const snap = await q.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GSSMonthlyWorklogArchive));
  } catch (err) {
    console.error('[MonthRollover] Error fetching worklog archives:', err);
    return [];
  }
}

/**
 * Gets current monthly rollover and archive status.
 */
export async function getMonthlyRolloverStatus(): Promise<MonthlyStateDoc> {
  const db = getAdminFirestore();
  if (db) {
    try {
      const snap = await db.collection('systemConfig').doc('monthly_state').get();
      if (snap.exists) {
        return snap.data() as MonthlyStateDoc;
      }
    } catch {
      // fallback
    }
  }
  return memoryMonthlyArchives.state;
}
