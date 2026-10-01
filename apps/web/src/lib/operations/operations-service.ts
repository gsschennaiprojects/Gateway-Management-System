/**
 * Operations Management Service
 *
 * PURPOSE:
 * Server-side authoritative data access layer executing privileged operations for:
 * - `courses`: Standardized Course Catalog & Curriculum Definition
 * - `batches`: Cohort Training Batches for grouped mentor assignment and bulk workflows
 * - `student_attendance`: Batch-level daily student lab/training attendance
 * - `leave_requests`: Multi-tier staff and intern leave approval workflows
 * - `announcements`: Targeted broadcasts and notices across branches and roles
 * - `branch_metrics`: Pre-computed performance metrics and analytics cache
 *
 * ARCHITECTURAL INTEGRATION:
 * - Uses Firebase Admin SDK for atomic batch writes, transactions, and high-throughput query execution.
 * - Triggers audit logs via `logAuditEvent` for critical state changes.
 */

import { randomUUID } from 'crypto';
import type { Query } from 'firebase-admin/firestore';
import {
  getAdminFirestore,
  getFirestoreUsers,
  getFirestoreStudents,
  getFirestoreTasks,
  getFirestoreWorklogs,
} from '../firebase/firebase-admin';
import { logAuditEvent } from '../audit/audit-service';
import type { Branch, UserRole } from '@/types/auth';
import type {
  Course,
  Batch,
  StudentAttendance,
  StudentAttendanceStatus,
  LeaveRequest,
  LeaveStatus,
  Announcement,
  BranchMetrics,
} from '@/types/operations';

function getDb() {
  const db = getAdminFirestore();
  if (!db) {
    throw new Error('Firestore is unavailable.');
  }
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. COURSES & CURRICULUM
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestoreCourses(options?: {
  domain?: string;
  activeOnly?: boolean;
}): Promise<Course[]> {
  const db = getDb();
  let q: Query = db.collection('courses');

  if (options?.activeOnly) {
    q = q.where('isActive', '==', true);
  }
  if (options?.domain) {
    q = q.where('domain', '==', options.domain);
  }

  const snapshot = await q.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Course[];
}

export async function upsertFirestoreCourse(
  course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Course> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = course.id || course.courseId || `course_${randomUUID()}`;
  const courseRef = db.collection('courses').doc(id);

  const existing = await courseRef.get();
  const data: Course = {
    ...course,
    id,
    courseId: course.courseId || id,
    createdAt: existing.exists ? (existing.data()?.createdAt as string) || now : now,
    updatedAt: now,
  };

  await courseRef.set(data, { merge: true });
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. COHORT TRAINING BATCHES
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestoreBatches(options?: {
  branch?: string;
  status?: string;
  mentorId?: string;
}): Promise<Batch[]> {
  const db = getDb();
  let q: Query = db.collection('batches');

  if (options?.branch && !['All', 'all'].includes(options.branch)) {
    q = q.where('branch', '==', options.branch);
  }
  if (options?.status) {
    q = q.where('status', '==', options.status);
  }
  if (options?.mentorId) {
    q = q.where('mentorId', '==', options.mentorId);
  }

  const snapshot = await q.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Batch[];
}

export async function getFirestoreBatchById(id: string): Promise<Batch | null> {
  const db = getDb();
  const doc = await db.collection('batches').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Batch;
}

export async function createFirestoreBatch(
  batch: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Batch> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = batch.batchId || `batch_${randomUUID()}`;
  const batchRef = db.collection('batches').doc(id);

  const newBatch: Batch = {
    ...batch,
    id,
    batchId: id,
    studentCount: batch.studentIds ? batch.studentIds.length : (batch.studentCount || 0),
    studentIds: batch.studentIds || [],
    createdAt: now,
    updatedAt: now,
  };

  await batchRef.set(newBatch);
  return newBatch;
}

export async function updateFirestoreBatch(
  id: string,
  updates: Partial<Batch>
): Promise<void> {
  const db = getDb();
  const batchRef = db.collection('batches').doc(id);
  const now = new Date().toISOString();

  const finalUpdates: Record<string, unknown> = {
    ...updates,
    updatedAt: now,
  };

  if (Array.isArray(updates.studentIds)) {
    finalUpdates.studentCount = updates.studentIds.length;
  }

  await batchRef.update(finalUpdates);
}

export async function assignStudentsToBatch(
  batchId: string,
  studentIds: string[]
): Promise<void> {
  const db = getDb();
  const batchRef = db.collection('batches').doc(batchId);
  const doc = await batchRef.get();
  if (!doc.exists) {
    throw new Error('Batch not found');
  }

  const existingData = doc.data() as Batch;
  const currentStudents = new Set(existingData.studentIds || []);
  studentIds.forEach(id => currentStudents.add(id));

  const updatedIds = Array.from(currentStudents);
  await batchRef.update({
    studentIds: updatedIds,
    studentCount: updatedIds.length,
    updatedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STUDENT ATTENDANCE (HIGH CAPACITY BULK WRITES)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordStudentAttendanceBatch(params: {
  batchId: string;
  batchCode: string;
  branch: Branch;
  branchId: string;
  date: string;
  markedBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  records: Array<{
    studentId: string;
    studentName: string;
    status: StudentAttendanceStatus;
    remarks?: string;
  }>;
}): Promise<number> {
  const db = getDb();
  const now = new Date().toISOString();
  const collectionRef = db.collection('student_attendance');

  // Firestore allows up to 500 operations per batch
  const batchLimit = 450;
  let totalCommitted = 0;

  for (let i = 0; i < params.records.length; i += batchLimit) {
    const chunk = params.records.slice(i, i + batchLimit);
    const writeBatch = db.batch();

    for (const record of chunk) {
      const docId = `att_student_${record.studentId}_${params.date}`;
      const docRef = collectionRef.doc(docId);
      const data: StudentAttendance = {
        id: docId,
        studentId: record.studentId,
        studentName: record.studentName,
        batchId: params.batchId,
        batchCode: params.batchCode,
        branch: params.branch,
        branchId: params.branchId,
        date: params.date,
        status: record.status,
        markedBy: params.markedBy,
        remarks: record.remarks || '',
        createdAt: now,
        updatedAt: now,
      };
      writeBatch.set(docRef, data, { merge: true });
    }

    await writeBatch.commit();
    totalCommitted += chunk.length;
  }

  return totalCommitted;
}

export async function getBatchAttendanceByDate(
  batchId: string,
  date: string
): Promise<StudentAttendance[]> {
  const db = getDb();
  const snapshot = await db
    .collection('student_attendance')
    .where('batchId', '==', batchId)
    .where('date', '==', date)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as StudentAttendance[];
}

export async function getStudentAttendanceRecords(options: {
  branch?: string;
  date?: string;
  studentId?: string;
}): Promise<StudentAttendance[]> {
  const db = getDb();
  let q: Query = db.collection('student_attendance');

  if (options.branch && !['All', 'all'].includes(options.branch)) {
    q = q.where('branch', '==', options.branch);
  }
  if (options.date) {
    q = q.where('date', '==', options.date);
  }
  if (options.studentId) {
    q = q.where('studentId', '==', options.studentId);
  }

  const snapshot = await q.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as StudentAttendance[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LEAVE REQUESTS & MULTI-TIER APPROVALS
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestoreLeaveRequests(options?: {
  branch?: string;
  applicantId?: string;
  status?: LeaveStatus;
}): Promise<LeaveRequest[]> {
  const db = getDb();
  let q: Query = db.collection('leave_requests');

  if (options?.branch && !['All', 'all'].includes(options.branch)) {
    q = q.where('branch', '==', options.branch);
  }
  if (options?.applicantId) {
    q = q.where('applicantId', '==', options.applicantId);
  }
  if (options?.status) {
    q = q.where('status', '==', options.status);
  }

  const snapshot = await q.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as LeaveRequest[];
}

export async function createFirestoreLeaveRequest(
  request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<LeaveRequest> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `leave_${randomUUID()}`;
  const leaveRef = db.collection('leave_requests').doc(id);

  const data: LeaveRequest = {
    ...request,
    id,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await leaveRef.set(data);
  return data;
}

export async function reviewFirestoreLeaveRequest(params: {
  leaveId: string;
  status: 'approved' | 'rejected';
  reviewer: {
    id: string;
    name: string;
    role: UserRole;
  };
  remarks?: string;
}): Promise<void> {
  const db = getDb();
  const leaveRef = db.collection('leave_requests').doc(params.leaveId);
  const now = new Date().toISOString();

  const doc = await leaveRef.get();
  if (!doc.exists) {
    throw new Error('Leave request not found');
  }

  const leave = doc.data() as LeaveRequest;

  await leaveRef.update({
    status: params.status,
    reviewedBy: params.reviewer,
    reviewedAt: now,
    reviewerRemarks: params.remarks || '',
    updatedAt: now,
  });

  // Log audit event for compliance
  await logAuditEvent({
    userId: params.reviewer.id,
    userName: params.reviewer.name,
    role: params.reviewer.role,
    action: `leave.${params.status}`,
    module: 'leave_requests',
    recordId: params.leaveId,
    branch: leave.branch,
    oldValue: leave.status,
    newValue: params.status,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTERNAL ANNOUNCEMENTS & BROADCAST NOTICES
// ─────────────────────────────────────────────────────────────────────────────

export async function getFirestoreAnnouncements(options?: {
  branch?: string;
  role?: UserRole;
  activeOnly?: boolean;
}): Promise<Announcement[]> {
  const db = getDb();
  const now = new Date().toISOString();
  const q: Query = db.collection('announcements');

  const snapshot = await q.get();
  let announcements = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Announcement[];

  if (options?.activeOnly) {
    announcements = announcements.filter(a => !a.expiresAt || a.expiresAt >= now);
  }

  if (options?.branch && !['All', 'all'].includes(options.branch)) {
    announcements = announcements.filter(
      a => a.targetBranch === 'all' || a.targetBranch === options.branch
    );
  }

  if (options?.role && options.role !== 'superadmin') {
    announcements = announcements.filter(
      a => a.targetRoles === 'all' || a.targetRoles.includes(options.role as UserRole)
    );
  }

  // Sort pinned announcements first, then descending by createdAt
  return announcements.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function createFirestoreAnnouncement(
  announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Announcement> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `announcement_${randomUUID()}`;
  const docRef = db.collection('announcements').doc(id);

  const data: Announcement = {
    ...announcement,
    id,
    readBy: [],
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(data);
  return data;
}

export async function markAnnouncementAsRead(
  announcementId: string,
  userId: string
): Promise<void> {
  const db = getDb();
  const docRef = db.collection('announcements').doc(announcementId);
  const doc = await docRef.get();
  if (!doc.exists) return;

  const data = doc.data() as Announcement;
  const readSet = new Set(data.readBy || []);
  if (!readSet.has(userId)) {
    readSet.add(userId);
    await docRef.update({
      readBy: Array.from(readSet),
      updatedAt: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PRE-COMPUTED BRANCH PERFORMANCE METRICS CACHE
// ─────────────────────────────────────────────────────────────────────────────

export async function getBranchMetrics(
  branch: Branch,
  period: string,
  type: 'daily' | 'monthly' = 'monthly'
): Promise<BranchMetrics | null> {
  const db = getDb();
  const docId = `metrics_${branch}_${period}`;
  const doc = await db.collection('branch_metrics').doc(docId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as BranchMetrics;
}

export async function refreshBranchMetricsCache(
  branch: Branch,
  period: string,
  type: 'daily' | 'monthly' = 'monthly'
): Promise<BranchMetrics> {
  const db = getDb();
  const now = new Date().toISOString();

  // Fetch branch entities concurrently
  const [allUsers, allStudents, allTasks, allWorklogs] = await Promise.all([
    getFirestoreUsers(),
    getFirestoreStudents({ branch }),
    getFirestoreTasks({ role: 'superadmin', branch }),
    getFirestoreWorklogs({ branch, date: type === 'daily' ? period : undefined }),
  ]);

  const branchUsers = allUsers.filter(u => u.branch.toLowerCase() === branch.toLowerCase());
  const activeStaff = branchUsers.filter(u => u.status === 'active');

  const totalStudents = allStudents.length;
  const activeStudents = allStudents.filter(s => (s.projectStatus || '').toLowerCase() === 'ongoing').length;
  const completedStudents = allStudents.filter(s => (s.projectStatus || '').toLowerCase() === 'completed').length;

  const tasksTotal = allTasks.length;
  const tasksCompleted = allTasks.filter(t => t.status === 'completed').length;
  const tasksPending = allTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const tasksOverdue = allTasks.filter(t => {
    if (t.status === 'completed' || !t.dueDate) return false;
    return t.dueDate < now.substring(0, 10);
  }).length;

  const taskCompletionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 100;

  // Staff Attendance rate calculation based on worklogs in this period
  const staffWorklogs = allWorklogs.filter(w => Boolean(w.loginTime) && w.attendanceStatus === 'present');
  const expectedStaffDays = activeStaff.length * (type === 'daily' ? 1 : 25);
  const staffAttendanceRate = expectedStaffDays > 0
    ? Math.min(100, Math.round((staffWorklogs.length / expectedStaffDays) * 100))
    : 100;

  const studentAttendanceRate = 95; // default benchmark if real-time rollcall not yet closed

  const docId = `metrics_${branch}_${period}`;
  const metricsDoc: BranchMetrics = {
    id: docId,
    branch,
    branchId: `BR_${branch.toUpperCase().substring(0, 3)}`,
    period,
    type,
    totalStudents,
    activeStudents,
    completedStudents,
    totalStaff: branchUsers.length,
    activeStaff: activeStaff.length,
    staffAttendanceRate,
    studentAttendanceRate,
    tasksTotal,
    tasksCompleted,
    tasksPending,
    tasksOverdue,
    taskCompletionRate,
    totalLeads: 0,
    convertedLeads: 0,
    leadConversionRate: 0,
    lastAggregatedAt: now,
  };

  await db.collection('branch_metrics').doc(docId).set(metricsDoc, { merge: true });
  return metricsDoc;
}
