/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — FIRESTORE SERVICE
 * CRUD operations for Users, Tasks, Students, and Audit Logs
 * ============================================================================
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';

// ─── Collection Names ──────────────────────────────────────────────────────────

export const COLLECTIONS = {
  USERS: 'users',
  TASKS: 'tasks',
  STUDENTS: 'students',
  AUDIT_LOGS: 'audit_logs',
  BRANCHES: 'branches',
  DAILY_WORKLOGS: 'daily_worklogs',
  ATTENDANCE: 'attendance',
  CANDIDATE_LEADS: 'candidate_leads',
  SYSTEM_CONFIG: 'systemConfig',
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GSSUser {
  uid: string;
  employeeId: string;
  name: string;
  email: string;
  mobile?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'EMPLOYEE' | 'INTERN';
  branchId: string;
  designation?: string;
  department?: string;
  status: string;
  accountStatus: string;
  permissions?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLogin?: unknown;
}

export interface GSSTask {
  taskId: string;
  branchId: string;
  assignedById: string;
  assignedByName: string;
  assignedToId: string;
  assignedToName: string;
  assignedToMultiple: string[];
  taskTitle: string;
  taskDescription: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  category: string;
  startDate: string;
  expectedCompletionDate: string;
  completedDate: string;
  status: 'Assigned' | 'On Progress' | 'Completed' | 'Partially Stopped';
  progressPercentage: number;
  remarks: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GSSStudent {
  studentId: string;
  studentName: string;
  branchId: string;
  college: string;
  department: string;
  year: string;
  email: string;
  mobile: string;
  domain: string;
  course: string;
  assignedToId: string;
  assignedToName: string;
  startDate: string;
  expectedEndDate: string;
  feeStatus: 'Paid' | 'Partial' | 'Pending';
  projectStatus: 'Not Started' | 'Ongoing' | 'Under Review' | 'Completed';
  studentStatus: 'Active' | 'Completed' | 'Discontinued';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GSSDailyWorklog {
  logId: string;
  date: string;
  staffId: string;
  staffName: string;
  role: string;
  branchId: string;
  loginTime: string;
  logoutTime?: string;
  tasksCompleted: string[];
  tasksPending: string[];
  incompleteReason?: string;
  totalHours?: number;
  verifiedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GSSAttendanceRecord {
  attendanceId: string;
  date: string;
  day: string;
  staffId: string;
  staffName: string;
  role: string;
  branchId: string;
  checkIn: string;
  checkOut?: string;
  totalHours?: number;
  status: 'Present' | 'Absent' | 'Half-Day' | 'On Leave' | 'Holiday';
  markedBy: string;
  createdAt?: unknown;
}

export interface GSSCandidateLead {
  leadId: string;
  dateReceived: string;
  candidateName: string;
  email: string;
  mobile: string;
  city?: string;
  courseInterested: string;
  source: string;
  assignedHrId: string;
  leadStatus: 'New' | 'Contacted' | 'Interested' | 'Not Interested' | 'Enrolled' | 'Rejected';
  remarks?: string;
  dedupeKey: string;
  branchId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GSSBranch {
  branchId: string;       // e.g. "BR_CBE_02"
  branchName: string;     // e.g. "Gateway Coimbatore Branch"
  branchCode: string;     // e.g. "CBE"
  location: string;       // e.g. "Coimbatore, Tamil Nadu"
  address: string;
  contactEmail: string;
  contactPhone: string;
  workStartTime: string;  // e.g. "09:00 AM"
  workEndTime: string;    // e.g. "06:00 PM"
  status: 'Active' | 'Inactive' | 'Under Renovation';
  spreadsheetId: string;  // Google Sheets ID for this branch
  employeeCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// ─── Generic CRUD Operations ───────────────────────────────────────────────────

/**
 * Create or overwrite a document in a collection.
 */
export async function createDocument<T extends DocumentData>(
  collectionName: string,
  docId: string,
  data: T
): Promise<void> {
  const db = getFirestoreDb();
  await setDoc(doc(db, collectionName, docId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update fields on an existing document (merge).
 */
export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a single document by ID.
 */
export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

/**
 * Delete a document by ID.
 */
export async function removeDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Query documents with filters, ordering, and pagination.
 */
export async function queryDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const db = getFirestoreDb();
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as T));
}

// ─── User Operations ───────────────────────────────────────────────────────────

/**
 * Create or update user profile in Firestore.
 */
export async function upsertUserProfile(user: GSSUser): Promise<void> {
  await createDocument(COLLECTIONS.USERS, user.uid, user);
}

/**
 * Get user profile by Firebase UID.
 */
export async function getUserProfile(uid: string): Promise<GSSUser | null> {
  return getDocument<GSSUser>(COLLECTIONS.USERS, uid);
}

/**
 * Get all users for a specific branch.
 */
export async function getBranchUsers(branchId: string): Promise<GSSUser[]> {
  return queryDocuments<GSSUser>(COLLECTIONS.USERS, [
    where('branchId', '==', branchId),
    orderBy('name', 'asc'),
  ]);
}

/**
 * Get users by role in a branch.
 */
export async function getUsersByRole(
  branchId: string,
  role: GSSUser['role']
): Promise<GSSUser[]> {
  return queryDocuments<GSSUser>(COLLECTIONS.USERS, [
    where('branchId', '==', branchId),
    where('role', '==', role),
  ]);
}

// ─── Task Operations ───────────────────────────────────────────────────────────

/**
 * Create a new task document.
 */
export async function createTask(task: GSSTask): Promise<void> {
  await createDocument(COLLECTIONS.TASKS, task.taskId, task);
}

/**
 * Update task status in Firestore.
 */
export async function updateTaskStatus(
  taskId: string,
  status: GSSTask['status'],
  progressPercentage: number,
  remarks?: string
): Promise<void> {
  const updates: Partial<GSSTask> = { status, progressPercentage };
  if (remarks) updates.remarks = remarks;
  if (status === 'Completed') updates.completedDate = new Date().toLocaleDateString('en-GB').split('/').join('-');
  await updateDocument(COLLECTIONS.TASKS, taskId, updates);
}

/**
 * Get tasks for a specific branch.
 */
export async function getBranchTasks(branchId: string): Promise<GSSTask[]> {
  return queryDocuments<GSSTask>(COLLECTIONS.TASKS, [
    where('branchId', '==', branchId),
    orderBy('updatedAt', 'desc'),
  ]);
}

/**
 * Get tasks assigned to a specific employee.
 */
export async function getEmployeeTasks(employeeId: string): Promise<GSSTask[]> {
  return queryDocuments<GSSTask>(COLLECTIONS.TASKS, [
    where('assignedToMultiple', 'array-contains', employeeId),
  ]);
}

// ─── Student Operations ────────────────────────────────────────────────────────

/**
 * Create a new student record.
 */
export async function createStudentRecord(student: GSSStudent): Promise<void> {
  await createDocument(COLLECTIONS.STUDENTS, student.studentId, student);
}

/**
 * Get students assigned to a tutor.
 */
export async function getTutorStudents(tutorId: string): Promise<GSSStudent[]> {
  return queryDocuments<GSSStudent>(COLLECTIONS.STUDENTS, [
    where('assignedToId', '==', tutorId),
    orderBy('studentName', 'asc'),
  ]);
}

/**
 * Get all students in a branch.
 */
export async function getBranchStudents(branchId: string): Promise<GSSStudent[]> {
  return queryDocuments<GSSStudent>(COLLECTIONS.STUDENTS, [
    where('branchId', '==', branchId),
  ]);
}

// ─── Real-Time Listeners ───────────────────────────────────────────────────────

/**
 * Subscribe to real-time task updates for a branch.
 */
export function subscribeToBranchTasks(
  branchId: string,
  callback: (tasks: GSSTask[]) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTIONS.TASKS),
    where('branchId', '==', branchId),
    orderBy('updatedAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as GSSTask));
    callback(tasks);
  });
}

/**
 * Subscribe to a specific user's profile changes.
 */
export function subscribeToUserProfile(
  uid: string,
  callback: (user: GSSUser | null) => void
): Unsubscribe {
  const db = getFirestoreDb();
  return onSnapshot(doc(db, COLLECTIONS.USERS, uid), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() } as unknown as GSSUser);
    } else {
      callback(null);
    }
  });
}

// ─── Branch Operations ─────────────────────────────────────────────────────────

/**
 * Create or update a branch document in Firestore.
 */
export async function upsertBranch(branch: GSSBranch): Promise<void> {
  await createDocument(COLLECTIONS.BRANCHES, branch.branchId, branch);
}

/**
 * Get a single branch by ID.
 */
export async function getBranch(branchId: string): Promise<GSSBranch | null> {
  return getDocument<GSSBranch>(COLLECTIONS.BRANCHES, branchId);
}

/**
 * Get a branch by its short code (e.g. 'CBE', 'CHN').
 */
export async function getBranchByCode(code: string): Promise<GSSBranch | null> {
  const results = await queryDocuments<GSSBranch>(COLLECTIONS.BRANCHES, [
    where('branchCode', '==', code.toUpperCase()),
    limit(1),
  ]);
  return results.length > 0 ? results[0] : null;
}

/**
 * Get all branches (ordered by code).
 */
export async function getAllBranches(): Promise<GSSBranch[]> {
  return queryDocuments<GSSBranch>(COLLECTIONS.BRANCHES, [
    orderBy('branchCode', 'asc'),
  ]);
}

/**
 * Get only active branches.
 */
export async function getActiveBranches(): Promise<GSSBranch[]> {
  return queryDocuments<GSSBranch>(COLLECTIONS.BRANCHES, [
    where('status', '==', 'Active'),
    orderBy('branchCode', 'asc'),
  ]);
}

/**
 * Subscribe to real-time branch updates.
 */
export function subscribeToAllBranches(
  callback: (branches: GSSBranch[]) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTIONS.BRANCHES),
    orderBy('branchCode', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const branches = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as GSSBranch));
    callback(branches);
  });
}

// ─── Audit Log ─────────────────────────────────────────────────────────────────

/**
 * Write an audit log entry to Firestore.
 */
export async function writeAuditLog(entry: {
  userId: string;
  userName: string;
  role: string;
  action: string;
  module: string;
  recordId: string;
  branchId: string;
  oldValue?: string;
  newValue?: string;
}): Promise<void> {
  const auditId = `AUDIT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await createDocument(COLLECTIONS.AUDIT_LOGS, auditId, {
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

// ─── Daily Worklog Operations ──────────────────────────────────────────────────

/**
 * Record or update a daily worklog entry.
 */
export async function upsertDailyWorklog(log: GSSDailyWorklog): Promise<void> {
  await createDocument(COLLECTIONS.DAILY_WORKLOGS, log.logId, log);
}

/**
 * Get daily worklogs for a staff member.
 */
export async function getStaffWorklogs(staffId: string): Promise<GSSDailyWorklog[]> {
  return queryDocuments<GSSDailyWorklog>(COLLECTIONS.DAILY_WORKLOGS, [
    where('staffId', '==', staffId),
    orderBy('date', 'desc'),
    limit(30),
  ]);
}

/**
 * Get daily worklogs for a branch on a given date.
 */
export async function getBranchWorklogsByDate(branchId: string, date: string): Promise<GSSDailyWorklog[]> {
  return queryDocuments<GSSDailyWorklog>(COLLECTIONS.DAILY_WORKLOGS, [
    where('branchId', '==', branchId),
    where('date', '==', date),
  ]);
}

// ─── Attendance Operations ────────────────────────────────────────────────────

/**
 * Record an attendance check-in / check-out.
 */
export async function recordAttendance(record: GSSAttendanceRecord): Promise<void> {
  await createDocument(COLLECTIONS.ATTENDANCE, record.attendanceId, record);
}

/**
 * Get attendance records for a staff member.
 */
export async function getStaffAttendance(staffId: string): Promise<GSSAttendanceRecord[]> {
  return queryDocuments<GSSAttendanceRecord>(COLLECTIONS.ATTENDANCE, [
    where('staffId', '==', staffId),
    orderBy('date', 'desc'),
    limit(31),
  ]);
}

// ─── Candidate Leads Operations ───────────────────────────────────────────────

/**
 * Create or update a candidate lead.
 */
export async function upsertCandidateLead(lead: GSSCandidateLead): Promise<void> {
  await createDocument(COLLECTIONS.CANDIDATE_LEADS, lead.leadId, lead);
}

/**
 * Get candidate leads for a branch.
 */
export async function getBranchLeads(branchId: string): Promise<GSSCandidateLead[]> {
  return queryDocuments<GSSCandidateLead>(COLLECTIONS.CANDIDATE_LEADS, [
    where('branchId', '==', branchId),
    orderBy('dateReceived', 'desc'),
    limit(100),
  ]);
}

