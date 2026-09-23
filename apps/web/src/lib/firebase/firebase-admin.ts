/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — FIREBASE ADMIN SDK
 * Server-side privileged Firestore & Auth integration
 * ============================================================================
 */

import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function loadServiceAccountKey(): Record<string, any> | null {
  // 1. Check environment variable (e.g. on Vercel deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.warn('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e);
    }
  }

  // 2. Candidate local file paths
  const candidatePaths = [
    path.join(process.cwd(), 'firebase-admin-key.json'),
    path.join(process.cwd(), 'apps', 'web', 'firebase-admin-key.json'),
    path.join(process.cwd(), '..', 'firebase-admin-key.json'),
    'C:/Users/jasva/Desktop/project/GMS/apps/web/firebase-admin-key.json',
    'C:/Users/jasva/Desktop/project/GMS/firebase-admin-key.json',
    'C:/Users/jasva/Downloads/gateway-management-firebase-adminsdk-fbsvc-a4af33b7e2.json'
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.project_id && parsed.private_key) {
          return parsed;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApp();
    return adminApp;
  }

  const sa = loadServiceAccountKey();
  if (!sa) {
    console.warn('[FirebaseAdmin] No service account key found. Admin features will run in mock/local mode.');
    return null;
  }

  try {
    adminApp = initializeApp({
      credential: cert(sa),
      projectId: sa.project_id || 'gateway-management'
    });
    return adminApp;
  } catch (err: any) {
    console.error('[FirebaseAdmin] Initialization error:', err?.message || err);
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (!app) return null;
  adminDb = getFirestore(app);
  return adminDb;
}

export function getAdminAuth(): Auth | null {
  if (adminAuth) return adminAuth;
  const app = getAdminApp();
  if (!app) return null;
  adminAuth = getAuth(app);
  return adminAuth;
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncUserToFirestore error:', err?.message || err);
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
  assignedBy: any;
  targetType: string;
  targetUserId?: string;
  targetGroup?: any;
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncTaskToFirestore error:', err?.message || err);
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
  loginTime: string;
  logoutTime: string;
  plannedTasks: string[];
  completedTasks: string[];
  attendanceStatus: string;
  hoursLogged: number;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('daily_worklogs').doc(logData.id).set({
      ...logData,
      createdAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncWorklogToFirestore error:', err?.message || err);
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
    await db.collection('attendance').doc(attData.id).set({
      ...attData,
      timestamp: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncAttendanceToFirestore error:', err?.message || err);
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
  studentStatus?: string;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('students').doc(studentData.studentId).set({
      ...studentData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncStudentToFirestore error:', err?.message || err);
    return false;
  }
}
