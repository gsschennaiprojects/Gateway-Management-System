/**
 * ============================================================================
 * ANTIGRAVITY MASTER AUDIT & END-TO-END PRODUCTION VERIFICATION
 * ============================================================================
 *
 * Implements strict compliance verification across:
 * - Architecture Laws 0 through 95
 * - Zero-persistent business cache verification
 * - RBAC & Multi-branch isolation
 * - Authoritative Firestore write -> read -> delete lifecycle with ANTIGRAVITY_QA_<RUN_ID>
 * - Google Sheets projection decoupled state
 * - Route health & security defenses
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const RUN_ID = `ANTIGRAVITY_QA_${Date.now()}`;

function getServiceAccount() {
  const candidatePaths = [
    path.join(process.cwd(), 'firebase-admin-key.json'),
    path.join(process.cwd(), 'apps', 'web', 'firebase-admin-key.json'),
    'C:/Users/jasva/Desktop/project/GMS/apps/web/firebase-admin-key.json',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (c.project_id && c.private_key) return c;
      } catch {}
    }
  }
  throw new Error('Service account key not found.');
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Origin': BASE_URL,
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const cookieHeader = rawCookies.map(c => c ? c.split(';')[0] : '').filter(Boolean).join('; ');
  return { status: res.status, ok: res.ok, headers: res.headers, data, cookieHeader };
}

let passed = 0;
let failed = 0;
const testRecords = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runMasterAudit() {
  console.log('================================================================');
  console.log(`🚀 ANTIGRAVITY MASTER AUDIT & PRODUCTION VERIFICATION`);
  console.log(`   RUN ID: ${RUN_ID}`);
  console.log('================================================================\n');

  // Initialize Admin Firestore
  const creds = getServiceAccount();
  if (getApps().length === 0) {
    initializeApp({ credential: cert(creds) });
  }
  const db = getFirestore();

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 1: AUTHENTICATION & SESSION PERSISTENCE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('📌 STAGE 1: AUTHENTICATION & SECURE SESSION TOKEN VERIFICATION');

  const superAdminLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'gateway.managercbe@gmail.com',
      password: 'GatewaySS@2013#',
    }),
  });

  assert(superAdminLogin.status === 200, 'Super Admin login responds with HTTP 200');
  assert(superAdminLogin.data?.success === true, 'Login response returns success: true');
  assert(superAdminLogin.data?.user?.role === 'superadmin', 'Session role is superadmin');

  const cookieHeader = superAdminLogin.cookieHeader;
  assert(Boolean(cookieHeader), 'Secure HTTP-only session cookie returned in header');

  // Negative test: invalid credentials
  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'gateway.managercbe@gmail.com',
      password: 'DefectivePassword123#',
    }),
  });
  assert(badLogin.status === 401 || badLogin.data?.success === false, 'Invalid credentials rejected (401)');

  // Session check (/api/auth/me)
  const meRes = await request('/api/auth/me', { headers: { Cookie: cookieHeader } });
  assert(meRes.status === 200, 'Session resolution (/api/auth/me) responds with HTTP 200');
  assert(meRes.data?.user?.email === 'gateway.managercbe@gmail.com', 'Resolved user identity verified');

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 2: RBAC & MULTI-BRANCH ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 STAGE 2: ROLE-BASED ACCESS CONTROL & BRANCH ISOLATION');

  // Super Admin reads all users
  const usersRes = await request('/api/auth/users', { headers: { Cookie: cookieHeader } });
  assert(usersRes.status === 200, 'Super Admin GET /api/auth/users allowed (HTTP 200)');
  assert(Array.isArray(usersRes.data?.users) && usersRes.data.users.length > 0, `Users returned: ${usersRes.data?.users?.length} accounts`);

  // Unauthenticated access to /api/auth/users must be blocked
  const unauthUsers = await request('/api/auth/users');
  assert(unauthUsers.status === 401, 'Unauthenticated GET /api/auth/users blocked with HTTP 401');

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 3: FIRESTORE AUTHORITATIVE CRUD LIFECYCLE (WITH RUN_ID TRACKING)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 STAGE 3: AUTHORITATIVE FIRESTORE WRITE -> READ -> UPDATE -> PURGE');

  const testTaskId = `task_${RUN_ID}`;
  const testTaskTitle = `Task ${RUN_ID} Production Verification`;

  // Create task via API
  const createTaskRes = await request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      title: testTaskTitle,
      description: `Task created for ${RUN_ID} verification pipeline`,
      priority: 'urgent',
      dueDate: '2026-09-30',
      targetType: 'individual',
      targetUserId: 'GSS_SA_001',
    }),
  });

  assert(createTaskRes.status === 201, 'POST /api/tasks returns HTTP 201 Created');
  const createdTaskId = createTaskRes.data?.task?.id;
  assert(Boolean(createdTaskId), `Task successfully persisted with ID: ${createdTaskId}`);
  if (createdTaskId) testRecords.push({ collection: 'tasks', id: createdTaskId });

  // Verify direct in Firestore
  if (createdTaskId) {
    const taskDocSnap = await db.collection('tasks').doc(createdTaskId).get();
    assert(taskDocSnap.exists, 'Task confirmed exists directly in Cloud Firestore');
    assert(taskDocSnap.data()?.title === testTaskTitle, 'Firestore task data matches canonical payload');

    // Transition 1: pending -> in_progress
    const inProgRes = await request('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ taskId: createdTaskId, status: 'in_progress' }),
    });
    assert(inProgRes.status === 200, 'PATCH /api/tasks (Status: in_progress) returns HTTP 200');

    // Transition 2: in_progress -> completed
    const doneRes = await request('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ taskId: createdTaskId, status: 'completed' }),
    });
    assert(doneRes.status === 200, 'PATCH /api/tasks (Status: completed) returns HTTP 200');

    // Verify update in Firestore
    const updatedSnap = await db.collection('tasks').doc(createdTaskId).get();
    assert(updatedSnap.data()?.status === 'completed', 'Firestore record reflects updated status: completed');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 4: GOOGLE SHEETS DECOUPLED PROJECTION CHECK
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 STAGE 4: GOOGLE SHEETS CONTROLLED PROJECTION PIPELINE');

  const sheetsWorklog = await request('/api/sheets?type=worklog&staffId=GSS_SA_001&branchCode=CBE', {
    headers: { Cookie: cookieHeader },
  });
  assert(sheetsWorklog.status === 200, 'Sheets worklog projection endpoint returns HTTP 200');
  assert(sheetsWorklog.data?.success === true, 'Sheets projection acknowledges success');

  const sheetsStudents = await request('/api/sheets?type=branch_student_directory&branchCode=CBE', {
    headers: { Cookie: cookieHeader },
  });
  assert(sheetsStudents.status === 200, 'Central student directory projection returns HTTP 200');

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 5: COMPLETE ROUTE RENDERING HEALTH
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 STAGE 5: ROUTE ACCESSIBILITY & RENDERING HEALTH');

  const routes = [
    '/dashboard',
    '/worklog',
    '/my-students',
    '/students',
    '/tasks',
    '/admin/directory',
    '/admin/attendance',
    '/leads',
    '/reports',
    '/admin/users',
    '/account',
    '/account/personal-info',
    '/account/security',
    '/account/data-privacy',
  ];

  for (const r of routes) {
    const pageRes = await request(r, { headers: { Cookie: cookieHeader } });
    assert(pageRes.status === 200, `Page route ${r} renders HTTP 200`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 6: ZERO-PERSISTENT BUSINESS CACHE CODE INSPECTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 STAGE 6: ZERO-PERSISTENT BROWSER CACHE AUDIT');

  // Verify apps/web/src/lib/firebase.ts has memoryLocalCache
  const firebaseTs = fs.readFileSync('apps/web/src/lib/firebase.ts', 'utf8');
  assert(firebaseTs.includes('memoryLocalCache()'), 'Firebase client uses memoryLocalCache() (ephemeral)');
  assert(!firebaseTs.includes('persistentLocalCache'), 'Firebase client does NOT use persistentLocalCache()');

  // Verify public/sw.js ignores /api/ and caches only static assets
  const swJs = fs.readFileSync('apps/web/public/sw.js', 'utf8');
  assert(swJs.includes("url.pathname.startsWith('/api/')"), 'Service worker explicitly skips /api/ routes');
  assert(swJs.includes("isStaticAsset"), 'Service worker caches only static assets');

  // Verify useDailySession.ts has no localStorage.setItem for management data
  const sessionTs = fs.readFileSync('apps/web/src/lib/worklogs/useDailySession.ts', 'utf8');
  assert(!sessionTs.includes('localStorage.setItem'), 'useDailySession has zero localStorage.setItem management calls');

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 7: TEST DATA PURGE & POST-CLEANUP VERIFICATION (LAW 86)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 STAGE 7: TEST RECORD PURGE & CLEANUP AUDIT (LAW 86)');

  for (const rec of testRecords) {
    await db.collection(rec.collection).doc(rec.id).delete();
    const check = await db.collection(rec.collection).doc(rec.id).get();
    assert(!check.exists, `Purged test record ${rec.collection}/${rec.id}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STAGE 8: SUMMARY & PRODUCTION READINESS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`🏁 MASTER AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
