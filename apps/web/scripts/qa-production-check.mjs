import http from 'http';

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function runQATests() {
  console.log('====================================================');
  console.log('🚀 GSS MANAGEMENT SYSTEM — PRODUCTION QA TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Super Admin Login
  console.log('--- 1. Testing Super Admin Authentication ---');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'gateway.managercbe@gmail.com',
      password: 'GatewaySS@2013#',
    }),
  });

  assert(loginRes.status === 200, 'Super Admin Login HTTP 200');
  assert(loginRes.data?.success === true, 'Login API returns success: true');
  assert(loginRes.data?.user?.role === 'superadmin', 'User has superadmin role');
  assert(loginRes.data?.user?.email === 'gateway.managercbe@gmail.com', 'User email verified');

  // Extract session cookie
  const setCookie = loginRes.headers.get('set-cookie');
  assert(Boolean(setCookie), 'Session cookie returned on login');

  const cookieHeader = setCookie ? setCookie.split(';')[0] : '';

  // 2. Session check via /api/auth/me
  console.log('\n--- 2. Verifying Session State (/api/auth/me) ---');
  const meRes = await request('/api/auth/me', {
    headers: { Cookie: cookieHeader },
  });
  assert(meRes.status === 200, 'Current session check HTTP 200');
  assert(meRes.data?.user?.role === 'superadmin', 'Session identity matches superadmin');

  // 3. Test Core API Endpoints
  console.log('\n--- 3. Testing Core API Endpoints ---');
  
  // Users list
  const usersRes = await request('/api/auth/users', { headers: { Cookie: cookieHeader } });
  assert(usersRes.status === 200, 'GET /api/auth/users HTTP 200');
  assert(Array.isArray(usersRes.data?.users), 'Users API returns users array');
  assert(usersRes.data?.users?.length > 0, `Users array contains ${usersRes.data?.users?.length} accounts`);

  // Tasks API
  const tasksRes = await request('/api/tasks', { headers: { Cookie: cookieHeader } });
  assert(tasksRes.status === 200, 'GET /api/tasks HTTP 200');
  assert(Array.isArray(tasksRes.data?.tasks), 'Tasks API returns tasks array');

  // Task creation
  const newTaskRes = await request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      title: 'QA Automated Test Task - Production Verification',
      description: 'End-to-end production verification deliverable',
      priority: 'high',
      dueDate: '2026-09-30',
      targetType: 'individual',
      targetUserId: 'GSS_SA_001',
    }),
  });
  assert(newTaskRes.status === 201, 'POST /api/tasks (Task Dispatch) HTTP 201 Created');
  assert(newTaskRes.data?.task?.id, `Created task with ID ${newTaskRes.data?.task?.id}`);

  // Notifications API
  const notifRes = await request('/api/notifications', { headers: { Cookie: cookieHeader } });
  assert(notifRes.status === 200, 'GET /api/notifications HTTP 200');

  // Google Sheets integration API endpoints
  console.log('\n--- 4. Testing Google Sheets Integration Handlers ---');
  
  // Worklogs
  const worklogSheetRes = await request('/api/sheets?type=worklog&staffId=GSS_SA_001&branchCode=CBE', {
    headers: { Cookie: cookieHeader },
  });
  assert(worklogSheetRes.status === 200, 'GET /api/sheets (worklog) HTTP 200');
  assert(worklogSheetRes.data?.success === true, 'Worklog sheet response success');

  // Central Branch Student Directory (06_Student_Directory)
  const dirSheetRes = await request('/api/sheets?type=branch_student_directory&branchCode=CBE', {
    headers: { Cookie: cookieHeader },
  });
  assert(dirSheetRes.status === 200, 'GET /api/sheets (branch_student_directory) HTTP 200');
  assert(dirSheetRes.data?.success === true, 'Branch student directory response success');
  assert(Array.isArray(dirSheetRes.data?.data) && dirSheetRes.data?.data?.length > 0, `Student directory returned ${dirSheetRes.data?.data?.length} records`);

  // Attendance tracker subsheet (September 2026)
  const trackerSepRes = await request('/api/sheets?type=attendance_tracker&staffId=CBE_ADM01&branchCode=CBE&month=2026-09', {
    headers: { Cookie: cookieHeader },
  });
  assert(trackerSepRes.status === 200, 'GET /api/sheets (attendance_tracker Sep 2026) HTTP 200');
  assert(trackerSepRes.data?.data?.students?.length > 0, `September subsheet returned ${trackerSepRes.data?.data?.students?.length} student matrix rows`);

  // Attendance tracker subsheet (October 2026)
  const trackerOctRes = await request('/api/sheets?type=attendance_tracker&staffId=CBE_ADM01&branchCode=CBE&month=2026-10', {
    headers: { Cookie: cookieHeader },
  });
  assert(trackerOctRes.status === 200, 'GET /api/sheets (attendance_tracker Oct 2026) HTTP 200');
  assert(trackerOctRes.data?.data?.students?.length > 0, `October subsheet returned ${trackerOctRes.data?.data?.students?.length} student matrix rows (rollover filtered)`);

  // 5. Test Frontend Application Pages (Route Accessibility)
  console.log('\n--- 5. Testing Dashboard Route Rendering ---');
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
    assert(pageRes.status === 200, `Page Route ${r} HTTP 200 OK`);
  }

  // 6. Final Summary
  console.log('\n====================================================');
  console.log(`QA SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runQATests().catch((err) => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
