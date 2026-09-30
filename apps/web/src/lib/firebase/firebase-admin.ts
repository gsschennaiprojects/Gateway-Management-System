/**
 * Enterprise Privileged Firebase Admin & Cloud Firestore Service
 *
 * PURPOSE:
 * Server-side authoritative data access layer executing privileged Firestore,
 * Firebase Auth, and background projection queue mutations.
 *
 * DATA AUTHORITY:
 * Cloud Firestore is the canonical, transactional source of truth for:
 * - `users`: Staff identity, roles, and status.
 * - `students`: Enrolled interns/students and daily calendar attendance.
 * - `tasks`: Task assignments, group broadcasts, and lifecycle status.
 * - `daily_worklogs`: Punch-in/out timestamps and completed deliverables.
 * - `audit_logs`: Immutable security and administrative audit trail.
 * - `projection_jobs`: Asynchronous jobs queued for Google Sheets mirroring.
 *
 * SECURITY:
 * Runs strictly in server-side Next.js route handlers. Never imported or
 * exposed to browser client bundles.
 */

import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getFirestore, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { Branch, User, UserRole, UserStatus } from '@/types/auth';
import type { AssignedTask, TaskGroupTarget, TaskStatus } from '@/types/task';
import type { TaskNotification } from '@/types/task';
import type { WorkLogEntry } from '@/types/worklog';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

interface FirebaseServiceAccount {
  project_id?: unknown;
  private_key?: unknown;
  client_email?: unknown;
}

export interface UserAuthRecord extends User {
  passwordHash?: string;
  password?: string;
}

interface FirestoreStudentRecord {
  id: string;
  studentId: string;
  studentName: string;
  branch: string;
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
  projectTitle: string;
  studentStatus: string;
  createdAt: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asDateString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return '';
}

async function readAllDocuments(query: Query): Promise<QueryDocumentSnapshot[]> {
  const pageSize = 500;
  const documents: QueryDocumentSnapshot[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  while (true) {
    const page = await (cursor ? query.startAfter(cursor) : query).limit(pageSize).get();
    documents.push(...page.docs);
    if (page.size < pageSize) return documents;
    cursor = page.docs[page.docs.length - 1];
  }
}

function mapFirestoreUser(id: string, data: Record<string, unknown>): UserAuthRecord {
  const roleValue = asString(data.role).toLowerCase();
  const roles: UserRole[] = ['superadmin', 'admin', 'hr', 'employee', 'intern'];
  const statusValue = asString(data.status).toLowerCase();
  const statuses: UserStatus[] = ['active', 'pending', 'rejected', 'disabled'];
  const branches: Branch[] = ['Coimbatore', 'Chennai', 'Madurai', 'Erode'];
  if (!roles.includes(roleValue as UserRole) || !statuses.includes(statusValue as UserStatus) || !branches.includes(data.branch as Branch)) {
    throw new Error(`Invalid user profile schema for record ${id}.`);
  }
  const primarySpecialization = asString(data.specialization || data.designation, 'Operations');
  return {
    id: asString(data.employeeId, id),
    uid: asString(data.uid, id),
    name: asString(data.name, 'Staff Member'),
    email: asString(data.email || data.gmail),
    mobile: asString(data.mobile),
    role: roleValue as UserRole,
    status: statusValue as UserStatus,
    branch: data.branch as Branch,
    specialization: primarySpecialization,
    specializations: Array.isArray(data.specializations)
      ? data.specializations.filter((value): value is string => typeof value === 'string')
      : (typeof data.specialization === 'string' ? [data.specialization] : []),
    majorSpecialization: asString(data.majorSpecialization, primarySpecialization),
    additionalSpecializations: Array.isArray(data.additionalSpecializations)
      ? data.additionalSpecializations.filter((value): value is string => typeof value === 'string')
      : [],
    startMonthYear: asString(data.startMonthYear),
    startDate: asString(data.startDate),
    endDate: asString(data.endDate),
    passwordHash: asString(data.passwordHash) || undefined,
    password: asString(data.password) || undefined,
    createdAt: asDateString(data.createdAt),
  };
}

function loadServiceAccountKey(): FirebaseServiceAccount | null {
  let keyContent = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!keyContent) {
    const possiblePaths = [
      path.join(process.cwd(), 'firebase-admin-key.json'),
      path.join(process.cwd(), '..', 'firebase-admin-key.json'),
      path.join(process.cwd(), 'apps', 'web', 'firebase-admin-key.json'),
      path.join(process.cwd(), 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
      path.join(process.cwd(), '..', 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
      'c:\\Users\\jasva\\Desktop\\project\\GMS\\apps\\web\\firebase-admin-key.json',
      'c:\\Users\\jasva\\Desktop\\project\\GMS\\gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json',
      'c:\\Users\\jasva\\Desktop\\project\\GMS\\firebase-admin-key.json',
    ];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
          keyContent = fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf-8');
          break;
        }
      } catch {
        // Intentionally silent: in restricted serverless runtimes (e.g. AWS Lambda / Vercel Edge),
        // filesystem probe may throw EACCES; fallback to environment variable parsing.
      }
    }
  }

  if (!keyContent) return null;
  try {
    const parsed = JSON.parse(keyContent) as FirebaseServiceAccount;
    const expectedProject = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'gss-management-system-eef75';
    if (!expectedProject || (parsed.project_id && parsed.project_id !== expectedProject) || typeof parsed.private_key !== 'string' || typeof parsed.client_email !== 'string') {
      throw new Error('Firebase service account does not match FIREBASE_PROJECT_ID or is incomplete.');
    }
    return parsed;
  } catch (error) {
    console.error('[FirebaseAdmin] Service account configuration is invalid:', errorMessage(error));
    return null;
  }
}

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApp();
    return adminApp;
  }

  try {
    const sa = loadServiceAccountKey();
    if (!sa) {
      console.warn('[FirebaseAdmin] No valid service account key found. Firebase Admin features will be unavailable.');
      return null;
    }
    const projectId = (sa.project_id as string) || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'gss-management-system-eef75';
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail: sa.client_email as string,
        privateKey: (sa.private_key as string).replace(/\\n/g, '\n'),
      }),
      projectId,
    });
    return adminApp;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] Initialization error:', errorMessage(err));
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (!app) return null;
  adminDb = getFirestore(app);
  try {
    adminDb.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Intentionally silent: settings() throws if Firestore has already been initialized
    // in another Next.js worker or warm serverless instance.
  }
  return adminDb;
}

export function getAdminAuth(): Auth | null {
  if (adminAuth) return adminAuth;
  const app = getAdminApp();
  if (!app) return null;
  adminAuth = getAuth(app);
  return adminAuth;
}

/** Resolve a Firebase UID to a strictly validated, credential-free app profile. */
export async function getFirestoreUserByUid(uid: string): Promise<User | null> {
  const db = getAdminFirestore();
  if (!db || !uid) return null;
  try {
    const direct = await db.collection('users').doc(uid).get();
    const snapshot = direct.exists
      ? direct
      : (await db.collection('users').where('uid', '==', uid).limit(1).get()).docs[0];
    if (!snapshot?.exists) return null;
    const data = snapshot.data() ?? {};
    const role = asString(data.role).toLowerCase() as UserRole;
    const status = asString(data.status).toLowerCase() as UserStatus;
    const branch = asString(data.branch) as Branch;
    if (!['superadmin', 'admin', 'hr', 'employee', 'intern'].includes(role)) return null;
    if (!['active', 'pending', 'rejected', 'disabled'].includes(status)) return null;
    if (!['Coimbatore', 'Chennai', 'Madurai', 'Erode'].includes(branch)) return null;
    return {
      id: asString(data.employeeId, snapshot.id),
      uid: asString(data.uid, snapshot.id),
      name: asString(data.name), email: asString(data.email || data.gmail),
      mobile: asString(data.mobile), role, status: status as UserStatus,
      branch, specialization: asString(data.specialization),
      createdAt: asDateString(data.createdAt),
    };
  } catch (error) {
    console.error('[FirebaseAdmin] Profile lookup failed:', errorMessage(error));
    return null;
  }
}

/**
 * Upsert User record in Firestore `users` collection.
 */
export async function syncUserToFirestore(userData: {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  status: string;
  branch: string;
  specialization?: string;
  specializations?: string[];
  startMonthYear?: string;
  startDate?: string;
  endDate?: string;
  passwordHash?: string;
  password?: string;
  createdAt?: string;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    const docRef = db.collection('users').doc(userData.id);
    await docRef.set({
      uid: userData.id,
      name: userData.name,
      email: userData.email.toLowerCase(),
      gmail: userData.email.toLowerCase(),
      mobile: userData.mobile || '',
      role: userData.role,
      status: userData.status,
      branch: userData.branch,
      specialization: userData.specialization || '',
      specializations: userData.specializations || [],
      startMonthYear: userData.startMonthYear || '',
      startDate: userData.startDate || '',
      endDate: userData.endDate || '',
      updatedAt: new Date().toISOString(),
      createdAt: userData.createdAt || new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncUserToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Upsert Task record in Firestore `tasks` collection.
 */
export async function syncTaskToFirestore(taskData: {
  id: string;
  title: string;
  description: string;
  assignedBy: AssignedTask['assignedBy'];
  targetType: string;
  targetUserId?: string;
  targetUserName?: string;
  targetUserRole?: string;
  targetGroup?: TaskGroupTarget;
  assignedToUserIds?: string[];
  priority: string;
  dueDate?: string;
  status: string;
  createdAt: string;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('tasks').doc(taskData.id).set({
      ...taskData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncTaskToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Upsert Daily Worklog record in Firestore `daily_worklogs` collection.
 */
export async function syncWorklogToFirestore(logData: {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  branch: string;
  date: string;
  loginTime?: string | null;
  logoutTime?: string | null;
  plannedTasks?: string[];
  completedTasks?: string[];
  incompleteReason?: string;
  attendanceStatus?: string;
  hoursLogged?: number;
  totalHours?: string | number;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    const cleanData: Record<string, unknown> = {
      ...logData,
      updatedAt: new Date().toISOString()
    };
    Object.keys(cleanData).forEach(k => {
      if (cleanData[k] === undefined) delete cleanData[k];
    });

    const docRef = db.collection('daily_worklogs').doc(logData.id);
    const existing = await docRef.get();
    if (!existing.exists) {
      cleanData.createdAt = new Date().toISOString();
    }

    await docRef.set(cleanData, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncWorklogToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Append Attendance punch record in Firestore `attendance` collection.
 */
export async function syncAttendanceToFirestore(attData: {
  id: string;
  userId: string;
  userName: string;
  role: string;
  branch: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  status: string;
  totalHours?: number;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    const cleanData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(attData)) {
      if (v !== undefined) cleanData[k] = v;
    }
    cleanData.timestamp = new Date().toISOString();

    await db.collection('attendance').doc(attData.id).set(cleanData, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncAttendanceToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Upsert Student in Firestore `students` collection.
 */
export async function syncStudentToFirestore(studentData: {
  studentId: string;
  studentName: string;
  branch: string;
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
  endDate?: string;
  feeStatus?: string;
  projectStatus?: string;
  projectTitle?: string;
  studentStatus?: string;
  actor: Pick<User, 'id' | 'name' | 'role'>;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    const now = new Date().toISOString();
    const { actor, ...studentRecord } = studentData;
    const branchCodes: Record<string, string> = { Chennai: 'CHN', Coimbatore: 'CBE', Madurai: 'MDU', Erode: 'ERD' };
    const studentRef = db.collection('students').doc(studentData.studentId);
    const projectionRef = db.collection('projection_jobs').doc(`student:${studentData.studentId}:${randomUUID()}`);
    const auditId = `audit_${randomUUID()}`;
    const auditRef = db.collection('audit_logs').doc(auditId);
    const auditProjectionRef = db.collection('projection_jobs').doc(`audit:${auditId}`);
    await db.runTransaction(async transaction => {
      transaction.set(studentRef, { ...studentRecord, branchId: branchCodes[studentData.branch] || studentData.branch, updatedAt: now }, { merge: true });
      transaction.create(projectionRef, { id: projectionRef.id, type: 'student.upsert', entityId: studentData.studentId, branchId: branchCodes[studentData.branch] || studentData.branch, state: 'pending', attempts: 0, createdAt: now });
      transaction.create(auditRef, {
        id: auditId, timestamp: now, createdAt: now,
        userId: actor.id, userName: actor.name, role: actor.role,
        action: 'STUDENT_UPSERT', module: 'STUDENTS', recordId: studentData.studentId, branch: studentData.branch,
      });
      transaction.create(auditProjectionRef, { id: auditProjectionRef.id, type: 'audit.project', entityId: auditId, branchId: branchCodes[studentData.branch] || studentData.branch, state: 'pending', attempts: 0, createdAt: now });
    });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncStudentToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Fetch all users from Firestore `users` collection.
 */
export async function getFirestoreUsers(): Promise<UserAuthRecord[]> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore is unavailable.');

  try {
    const docs = await readAllDocuments(db.collection('users'));
    return docs.map(doc => mapFirestoreUser(doc.id, doc.data()));
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreUsers error:', errorMessage(err));
    throw new Error('Firestore user directory read failed.');
  }
}

/**
 * Fetch a specific user from Firestore `users` collection by ID.
 */
export async function getFirestoreUserById(id: string): Promise<UserAuthRecord | null> {
  const db = getAdminFirestore();
  if (!db || !id) return null;

  try {
    const direct = await db.collection('users').doc(id).get();
    if (direct.exists) return mapFirestoreUser(direct.id, direct.data()!);
    const byEmployeeId = await db.collection('users').where('employeeId', '==', id).limit(1).get();
    if (!byEmployeeId.empty) return mapFirestoreUser(byEmployeeId.docs[0].id, byEmployeeId.docs[0].data());
    return null;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreUserById error:', errorMessage(err));
    return null;
  }
}

/**
 * Generates the next sequential professional User ID (e.g. GSS_SA_001, GSS_ADM_001, GSS_HR_001, GSS_EMP_001, GSS_INT_001).
 */
export async function getNextProfessionalUserId(role?: string): Promise<string> {
  const roleLower = (role || '').toLowerCase();
  let prefix = 'GSS_EMP_';
  if (roleLower === 'superadmin') prefix = 'GSS_SA_';
  else if (roleLower === 'admin') prefix = 'GSS_ADM_';
  else if (roleLower === 'hr') prefix = 'GSS_HR_';
  else if (roleLower === 'intern') prefix = 'GSS_INT_';
  else if (roleLower === 'employee') prefix = 'GSS_EMP_';

  const db = getAdminFirestore();
  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}(\\d+)$`);

  if (db) {
    try {
      const snap = await db.collection('users').get();
      for (const doc of snap.docs) {
        const id = doc.id;
        const match = id.match(regex);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    } catch (err) {
      console.warn('[FirebaseAdmin] Error determining next user ID:', err);
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Fetch a user from Firestore `users` collection by email, gmail, mobile, or doc ID.
 */
export async function getFirestoreUserByIdentifier(identifier: string): Promise<UserAuthRecord | null> {
  const db = getAdminFirestore();
  if (!db || !identifier) return null;

  try {
    const cleanId = identifier.trim().toLowerCase();
    const digitsOnly = identifier.replace(/\D/g, '');

    // Resolve phone identifiers through the private normalized index first.
    if (digitsOnly.length >= 10) {
      const phoneKey = `+91${digitsOnly.slice(-10)}`;
      const phoneIndex = await db.collection('phoneIndex').doc(phoneKey).get();
      const indexedUid = phoneIndex.exists ? asString(phoneIndex.data()?.uid) : '';
      if (indexedUid) {
        const indexedProfile = await getFirestoreUserByUid(indexedUid);
        if (indexedProfile) return indexedProfile;
      }
    }

    // 1. Check doc ID directly
    const directDoc = await db.collection('users').doc(identifier).get();
    if (directDoc.exists) {
      return mapFirestoreUser(directDoc.id, directDoc.data()!);
    }

    // 2. Query email
    let snap = await db.collection('users').where('email', '==', cleanId).limit(1).get();
    if (snap.empty) {
      snap = await db.collection('users').where('gmail', '==', cleanId).limit(1).get();
    }
    if (snap.empty && digitsOnly.length >= 10) {
      snap = await db.collection('users').where('mobile', '==', digitsOnly.slice(-10)).limit(1).get();
    }

    if (!snap.empty) {
      const doc = snap.docs[0];
      return mapFirestoreUser(doc.id, doc.data()!);
    }
    return null;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreUserByIdentifier error:', errorMessage(err));
    return null;
  }
}

/**
 * Permanently delete a user from Firestore `users` collection by ID, email, or mobile.
 */
export async function deleteUserFromFirestore(userId: string, email?: string, mobile?: string): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    // 1. Delete by document ID
    await db.collection('users').doc(userId).delete();

    // 2. Also delete any matching by email/gmail
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const snapEmail = await db.collection('users').where('email', '==', cleanEmail).get();
      for (const d of snapEmail.docs) await d.ref.delete();
      const snapGmail = await db.collection('users').where('gmail', '==', cleanEmail).get();
      for (const d of snapGmail.docs) await d.ref.delete();
    }

    // 3. Also delete by mobile if available
    if (mobile) {
      const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
      if (cleanMobile.length >= 10) {
        const snapMobile = await db.collection('users').where('mobile', '==', cleanMobile).get();
        for (const d of snapMobile.docs) await d.ref.delete();
      }
    }

    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] deleteUserFromFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Sync Branch definition to Firestore `branches` collection.
 */
export async function syncBranchToFirestore(branch: Record<string, unknown> & { branchId: string }): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('branches').doc(branch.branchId).set({
      ...branch,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncBranchToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Fetch all branches from Firestore.
 */
export async function getFirestoreBranches(): Promise<Array<Record<string, unknown> & { id: string }>> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('branches').get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreBranches error:', errorMessage(err));
    return [];
  }
}

/**
 * Seed all default 4 branches to Firestore if missing.
 */
export async function seedDefaultBranchesToFirestore(): Promise<number> {
  const db = getAdminFirestore();
  if (!db) return 0;

  try {
    const { BRANCH_SEED_DATA } = await import('@/lib/seed-branches');
    let count = 0;
    for (const b of BRANCH_SEED_DATA) {
      await db.collection('branches').doc(b.branchId).set({
        ...b,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      count++;
    }
    return count;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] seedDefaultBranchesToFirestore error:', errorMessage(err));
    return 0;
  }
}

/**
 * Fetch tasks from Firestore `tasks` collection with role/branch scoping.
 */
export async function getFirestoreTasks(filter?: {
  role?: string;
  userId?: string;
  branch?: string;
}): Promise<AssignedTask[]> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore is unavailable.');

  try {
    const docs = await readAllDocuments(db.collection('tasks'));
    const tasks: AssignedTask[] = docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || '',
        description: d.description || '',
        branch: d.branch || '',
        branchId: d.branchId || '',
        assignedBy: d.assignedBy || { id: 'SYSTEM', name: 'Management', role: 'admin' },
        targetType: d.targetType || 'individual',
        targetUserId: d.targetUserId,
        targetUserName: d.targetUserName,
        targetUserRole: d.targetUserRole,
        targetGroup: d.targetGroup,
        assignedToUserIds: d.assignedToUserIds || (d.targetUserId ? [d.targetUserId] : []),
        priority: d.priority || 'medium',
        dueDate: d.dueDate || '',
        status: (['pending', 'in_progress', 'completed', 'partially_stopped'].includes(d.status) ? d.status : 'pending') as TaskStatus,
        createdAt: d.createdAt || '',
        updatedAt: d.updatedAt || ''
      };
    });

    if (!filter) return tasks;
    const { role, userId, branch } = filter;

    if (role === 'superadmin') {
      return tasks;
    }

    if (!userId) return [];

    if (role === 'admin') {
      return tasks.filter(t =>
        t.assignedBy?.id === userId ||
        t.targetGroup?.branch === branch ||
        t.assignedToUserIds?.includes(userId)
      );
    }

    // HR, Employee, Intern: their assigned tasks
    return tasks.filter(t =>
      t.assignedToUserIds?.includes(userId) ||
      t.targetUserId === userId
    );
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreTasks error:', errorMessage(err));
    throw new Error('Firestore task read failed.');
  }
}

/**
 * Update task status in Firestore `tasks` collection.
 */
export async function updateFirestoreTaskStatus(taskId: string, status: string): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('tasks').doc(taskId).set({
      status,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] updateFirestoreTaskStatus error:', errorMessage(err));
    return false;
  }
}

/**
 * Sync Notification to Firestore `notifications` collection.
 */
export async function syncNotificationToFirestore(notif: {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  taskId?: string;
  teamName?: string;
  isRead: boolean;
  createdAt: string;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('notifications').doc(notif.id).set({
      ...notif,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] syncNotificationToFirestore error:', errorMessage(err));
    return false;
  }
}

/**
 * Fetch notifications for a recipient from Firestore.
 */
export async function getFirestoreNotifications(recipientId: string): Promise<TaskNotification[]> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore is unavailable.');

  try {
    const snap = await db.collection('notifications')
      .where('recipientId', '==', recipientId)
      .limit(50)
      .get();
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as TaskNotification)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreNotifications error:', errorMessage(err));
    throw new Error('Firestore notification read failed.');
  }
}

/**
 * Mark a single notification as read in Firestore.
 */
export async function markFirestoreNotificationAsRead(notificationId: string, recipientId: string): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    const ref = db.collection('notifications').doc(notificationId);
    const existing = await ref.get();
    if (!existing.exists || existing.data()?.recipientId !== recipientId) return false;
    await ref.update({
      isRead: true,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] markFirestoreNotificationAsRead error:', errorMessage(err));
    return false;
  }
}

/**
 * Mark all notifications for a recipient as read in Firestore.
 */
export async function markAllFirestoreNotificationsAsRead(recipientId: string): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    const snap = await db.collection('notifications')
      .where('recipientId', '==', recipientId)
      .where('isRead', '==', false)
      .get();
    
    if (snap.empty) return true;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.update(doc.ref, { isRead: true, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
    return true;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] markAllFirestoreNotificationsAsRead error:', errorMessage(err));
    return false;
  }
}

/**
 * Fetch Students from Firestore `students` collection.
 */
export async function getFirestoreStudents(options?: {
  branch?: string;
  staffId?: string;
}): Promise<FirestoreStudentRecord[]> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore is unavailable.');

  try {
    const docs = await readAllDocuments(db.collection('students'));
    let students: FirestoreStudentRecord[] = docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        studentId: d.studentId || doc.id,
        studentName: d.studentName || d.name || '',
        branch: d.branch || '',
        college: d.college || '',
        department: d.department || '',
        year: d.year || '',
        email: d.email || '',
        mobile: d.mobile || '',
        course: d.course || '',
        domain: d.domain || '',
        mentorStaffId: d.mentorStaffId || '',
        mentorName: d.mentorName || '',
        admissionDate: d.admissionDate || d.startDate || '',
        endDate: d.endDate || '',
        feeStatus: d.feeStatus || '',
        projectStatus: d.projectStatus || '',
        projectTitle: d.projectTitle || '',
        studentStatus: d.studentStatus || '',
        createdAt: d.createdAt || ''
      };
    });

    if (options?.branch && options.branch !== 'all' && options.branch !== 'ALL') {
      const b = options.branch.toLowerCase();
      students = students.filter(s => {
        const sb = (s.branch || '').toLowerCase();
        return sb === b || sb.includes(b) || (b.includes('cbe') && sb.includes('coimbatore')) || (b.includes('coimbatore') && sb.includes('cbe'));
      });
    }

    if (options?.staffId) {
      students = students.filter(s => s.mentorStaffId === options.staffId);
    }

    return students;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreStudents error:', errorMessage(err));
    throw new Error('Firestore student read failed.');
  }
}

/**
 * Fetch Worklogs from Firestore `daily_worklogs` collection.
 */
export async function getFirestoreWorklogs(options?: {
  userId?: string;
  branch?: string;
  date?: string;
}): Promise<WorkLogEntry[]> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore is unavailable.');

  try {
    let query: Query = db.collection('daily_worklogs');
    if (options?.userId) {
      query = query.where('userId', '==', options.userId);
    }
    if (options?.date) {
      query = query.where('date', '==', options.date);
    }
    const docs = await readAllDocuments(query);
    let logs: WorkLogEntry[] = docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as WorkLogEntry));

    if (options?.branch && options.branch !== 'all') {
      logs = logs.filter((log) => log.branch === options.branch);
    }

    return logs;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreWorklogs error:', errorMessage(err));
    throw new Error('Firestore worklog read failed.');
  }
}

/**
 * Fetch a specific Worklog from Firestore `daily_worklogs` collection by ID.
 */
export async function getFirestoreWorklogById(id: string): Promise<WorkLogEntry | null> {
  const db = getAdminFirestore();
  if (!db || !id) return null;

  try {
    const docSnap = await db.collection('daily_worklogs').doc(id).get();
    if (docSnap.exists) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as WorkLogEntry;
    }
    return null;
  } catch (err: unknown) {
    console.error('[FirebaseAdmin] getFirestoreWorklogById error:', errorMessage(err));
    return null;
  }
}
