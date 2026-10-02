import { getAdminFirestore } from '@/lib/firebase/firebase-admin';
import { getLiveDateInfo, getDatesBetween, evaluateEntryPunctuality } from '@/lib/worklogs/worklog-session-utils';
import type { User } from '@/types/auth';

/**
 * Bridges attendance across multiple calendar days (startDate through endDate inclusive).
 * Marks all intermediate days as 'present' in staff_attendance matrix and attendance collection.
 */
export async function bridgeMultiDayAttendance(
  user: User | { id: string; name: string; role?: string; branch?: string; employeeId?: string },
  startDate: string,
  endDate: string
): Promise<void> {
  const db = getAdminFirestore();
  if (!db || !startDate || !endDate || typeof db.batch !== 'function') return;

  const dates = getDatesBetween(startDate, endDate);
  if (dates.length === 0) return;

  const staffId = user.id;
  const name = user.name;
  const branch = user.branch || 'Universal';
  const role = user.role || 'employee';
  const employeeId = user.employeeId || user.id;
  const timestamp = new Date().toISOString();

  // Group dates by year and month for efficient staff_attendance batching
  const monthGroups = new Map<string, { year: number; month: number; days: number[] }>();
  for (const dateStr of dates) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) continue;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const key = `att_${staffId}_${y}_${m}`;
    if (!monthGroups.has(key)) {
      monthGroups.set(key, { year: y, month: m, days: [] });
    }
    monthGroups.get(key)!.days.push(d);
  }

  try {
    const batch = db.batch();

    // 1. Update staff_attendance grids
    for (const [gridDocId, group] of monthGroups.entries()) {
      const gridRef = db.collection('staff_attendance').doc(gridDocId);
      const gridSnap = await gridRef.get();
      const gridData = gridSnap.exists ? (gridSnap.data() as Record<string, unknown>) : {
        id: gridDocId,
        staffId,
        employeeId,
        name,
        branch,
        role,
        year: group.year,
        month: group.month,
        attendance: {},
      };
      const currentAttMap = { ...((gridData.attendance as Record<string, string>) || {}) };
      for (const dayNum of group.days) {
        if (!currentAttMap[dayNum]) {
          currentAttMap[dayNum] = 'present';
        }
      }
      batch.set(gridRef, {
        ...gridData,
        attendance: currentAttMap,
        updatedAt: timestamp,
        updatedBy: { id: staffId, name, role },
      }, { merge: true });
    }

    // 2. Ensure daily attendance records exist
    for (const dateStr of dates) {
      const attDocId = `ATT_${staffId}_${dateStr.replace(/-/g, '')}`;
      const attRef = db.collection('attendance').doc(attDocId);
      batch.set(attRef, {
        attendanceId: attDocId,
        id: attDocId,
        staffId,
        employeeId,
        staffName: name,
        name,
        role,
        branch,
        date: dateStr,
        status: 'Present',
        markedBy: 'Continuous Multi-Day Session',
        updatedAt: timestamp,
      }, { merge: true });
    }

    await batch.commit();
  } catch (err) {
    console.warn('[AutoAttendance] bridgeMultiDayAttendance warning:', err);
  }
}

/**
 * Automatically registers attendance as 'present' when a staff member logs in.
 * If an active unclosed session exists from a previous day, it carries forward seamlessly,
 * bridging attendance for all intervening days until they logout with completed tasks.
 */
export async function registerStaffAttendanceOnLogin(user: User): Promise<void> {
  // Only active staff members register attendance
  if (!user || user.status !== 'active') return;

  const liveInfo = getLiveDateInfo();
  const { year, month, day, isoDate, currentTime } = liveInfo;
  const staffId = user.id;
  const employeeId = user.employeeId || user.id;
  const branch = user.branch || 'Universal';
  const now = new Date();
  const timestamp = now.toISOString();

  // Strict Shift-Based Punctuality Evaluation
  // Evaluates against staff member's configured shift entry timing (default: 09:30 AM)
  const shiftEntry = user.entryTime || user.shiftTiming?.entryTime || '09:30 AM';
  const punctuality = evaluateEntryPunctuality(currentTime, shiftEntry);
  const status: 'present' | 'late' | 'half_day' = punctuality.entryStatus === 'half_day' ? 'half_day' : punctuality.isLate ? 'late' : 'present';
  const displayStatus = status === 'late' ? 'Late' : status === 'half_day' ? 'Half-Day' : 'Present';

  // 1. In-memory worklog store fallback
  try {
    const { addWorkLog } = await import('@/lib/worklogs/worklog-store');
    addWorkLog({
      id: `WL_${staffId}_${isoDate.replace(/-/g, '')}`,
      userId: staffId,
      userName: user.name,
      userRole: user.role,
      branch,
      date: isoDate,
      loginTime: currentTime,
      logoutTime: null,
      plannedTasks: [],
      completedTasks: [],
      attendanceStatus: status,
    });
  } catch {
    // Non-blocking in-memory fallback
  }

  // 2. Cloud Firestore Canonical Attendance Persistence
  const db = getAdminFirestore();
  if (!db) return;

  try {
    // Check if staff has an unclosed work session from a prior date
    try {
      const wlCol = db.collection('daily_worklogs');
      if (typeof wlCol.where === 'function') {
        const unclosedSnap = await wlCol
          .where('userId', '==', staffId)
          .where('logoutTime', '==', null)
          .get();

        if (unclosedSnap && !unclosedSnap.empty) {
          // Sort to find earliest or latest active unclosed doc
          const docs = unclosedSnap.docs.map(d => d.data() as Record<string, unknown>);
          const activeDoc = docs.find(d => typeof d.date === 'string' && d.loginTime);
          if (activeDoc && typeof activeDoc.date === 'string') {
            const startDate = activeDoc.date;
            // Bridge all intermediate days up to today as present
            await bridgeMultiDayAttendance(user, startDate, isoDate);
            console.log(`[AutoAttendance] Carried forward active multi-day session for ${user.name} from ${startDate} to ${isoDate}`);
            return;
          }
        }
      }
    } catch (unclosedErr) {
      console.warn('[AutoAttendance] Active session check note:', unclosedErr);
    }

    const gridDocId = `att_${staffId}_${year}_${month}`;
    const attDocId = `ATT_${staffId}_${isoDate.replace(/-/g, '')}`;
    const wlDocId = `WL_${staffId}_${isoDate.replace(/-/g, '')}`;

    const gridRef = db.collection('staff_attendance').doc(gridDocId);
    const attRef = db.collection('attendance').doc(attDocId);
    const wlRef = db.collection('daily_worklogs').doc(wlDocId);

    await db.runTransaction(async (transaction) => {
      const gridSnap = await transaction.get(gridRef);
      const attSnap = await transaction.get(attRef);
      const wlSnap = await transaction.get(wlRef);

      // A. Staff Attendance Matrix (staff_attendance collection)
      const gridData = gridSnap.exists
        ? (gridSnap.data() as Record<string, unknown>)
        : {
            id: gridDocId,
            staffId,
            employeeId,
            name: user.name,
            branch,
            role: user.role,
            year,
            month,
            attendance: {},
          };

      const currentAttMap = { ...((gridData.attendance as Record<string, string>) || {}) };
      // Register today's day based on strict punctuality (preserve if already explicitly recorded)
      if (!currentAttMap[day]) {
        currentAttMap[day] = status;
      }

      transaction.set(
        gridRef,
        {
          ...gridData,
          id: gridDocId,
          staffId,
          employeeId,
          name: user.name,
          branch,
          role: user.role,
          year,
          month,
          punchInTime: (gridData.punchInTime as string) || currentTime,
          attendance: currentAttMap,
          updatedAt: timestamp,
          updatedBy: {
            id: staffId,
            name: user.name,
            role: user.role,
          },
        },
        { merge: true }
      );

      // B. Daily Attendance Record (attendance collection)
      if (!attSnap.exists) {
        transaction.set(attRef, {
          attendanceId: attDocId,
          id: attDocId,
          staffId,
          employeeId,
          staffName: user.name,
          name: user.name,
          role: user.role,
          branch,
          date: isoDate,
          day: liveInfo.dayOfWeek,
          checkIn: currentTime,
          loginTime: currentTime,
          status: displayStatus,
          isLate: punctuality.isLate,
          minutesLate: punctuality.minutesLate,
          shiftEntryTime: shiftEntry,
          markedBy: 'Auto-Login (System)',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // C. Daily Worklog Record (daily_worklogs collection)
      if (!wlSnap.exists) {
        transaction.set(wlRef, {
          id: wlDocId,
          userId: staffId,
          employeeId,
          userName: user.name,
          userRole: user.role,
          branch,
          date: isoDate,
          loginTime: currentTime,
          logoutTime: null,
          plannedTasks: [],
          completedTasks: [],
          attendanceStatus: status,
          isLate: punctuality.isLate,
          minutesLate: punctuality.minutesLate,
          verifiedStatus: punctuality.statusLabel,
          hoursLogged: 0,
          totalHours: 'Active',
          workingMinutes: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } else if (!wlSnap.data()?.loginTime) {
        transaction.update(wlRef, {
          loginTime: currentTime,
          attendanceStatus: status,
          isLate: punctuality.isLate,
          minutesLate: punctuality.minutesLate,
          verifiedStatus: punctuality.statusLabel,
          updatedAt: timestamp,
        });
      }
    });

    console.log(`[AutoAttendance] Registered attendance as '${status}' (shift entry: ${shiftEntry}, login: ${currentTime}) for ${user.name} (${staffId}) on ${isoDate}`);
  } catch (err) {
    console.error('[AutoAttendance] Error registering attendance on login:', err);
  }

  // 3. Proactive Month-End Rollover & Archiving Check (Non-blocking background execution)
  // Ensures that on month transition, the previous month's attendance & worklogs are
  // automatically sealed into separate archive collections immediately.
  import('@/lib/attendance/month-rollover-service').then(({ checkAndAutoExecuteMonthRollover }) => {
    checkAndAutoExecuteMonthRollover().catch(err => {
      console.warn('[AutoAttendance] Background rollover check warning:', err);
    });
  }).catch(() => {});
}
