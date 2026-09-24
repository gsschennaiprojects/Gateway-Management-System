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
    project_id: "gss-management-system-eef75",
    private_key_id: "0b53db1b954a508487ffaf68c4ff1d2d65acf08e",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDiczqfMLkCqC1K\nK0srHjqNRGkaslXXzVDoYSqnQCpZYnmk7iwFFEevBRf1og+6Em27/wDEBRs3uUTx\n1if08riQnj2s5u6l7HsQ57FRlVkmsuP4OrPuaCQHQI8OswZZA7IfIIAo1TEEB6MJ\n2GE0AW8UImrWkgdP0ocQPtoTNrZoe8N47/D393WUgHCGOUwJNzbCrbMeZkRmyCI4\nab7+aq1lTOK857TzfqsN3y5ZBvxpMsYfAN30xL73dk8qt1SV6HLg41UlN0Z16tqn\nl6q7VzZ/TTwxtiVTqtXg+PRswaDgmgGFeU20LdmKc0VFNlsYmdbG0SByERplhnKd\nfxTV1P9TAgMBAAECggEAbgdmJv5SDt/vbZfepLtB4O0qEp4vRrWMx/SaeHyddyP5\njjFpsygY8ooLi77sXFFi/1MWqKgAgxFi1gzkCkk7c41n01C8CWP/ogWp60WhdUO7\nsBu53K++PcXZHN/QyESa8jPlAbIg6F/bkMeR52aA9ewJNGvs4JSfKr4XUPmnJNl/\nr0e/3Crmjhsy/xdvB/Qm2FMgtXMEAcu0/aQOvNyaZFvxDJXQZCRal9YBgKgEQCEL\nX5Ny39eHI/14SQ5AAY8QcZASXfJniW/lhw24LwVrb+rC5NPDaiO3kEgdzn3nupqi\na/Jy6mw6uQ+kAyQPTLd6PLmbdrS5P08QT6f0WlnanQKBgQD8qe/kXyu49JnqEQxT\noXWKjx9eQnVujEITMqyKNoj9kK4ny+P24GYbxYkLI0norgQheoRmIwVG30bN6phz\njJ8/FaMIdWJ0hWIbxtwki6nrgwQ0VZ0itALiUVkbNrG1yLB2Mkk1HELGDlWI7/D1\nDDX/uqhnrch6zPzjsGtCSrEGHQKBgQDlcK72qYkfCbEcdgQujx2VckA1ipbPuqqI\n51mev2fI3YNK9BxhEGaafvJe8+qg66cj8rr0O8RnyFWLcrlMOdzqrepjUT8fxP1f\nTYbP/kdMZc/QvdIDWhxjIXTH+Vj5To13ONP3cseLkNat+Py4O2v67vIIY779nYsX\nxQLoWxJgLwKBgAXAiKmWURSA3RArGzC8OETTRU+MC8hcgRSWzr7Gxw+ev5hAWAxC\nx5BSSvBp+UDG1Wk9tM3udixK4P3HHXlj9iwlffSvV3J3pugi+tgKJfAqp2nZmR41\nIuusFm88K4eL7hiCxI/k+NAxe1kGvWGWyZPs1/CkUDAbgpZcadS0hpsxAoGBAJo+\naMEWNEKTZ2e0xxbty3uedSAJbV11JhQnQ45/KqxUjmEjPrjaJ8ARO6st2zwXcCOw\nmJJ8Y4tJmIjItV1TQPrbtEjUY9VdvuAE5G6LiS8I+u5fzgHG4HKcGUAelvvzHRNb\nNtSRayieVFRcoLjR6cOmQzv0on8pHEr8fPnrz6ytAoGASjVbT2Kw344EOjoq4Nl8\nnDK83q0pP1HzImvo/5BjClS54iV7SmIuJzIQjCmfz/RdChVXk9COiH2ODN1CrC6C\n7KOZXfEuaII3Yggt9nJx8ypPptkArkP3/GUBeHyR8PdCfuPLSFFTndpxuAGaXDO2\n6oIzMopkzlOfLP8PQSXO/+Y=\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@gss-management-system-eef75.iam.gserviceaccount.com",
    client_id: "103905619853685923852",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gss-management-system-eef75.iam.gserviceaccount.com",
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
      projectId: sa.project_id || 'gss-management-system-eef75'
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
  try {
    adminDb.settings({ ignoreUndefinedProperties: true });
  } catch {}
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
  targetUserName?: string;
  targetUserRole?: string;
  targetGroup?: any;
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
    const cleanData: Record<string, any> = {
      ...logData,
      updatedAt: new Date().toISOString()
    };
    // Don't overwrite existing createdAt if already set
    if (!cleanData.createdAt) {
      cleanData.createdAt = new Date().toISOString();
    }

    await db.collection('daily_worklogs').doc(logData.id).set(cleanData, { merge: true });
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
    const cleanData: Record<string, any> = {};
    for (const [k, v] of Object.entries(attData)) {
      if (v !== undefined) cleanData[k] = v;
    }
    cleanData.timestamp = new Date().toISOString();

    await db.collection('attendance').doc(attData.id).set(cleanData, { merge: true });
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
 * Fetch a specific user from Firestore `users` collection by ID.
 */
export async function getFirestoreUserById(id: string): Promise<any | null> {
  const db = getAdminFirestore();
  if (!db || !id) return null;

  try {
    const docSnap = await db.collection('users').doc(id).get();
    if (docSnap.exists) {
      const d = docSnap.data()!;
      return {
        id: docSnap.id,
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
    }
    return null;
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreUserById error:', err?.message || err);
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
export async function getFirestoreUserByIdentifier(identifier: string): Promise<any | null> {
  const db = getAdminFirestore();
  if (!db || !identifier) return null;

  try {
    const cleanId = identifier.trim().toLowerCase();
    const digitsOnly = identifier.replace(/\D/g, '');

    // 1. Check doc ID directly
    const directDoc = await db.collection('users').doc(identifier).get();
    if (directDoc.exists) {
      const d = directDoc.data()!;
      return {
        id: directDoc.id,
        name: d.name || 'Staff Member',
        email: d.email || d.gmail || cleanId,
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
      const d = doc.data()!;
      return {
        id: doc.id,
        name: d.name || 'Staff Member',
        email: d.email || d.gmail || cleanId,
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
    }
    return null;
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreUserByIdentifier error:', err?.message || err);
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] deleteUserFromFirestore error:', err?.message || err);
    return false;
  }
}

/**
 * Sync Branch definition to Firestore `branches` collection.
 */
export async function syncBranchToFirestore(branch: any): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('branches').doc(branch.branchId).set({
      ...branch,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncBranchToFirestore error:', err?.message || err);
    return false;
  }
}

/**
 * Fetch all branches from Firestore.
 */
export async function getFirestoreBranches(): Promise<any[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('branches').get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreBranches error:', err?.message || err);
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] seedDefaultBranchesToFirestore error:', err?.message || err);
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
}): Promise<any[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('tasks').limit(150).get();
    let tasks = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || '',
        description: d.description || '',
        assignedBy: d.assignedBy || { id: 'SYSTEM', name: 'Management', role: 'admin' },
        targetType: d.targetType || 'individual',
        targetUserId: d.targetUserId,
        targetUserName: d.targetUserName,
        targetUserRole: d.targetUserRole,
        targetGroup: d.targetGroup,
        assignedToUserIds: d.assignedToUserIds || (d.targetUserId ? [d.targetUserId] : []),
        priority: d.priority || 'medium',
        dueDate: d.dueDate || '',
        status: d.status || 'pending',
        createdAt: d.createdAt || new Date().toISOString(),
        updatedAt: d.updatedAt || new Date().toISOString()
      };
    });

    if (!filter) return tasks;
    const { role, userId, branch } = filter;

    if (role === 'superadmin') {
      return tasks;
    }

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
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreTasks error:', err?.message || err);
    return [];
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] updateFirestoreTaskStatus error:', err?.message || err);
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] syncNotificationToFirestore error:', err?.message || err);
    return false;
  }
}

/**
 * Fetch notifications for a recipient from Firestore.
 */
export async function getFirestoreNotifications(recipientId: string): Promise<any[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('notifications')
      .where('recipientId', '==', recipientId)
      .limit(50)
      .get();
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreNotifications error:', err?.message || err);
    return [];
  }
}

/**
 * Mark a single notification as read in Firestore.
 */
export async function markFirestoreNotificationAsRead(notificationId: string): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;

  try {
    await db.collection('notifications').doc(notificationId).set({
      isRead: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err: any) {
    console.error('[FirebaseAdmin] markFirestoreNotificationAsRead error:', err?.message || err);
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] markAllFirestoreNotificationsAsRead error:', err?.message || err);
    return false;
  }
}

/**
 * Fetch Students from Firestore `students` collection.
 */
export async function getFirestoreStudents(options?: {
  branch?: string;
  staffId?: string;
}): Promise<any[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('students').limit(200).get();
    let students = snap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        studentId: d.studentId || doc.id,
        studentName: d.studentName || d.name || 'Student',
        branch: d.branch || 'Coimbatore',
        college: d.college || 'Engineering College',
        department: d.department || 'Computer Science',
        year: d.year || 'IV',
        email: d.email || `${(d.studentId || doc.id).toLowerCase()}@student.guvi.in`,
        mobile: d.mobile || '+91 98765 43210',
        course: d.course || 'Internship',
        domain: d.domain || 'Full Stack Web (MERN)',
        mentorStaffId: d.mentorStaffId || '',
        mentorName: d.mentorName || 'Staff Mentor',
        admissionDate: d.admissionDate || d.startDate || '2026-07-01',
        endDate: d.endDate || '2026-09-30',
        feeStatus: d.feeStatus || 'Pending',
        projectStatus: d.projectStatus || 'Ongoing',
        studentStatus: d.studentStatus || 'Active',
        createdAt: d.createdAt || new Date().toISOString()
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
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreStudents error:', err?.message || err);
    return [];
  }
}

/**
 * Fetch Worklogs from Firestore `daily_worklogs` collection.
 */
export async function getFirestoreWorklogs(options?: {
  userId?: string;
  branch?: string;
  date?: string;
}): Promise<any[]> {
  const db = getAdminFirestore();
  if (!db) return [];

  try {
    const snap = await db.collection('daily_worklogs').limit(150).get();
    let logs = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (options?.userId) {
      logs = logs.filter(l => l.userId === options.userId);
    }
    if (options?.branch && options.branch !== 'all') {
      logs = logs.filter(l => l.branch === options.branch);
    }
    if (options?.date) {
      logs = logs.filter(l => l.date === options.date);
    }

    return logs;
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreWorklogs error:', err?.message || err);
    return [];
  }
}

/**
 * Fetch a specific Worklog from Firestore `daily_worklogs` collection by ID.
 */
export async function getFirestoreWorklogById(id: string): Promise<any | null> {
  const db = getAdminFirestore();
  if (!db || !id) return null;

  try {
    const docSnap = await db.collection('daily_worklogs').doc(id).get();
    if (docSnap.exists) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    return null;
  } catch (err: any) {
    console.error('[FirebaseAdmin] getFirestoreWorklogById error:', err?.message || err);
    return null;
  }
}
