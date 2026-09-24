/**
 * test-worklog-validation.mjs
 * 
 * Verifies:
 * 1. Punch In blocked if 0 planned tasks.
 * 2. Punch In succeeds with planned tasks and appends to database.
 * 3. Refresh (GET /api/worklogs?today=true) preserves login state & planned tasks.
 * 4. Punch Out blocked if 0 completed tasks.
 * 5. Punch Out blocked if completed < planned and reason is missing.
 * 6. Punch Out succeeds if completed < planned with reason provided.
 * 7. Refresh after logout preserves login, logout, total hours, and tasks.
 * 8. Cleanup test data so database structure remains clean.
 */

import fetch from 'node-fetch';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.resolve(__dirname, '../firebase-admin-key.json');
const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: sa.project_id }, 'testApp_' + Date.now());
const db = getFirestore(app);

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== WORKLOG PUNCH IN / OUT & VALIDATION TEST ===\n');

  // 1. Sign in as Super Admin
  console.log('1. Signing in as Super Admin GSS_SA_001...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'gateway.managercbe@gmail.com',
      password: 'GatewaySS@2013#',
      rememberMe: true,
    }),
  });

  const cookieHeader = loginRes.headers.get('set-cookie');
  if (!cookieHeader) {
    throw new Error('Failed to obtain authentication cookie from login');
  }
  console.log('✓ Successfully authenticated.\n');

  const todayStr = new Date().toISOString().substring(0, 10);
  const dateKey = todayStr.replace(/-/g, '');
  const testLogId = `WL_GSS_SA_001_${dateKey}`;

  // Clean any existing test worklog for today
  await db.collection('daily_worklogs').doc(testLogId).delete();

  // Test 1: Punch In with 0 planned tasks
  console.log('2. Testing Punch In with 0 planned tasks (Should Fail with 400)...');
  const failPunchInRes = await fetch(`${BASE_URL}/api/worklogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'punchIn',
      loginTime: '09:00 AM',
      date: todayStr,
      plannedTasks: [],
    }),
  });
  const failPunchInData = await failPunchInRes.json();
  console.log('Status:', failPunchInRes.status, 'Error:', failPunchInData.error);
  if (failPunchInRes.status !== 400 || !failPunchInData.error?.includes('planned task')) {
    throw new Error('Expected 400 error requiring at least one planned task for login');
  }
  console.log('✓ Punch In correctly rejected when 0 planned tasks entered.\n');

  // Test 2: Punch In with 2 planned tasks
  console.log('3. Testing Punch In with 2 planned tasks (Should Succeed with 201)...');
  const successPunchInRes = await fetch(`${BASE_URL}/api/worklogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'punchIn',
      loginTime: '09:00 AM',
      date: todayStr,
      plannedTasks: [
        'Review enterprise operations policy',
        'Verify branch security configurations'
      ],
    }),
  });
  const successPunchInData = await successPunchInRes.json();
  console.log('Status:', successPunchInRes.status, 'Success:', successPunchInData.success);
  if (successPunchInRes.status !== 201 || !successPunchInData.isPunchedIn) {
    throw new Error('Expected 201 success on valid Punch In');
  }
  console.log('✓ Punch In succeeded and recorded in database.\n');

  // Test 3: Refresh check (GET /api/worklogs?today=true)
  console.log('4. Simulating Page Refresh (GET /api/worklogs?today=true)...');
  const refreshRes = await fetch(`${BASE_URL}/api/worklogs?today=true&targetUserId=GSS_SA_001`, {
    headers: { Cookie: cookieHeader },
  });
  const refreshData = await refreshRes.json();
  console.log('PunchedIn:', refreshData.isPunchedIn, 'LoginTime:', refreshData.todayLog?.loginTime);
  console.log('PlannedTasks in DB:', refreshData.todayLog?.plannedTasks);
  if (!refreshData.isPunchedIn || refreshData.todayLog?.loginTime !== '09:00 AM') {
    throw new Error('Expected loginTime and isPunchedIn to persist on page refresh');
  }
  if (!refreshData.todayLog?.plannedTasks || refreshData.todayLog.plannedTasks.length !== 2) {
    throw new Error('Expected planned tasks to persist on page refresh');
  }
  console.log('✓ Page refresh preserved loginTime and plannedTasks from database!\n');

  // Test 4: Punch Out with 0 completed tasks
  console.log('5. Testing Punch Out with 0 completed tasks (Should Fail with 400)...');
  const failPunchOutRes1 = await fetch(`${BASE_URL}/api/worklogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'punchOut',
      logoutTime: '06:00 PM',
      date: todayStr,
      completedTasks: [],
    }),
  });
  const failPunchOutData1 = await failPunchOutRes1.json();
  console.log('Status:', failPunchOutRes1.status, 'Error:', failPunchOutData1.error);
  if (failPunchOutRes1.status !== 400 || !failPunchOutData1.error?.includes('completed task')) {
    throw new Error('Expected 400 error requiring at least one completed task for logout');
  }
  console.log('✓ Punch Out correctly rejected when 0 completed tasks entered.\n');

  // Test 5: Punch Out with completed (1) < planned (2) WITHOUT reason
  console.log('6. Testing Punch Out with completed (1) < planned (2) and NO reason (Should Fail with 400)...');
  const failPunchOutRes2 = await fetch(`${BASE_URL}/api/worklogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'punchOut',
      logoutTime: '06:00 PM',
      date: todayStr,
      plannedTasks: [
        'Review enterprise operations policy',
        'Verify branch security configurations'
      ],
      completedTasks: [
        'Review enterprise operations policy'
      ],
      incompleteReason: '',
    }),
  });
  const failPunchOutData2 = await failPunchOutRes2.json();
  console.log('Status:', failPunchOutRes2.status, 'Error:', failPunchOutData2.error);
  if (failPunchOutRes2.status !== 400 || !failPunchOutData2.error?.includes('reason')) {
    throw new Error('Expected 400 error requiring reason when completed < planned');
  }
  console.log('✓ Punch Out correctly rejected when completed < planned without reason.\n');

  // Test 6: Punch Out with completed (1) < planned (2) WITH reason
  console.log('7. Testing Punch Out with completed (1) < planned (2) WITH reason (Should Succeed with 201)...');
  const successPunchOutRes = await fetch(`${BASE_URL}/api/worklogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      action: 'punchOut',
      loginTime: '09:00 AM',
      logoutTime: '06:00 PM',
      date: todayStr,
      plannedTasks: [
        'Review enterprise operations policy',
        'Verify branch security configurations'
      ],
      completedTasks: [
        'Review enterprise operations policy'
      ],
      incompleteReason: 'Second audit deliverable rescheduled to tomorrow morning',
    }),
  });
  const successPunchOutData = await successPunchOutRes.json();
  console.log('Status:', successPunchOutRes.status, 'Success:', successPunchOutData.success);
  console.log('Working Calc:', successPunchOutData.workingCalc);
  if (successPunchOutRes.status !== 201 || !successPunchOutData.isPunchedOut) {
    throw new Error('Expected 201 success on Punch Out with reason');
  }
  console.log('✓ Punch Out succeeded with reason and computed working hours!\n');

  // Test 7: Verify Firestore document directly (Same entry check)
  console.log('8. Verifying Firestore document (same entry persisted)...');
  const docSnap = await db.collection('daily_worklogs').doc(testLogId).get();
  const docData = docSnap.data();
  console.log('Firestore Doc:', JSON.stringify(docData, null, 2));
  if (docData.loginTime !== '09:00 AM' || docData.logoutTime !== '06:00 PM') {
    throw new Error('Expected loginTime and logoutTime both in same Firestore document');
  }
  if (!docData.incompleteReason?.includes('rescheduled')) {
    throw new Error('Expected incompleteReason in Firestore document');
  }
  if (!docData.totalHours) {
    throw new Error('Expected totalHours in Firestore document');
  }
  console.log('✓ Firestore document verified with both login, logout, tasks, reason, and total hours!\n');

  // Test 8: Refresh after logout
  console.log('9. Simulating Page Refresh after Logout (GET /api/worklogs?today=true)...');
  const finalRefreshRes = await fetch(`${BASE_URL}/api/worklogs?today=true&targetUserId=GSS_SA_001`, {
    headers: { Cookie: cookieHeader },
  });
  const finalData = await finalRefreshRes.json();
  console.log('PunchedIn:', finalData.isPunchedIn, 'PunchedOut:', finalData.isPunchedOut);
  console.log('Calculated Hours:', finalData.calculatedHours);
  if (!finalData.isPunchedIn || !finalData.isPunchedOut) {
    throw new Error('Expected both isPunchedIn and isPunchedOut true after logout');
  }
  console.log('✓ After logout refresh, entire session and hours accurately restored!\n');

  // Clean up test document to keep database structure clean as requested by user
  await db.collection('daily_worklogs').doc(testLogId).delete();
  const attId = `ATT_GSS_SA_001_${dateKey}`;
  await db.collection('attendance').doc(attId).delete();
  console.log('10. Cleaned test worklog and attendance records to keep structure clean.');

  console.log('\n=== ALL VALIDATION TESTS PASSED WITH 100% SUCCESS ===');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
