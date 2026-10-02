/**
 * Production Staff Attendance Service
 *
 * Provides authoritative Firestore read, update, and overwrite operations
 * for monthly staff attendance matrices across branches, with transactional
 * audit logging and asynchronous Google Sheets projection outbox queuing.
 */

import { getAdminFirestore, getFirestoreUsers, getFirestoreWorklogs } from '../firebase/firebase-admin';
import { logAuditEvent } from '../audit/audit-service';
import { getLiveDateInfo } from '../worklogs/worklog-session-utils';
import type { UserRole } from '@/types/auth';

export interface StaffAttendanceDayStatus {
  [day: number]: 'present' | 'absent' | 'holiday' | 'half_day' | 'late';
}

export interface StaffAttendanceGridRecord {
  id: string; // staffId
  name: string;
  role: string;
  branch: string;
  punchInTime?: string;
  punchOutTime?: string;
  attendance: StaffAttendanceDayStatus;
  lastUpdated?: string;
  updatedBy?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface StaffMonthlyAttendanceDoc {
  id: string;
  staffId: string;
  name: string;
  branch: string;
  role: string;
  year: number;
  month: number;
  attendance: StaffAttendanceDayStatus;
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string;
    role: string;
  };
}

export async function getFirestoreStaffAttendanceGrid(params: {
  year: number;
  month: number;
  branch?: string;
}): Promise<{ records: StaffAttendanceGridRecord[]; lastUpdated: string | null }> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Database is unavailable.');

  const { year, month, branch } = params;

  // 1. Fetch active staff users
  const allUsers = await getFirestoreUsers();
  const activeUsers = allUsers.filter(u => {
    if (u.status !== 'active') return false;
    if (branch && branch !== 'All' && branch !== 'all') {
      return u.branch.toLowerCase() === branch.toLowerCase();
    }
    return true;
  });

  // 2. Fetch saved monthly attendance documents from Firestore
  let attQuery = db.collection('staff_attendance')
    .where('year', '==', year)
    .where('month', '==', month);

  const attSnapshot = await attQuery.get();
  const savedDocsMap = new Map<string, StaffMonthlyAttendanceDoc>();
  let latestUpdate: string | null = null;

  attSnapshot.forEach(doc => {
    const data = doc.data() as StaffMonthlyAttendanceDoc;
    savedDocsMap.set(data.staffId, data);
    if (data.updatedAt && (!latestUpdate || data.updatedAt > latestUpdate)) {
      latestUpdate = data.updatedAt;
    }
  });

  // If no current records found in staff_attendance, check the long-term monthly_attendance_archives collection
  if (savedDocsMap.size === 0) {
    try {
      const archiveSnap = await db.collection('monthly_attendance_archives')
        .where('year', '==', year)
        .where('month', '==', month)
        .get();

      archiveSnap.forEach(doc => {
        const d = doc.data();
        if (d.staffId) {
          savedDocsMap.set(d.staffId, {
            id: doc.id,
            staffId: d.staffId,
            name: d.employeeName || 'Staff Member',
            branch: d.branch || '',
            role: d.role || 'employee',
            year: d.year,
            month: d.month,
            attendance: d.attendanceGrid || {},
            updatedAt: d.archivedAt,
            updatedBy: d.archivedBy,
          });
          if (d.archivedAt && (!latestUpdate || d.archivedAt > latestUpdate)) {
            latestUpdate = d.archivedAt;
          }
        }
      });
    } catch (archiveErr) {
      console.warn('[AttendanceService] Archive fallback query warning:', archiveErr);
    }
  }

  // 3. Fetch monthly worklogs to determine punch times and default present states
  const monthStr = String(month).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDateStr = `${year}-${monthStr}-01`;
  const endDateStr = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const worklogs = await getFirestoreWorklogs();
  const monthlyLogs = worklogs.filter(l => l.date >= startDateStr && l.date <= endDateStr);

  const punchInfoMap = new Map<string, { punchIn?: string; punchOut?: string; dayStatuses: Map<number, 'present' | 'absent' | 'holiday' | 'half_day' | 'late'> }>();
  for (const log of monthlyLogs) {
    if (!punchInfoMap.has(log.userId)) {
      punchInfoMap.set(log.userId, { dayStatuses: new Map() });
    }
    const userPunch = punchInfoMap.get(log.userId)!;
    const day = parseInt(log.date.split('-')[2], 10);
    if (!isNaN(day)) {
      const st = (log.attendanceStatus as string) || '';
      // Only record day status if user actually logged in or had an explicit status
      if (log.loginTime || (st && st !== '')) {
        const mappedStatus: 'present' | 'absent' | 'holiday' | 'half_day' | 'late' =
          st === 'late'
            ? 'late'
            : st === 'half_day' || st === 'half-day'
              ? 'half_day'
              : st === 'holiday'
                ? 'holiday'
                : st === 'absent'
                  ? 'absent'
                  : 'present';

        userPunch.dayStatuses.set(day, mappedStatus);
      }

      // If log is today
      const todayDateStr = getLiveDateInfo().isoDate;
      if (log.date === todayDateStr) {
        userPunch.punchIn = log.loginTime || undefined;
        userPunch.punchOut = log.logoutTime || undefined;
      }
    }
  }

  // 4. Construct merged grid records
  const records: StaffAttendanceGridRecord[] = activeUsers.map(user => {
    const saved = savedDocsMap.get(user.id);
    const punch = punchInfoMap.get(user.id);

    const attendance: StaffAttendanceDayStatus = {};

    // If worklogs indicate presence, initialize as default
    if (punch) {
      for (const [d, st] of punch.dayStatuses.entries()) {
        attendance[d] = st;
      }
    }

    // Overwrite with canonical saved records from Firestore
    if (saved && saved.attendance) {
      for (const [dayKey, status] of Object.entries(saved.attendance)) {
        const d = parseInt(dayKey, 10);
        if (!isNaN(d) && ['present', 'absent', 'holiday', 'half_day', 'late'].includes(status)) {
          attendance[d] = status as 'present' | 'absent' | 'holiday' | 'half_day' | 'late';
        }
      }
    }

    return {
      id: user.id,
      name: user.name,
      role: `${user.role.toUpperCase()} (${user.specialization || user.branch || 'Operations'})`,
      branch: user.branch,
      punchInTime: punch?.punchIn,
      punchOutTime: punch?.punchOut,
      attendance,
      lastUpdated: saved?.updatedAt,
      updatedBy: saved?.updatedBy,
    };
  });

  return { records, lastUpdated: latestUpdate };
}

export async function saveFirestoreStaffAttendanceGrid(params: {
  year: number;
  month: number;
  records: Array<{
    staffId: string;
    name: string;
    attendance: StaffAttendanceDayStatus;
  }>;
  actor: {
    id: string;
    name: string;
    role: UserRole;
    branch: string;
  };
}): Promise<{ count: number; updatedAt: string }> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Database is unavailable.');

  const { year, month, records, actor } = params;
  if (!records || !Array.isArray(records) || records.length === 0) {
    throw new Error('No attendance records provided for saving.');
  }

  const now = new Date().toISOString();
  const allUsers = await getFirestoreUsers();
  const userMap = new Map(allUsers.map(u => [u.id, u]));

  const batch = db.batch();
  let count = 0;

  for (const record of records) {
    if (!record.staffId) continue;
    const user = userMap.get(record.staffId);
    const branch = user?.branch || actor.branch;
    const role = user?.role || 'employee';

    // Sanitize attendance map
    const cleanAttendance: StaffAttendanceDayStatus = {};
    if (record.attendance && typeof record.attendance === 'object') {
      for (const [dStr, st] of Object.entries(record.attendance)) {
        const d = parseInt(dStr, 10);
        if (!isNaN(d) && d >= 1 && d <= 31) {
          if (['present', 'absent', 'holiday', 'half_day', 'late'].includes(st)) {
            cleanAttendance[d] = st as 'present' | 'absent' | 'holiday' | 'half_day' | 'late';
          }
        }
      }
    }

    const docId = `att_${record.staffId}_${year}_${month}`;
    const docRef = db.collection('staff_attendance').doc(docId);

    const docData: StaffMonthlyAttendanceDoc = {
      id: docId,
      staffId: record.staffId,
      name: record.name || user?.name || 'Staff Member',
      branch,
      role,
      year,
      month,
      attendance: cleanAttendance,
      updatedAt: now,
      updatedBy: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
      },
    };

    batch.set(docRef, docData, { merge: true });

    // Outbox projection for Google Sheets (04_Staff_Attendance)
    const projectionRef = db.collection('projection_jobs').doc(`att:${docId}:${Date.now()}`);
    batch.set(projectionRef, {
      id: projectionRef.id,
      type: 'staff_attendance.project',
      entityId: docId,
      branchId: branch,
      year,
      month,
      state: 'pending',
      attempts: 0,
      createdAt: now,
    });

    count++;
  }

  await batch.commit();

  // Immutable audit log
  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: 'ATTENDANCE_OVERWRITE',
    module: 'ATTENDANCE',
    recordId: `att_${year}_${month}`,
    branch: actor.branch,
    newValue: JSON.stringify({
      year,
      month,
      recordsUpdated: count,
      updatedAt: now,
    }),
  }).catch(auditErr => {
    console.error('[AttendanceService] Audit log failed:', auditErr);
  });

  return { count, updatedAt: now };
}
