import { getAdminFirestore } from '@/lib/firebase/firebase-admin';
import { getLiveDateInfo } from '@/lib/worklogs/worklog-session-utils';
import type { User } from '@/types/auth';

/**
 * Automatically registers attendance as 'present' when a staff member logs in.
 * Until a staff member logs in, their attendance for today remains blank (unrecorded).
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
      attendanceStatus: 'present',
    });
  } catch {
    // Non-blocking in-memory fallback
  }

  // 2. Cloud Firestore Canonical Attendance Persistence
  const db = getAdminFirestore();
  if (!db) return;

  try {
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
      // Register today's day as present on login (preserve if already late or half_day)
      if (!currentAttMap[day]) {
        currentAttMap[day] = 'present';
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
          status: 'Present',
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
          attendanceStatus: 'present',
          hoursLogged: 0,
          totalHours: 'Active',
          workingMinutes: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } else if (!wlSnap.data()?.loginTime) {
        transaction.update(wlRef, {
          loginTime: currentTime,
          attendanceStatus: 'present',
          updatedAt: timestamp,
        });
      }
    });

    console.log(`[AutoAttendance] Registered attendance as 'present' for ${user.name} (${staffId}) on ${isoDate} at ${currentTime}`);
  } catch (err) {
    console.error('[AutoAttendance] Error registering attendance on login:', err);
  }
}
