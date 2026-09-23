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

  // 3. Fallback credentials for serverless deployment
  return {
    type: "service_account",
    project_id: "gateway-management",
    private_key_id: "a4af33b7e232909aa797fb74cbd2b6fe800a6b39",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCY7zOqXnkbCJDa\ngxt/O68W7gJeS4agQAWGu73ikk/4ar/1fS6Wt1YYtS2985SROI0OphlxZWLoNI4/\nUTdCYXbV56eV+TEIqlm0gVpaoSlnl83vKNK3GU+It7VejlR4ODOyCXlBGtNDcLGg\nI8Mb67Q4IRVetKBXTubm9kBW5TvpRTdF00zAueEF0ID27QqBPWqBBGMdBX47uwWC\nf+5e1n9i7M4yvcVuW5WPd201lizmv2P3ENOCNNspBJ1Ggu3xtgXmjZp4iGfJwfaj\nuQugLDt+rOapt212RA+ih7WMfYngzEAz1/Km/7HZbqxwHRKoto3Wyp3RDuoaNPVc\nRriXnNuTAgMBAAECggEACDZRXhTRnafW7heRNUKqsxQCcOF5sAblZRKVbo0FxKSo\nJyda25aqWwxLkazP7au4OLD8TRsGdcqbWCoPyhLlaIoWdSwFkTNjOsP2v/Fx1ua6\nFQgU/JEG33lh61sVjRkTfubEVJXQrLPoozKYalo8pLDzbqZLX99+8FMJKcFdzLeo\nsRyiwVvlAmqSGEwEa4ORNdAUDpMCXzbVLDDvt+tuNxGmYqwcEByQBqJgvH0C6St7\nZZkkrqLx6PERBIwG3OLzypfIIUi74oF4ZjBWdTTjX/B1zlWDeU9UC6rn/3vwfO/0\nGlUGF7alLlNh75ORz64oS6898sl2DPQj1ZdxyfoXPQKBgQDHcpoxtYqarLM+LTGS\nfI7k66QT03GtOt9Kt6SLrmZ1ynB9xAs9Q+IaQGtBIyzw7yqbNcBVFtAZM3RNY88U\nn0VWQfcpiHH4mJ3mXWbCWPCaJ/Lj1LLXKAxNN4gCZ3qUTt2zF+EBSRa9fEitj8yr\nCvAevGIxKWXoWs2INoiXeAjSNQKBgQDETFGeOgVumghuT5xB/bky7iPO0lgoYKLE\nTt5A3IKNo5ngQt6DWUOtV7kn5hqRg3oFgMmCFbpKKESydU2/F4GfZLNXRDCuzTyi\nRgBHyKT7itkRNs/QFvJGVAoQ4kLLaVUhUUbxaQKtanS/Ksq7mAGgId+kmv9B2pi5\n5niYJrQvpwKBgHfOEG+BtHN6/+R+c0OiDJfYMGQ0ZBmBvrV8IJxDM4rYAsCZLYMs\nrrnELmkfPxSvJbG8FP9Hx9MLhHYkWTTzA0xwLY7GRmflDRxeyKY/lK+VBaLzlkYF\n6XXMwKdpD0ndIfE9i8wg4kcKTAHt2ix4Uoqz8GvFiVCMkt+ammwaD3ptAoGADs7z\nGUynPEDCgg/fadsKLZ1pdiDIJcOkg8qvWZVJBAZjhVeGEcKaKGmFvkzNlEym1+Nv\nUDDzbMS86fmPc+sCDFQ8c0jho044VMWTH9czGwbOeU35P2l7vXJ5j+yBvXakxW6s\nO2oAmbR+Oi2wPZaqCLqFdJV8zCsBeoS4dEH3NeECgYEAm/fiUlsZ3NgIqneHhN07\nsA44+eHFJ1fjIrzZI6WT6CIYKKhICORyWibxC28Z5u3ulfFribVOqr4xhY/BxbIc\ns8EeCGTHN74V2FZYZwgWHgx6g5kY8dz6gOxpR4XBRzj83OsOzKbGPEs9l96NGKq7\nwPbIlzxdAcB3Tk2bmpcRb6o=\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@gateway-management.iam.gserviceaccount.com",
    client_id: "108369956574087342134",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gateway-management.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  };
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
      ...(userData.password ? { password: userData.password } : {}),
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

/**
 * Fetch all users from Firestore `users` collection.
 */
export async function getFirestoreUsers(): Promise<any[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('users').get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || 'Staff Member',
        email: d.email || d.gmail || '',
        mobile: d.mobile || '',
        role: (d.role?.toLowerCase() as any) || 'intern',
        status: (d.status as any) || 'pending',
        branch: d.branch || 'Coimbatore',
        specialization: d.specialization || d.designation || 'Operations',
        specializations: d.specializations || (d.specialization ? [d.specialization] : []),
        majorSpecialization: d.majorSpecialization || d.specialization || 'Operations',
        additionalSpecializations: d.additionalSpecializations || [],
        startMonthYear: d.startMonthYear || '',
        startDate: d.startDate || '',
        endDate: d.endDate || '',
        createdAt: d.createdAt ? (typeof d.createdAt === 'string' ? d.createdAt : d.createdAt.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString()) : new Date().toISOString(),
        passwordHash: d.password || undefined
      };
    });
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreUsers error:', err?.message || err);
    return [];
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] deleteUserFromFirestore error:', err?.message || err);
    return false;
  }
}
