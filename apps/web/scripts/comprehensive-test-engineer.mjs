import fs from 'fs';
import path from 'path';

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
  return { status: res.status, ok: res.ok, headers: res.headers, data, contentType };
}

let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🔬 GSS ENTERPRISE SYSTEM — TEST ENGINEER AUTOMATED AUDIT');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: AUTHENTICATION & SECURITY AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log('📌 SUITE 1: AUTHENTICATION & ROLE-BASED ACCESS CONTROL');

  // 1.1 Super Admin Login
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'gateway.managercbe@gmail.com',
      password: 'GatewaySS@2013#',
    }),
  });

  assert(loginRes.status === 200, 'Super Admin login responds with HTTP 200');
  assert(loginRes.data?.success === true, 'Login payload returns success: true');
  assert(loginRes.data?.user?.role === 'superadmin', 'Authenticated identity has role: superadmin');
  assert(loginRes.data?.user?.email === 'gateway.managercbe@gmail.com', 'Authenticated email verified');

  const setCookie = loginRes.headers.get('set-cookie');
  assert(Boolean(setCookie), 'Session auth cookie issued');
  const cookieHeader = setCookie ? setCookie.split(';')[0] : '';

  // 1.2 Negative Test: Invalid password
  const badLoginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'gateway.managercbe@gmail.com',
      password: 'WrongPassword123!',
    }),
  });
  assert(badLoginRes.status === 401 || badLoginRes.data?.success === false, 'Invalid credentials rejected with 401 / failure');

  // 1.3 Active session check
  const meRes = await request('/api/auth/me', { headers: { Cookie: cookieHeader } });
  assert(meRes.status === 200, 'Session verification (/api/auth/me) returns 200');
  assert(meRes.data?.user?.role === 'superadmin', 'Current user session matches superadmin');

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: ROUTE ACCESSIBILITY & LINK VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n📌 SUITE 2: ALL APPLICATION ROUTES & LINK HEALTH');

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

  const internalLinks = new Set();

  for (const r of routes) {
    const res = await request(r, { headers: { Cookie: cookieHeader } });
    assert(res.status === 200, `Page ${r} renders with HTTP 200`);

    // Scrape href links in HTML
    if (typeof res.data === 'string') {
      const hrefRegex = /href="(\/[a-zA-Z0-9_\-\/]+)"/g;
      let match;
      while ((match = hrefRegex.exec(res.data)) !== null) {
        const link = match[1];
        if (!link.startsWith('/_next') && !link.startsWith('/api') && !link.includes('.')) {
          internalLinks.add(link);
        }
      }
    }
  }

  console.log(`\n  Scraped ${internalLinks.size} unique internal navigation links across views.`);
  for (const link of internalLinks) {
    const linkRes = await request(link, { headers: { Cookie: cookieHeader } });
    assert(linkRes.status === 200, `Link target ${link} is healthy (200 OK)`);
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 3: CORE DATA PIPELINES & INTERACTIVE ACTIONS
  // ─────────────────────────────────────────────────────────────
  console.log('\n📌 SUITE 3: INTERACTIVE ACTIONS & BUSINESS LOGIC PIPELINES');

  // 3.1 Tasks Hub: Create, Assign, Progress, Complete
  const taskTitle = `QA Integration Deliverable — ${Date.now()}`;
  const createTaskRes = await request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      title: taskTitle,
      description: 'End-to-end automated task creation and lifecycle verification',
      priority: 'high',
      dueDate: '2026-09-30',
      targetType: 'individual',
      targetUserId: 'usr_superadmin_sabarinathan',
    }),
  });
  assert(createTaskRes.status === 201, 'POST /api/tasks (Create & Assign) returns 201 Created');
  const taskId = createTaskRes.data?.task?.id;
  assert(Boolean(taskId), `Task created with ID: ${taskId}`);

  if (taskId) {
    // Update task to in_progress
    const inProgRes = await request('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ taskId, status: 'in_progress' }),
    });
    assert(inProgRes.status === 200, 'PATCH /api/tasks (Status: in_progress) returns 200');

    // Update task to completed
    const doneRes = await request('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ taskId, status: 'completed' }),
    });
    assert(doneRes.status === 200, 'PATCH /api/tasks (Status: completed) returns 200');
  }

  // 3.2 Notifications Pipeline
  const notifRes = await request('/api/notifications', { headers: { Cookie: cookieHeader } });
  assert(notifRes.status === 200, 'GET /api/notifications returns 200');
  assert(Array.isArray(notifRes.data?.notifications), 'Notifications returns valid array');

  // 3.3 Daily Worklogs Pipeline
  const todayStr = '2026-09-22';
  const saveWorklogRes = await request('/api/worklogs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      date: todayStr,
      loginTime: '09:00 AM',
      logoutTime: '06:00 PM',
      totalHours: '9.0 hrs',
      tasksCompleted: 'QA test suite execution and document export validation',
      tasksPending: 'None',
    }),
  });
  assert(saveWorklogRes.status === 200 || saveWorklogRes.status === 201, 'POST /api/worklogs (Save worklog) returns 200/201');

  const fetchWorklogsRes = await request('/api/worklogs', { headers: { Cookie: cookieHeader } });
  assert(fetchWorklogsRes.status === 200, 'GET /api/worklogs returns 200');

  // 3.4 Google Sheets Integration Handlers
  const sheetWorklogsRes = await request('/api/sheets?type=worklog&staffId=usr_superadmin_sabarinathan&branchCode=CBE', {
    headers: { Cookie: cookieHeader },
  });
  assert(sheetWorklogsRes.status === 200 && sheetWorklogsRes.data?.success === true, 'Sheets worklog handler operational');

  const branchDirectoryRes = await request('/api/sheets?type=branch_student_directory&branchCode=CBE', {
    headers: { Cookie: cookieHeader },
  });
  assert(branchDirectoryRes.status === 200 && branchDirectoryRes.data?.success === true, 'Central Student Directory (06_Student_Directory) operational');

  const trackerSepRes = await request('/api/sheets?type=attendance_tracker&staffId=CBE_ADM01&branchCode=CBE&month=2026-09', {
    headers: { Cookie: cookieHeader },
  });
  assert(trackerSepRes.status === 200 && trackerSepRes.data?.success === true, 'September Attendance Tracker (ATT_CBE_ADM01) operational');

  const trackerOctRes = await request('/api/sheets?type=attendance_tracker&staffId=CBE_ADM01&branchCode=CBE&month=2026-10', {
    headers: { Cookie: cookieHeader },
  });
  assert(trackerOctRes.status === 200 && trackerOctRes.data?.success === true, 'October Rollover Attendance Tracker operational');

  // 3.5 User Management & Directory
  const usersRes = await request('/api/auth/users', { headers: { Cookie: cookieHeader } });
  assert(usersRes.status === 200, 'GET /api/auth/users returns 200');
  assert(usersRes.data?.users?.length >= 5, `Total registered personnel count: ${usersRes.data?.users?.length}`);

  // ─────────────────────────────────────────────────────────────
  // SUITE 4: EXPORT TOOLBARS & DOCUMENTS SANITY
  // ─────────────────────────────────────────────────────────────
  console.log('\n📌 SUITE 4: EXPORT TOOLBARS & REPORT DOWNLOADS');

  const pagesWithExport = [
    'src/app/(dashboard)/reports/page.tsx',
    'src/app/(dashboard)/students/page.tsx',
    'src/app/(dashboard)/my-students/page.tsx',
    'src/app/(dashboard)/admin/attendance/page.tsx',
    'src/app/(dashboard)/tasks/page.tsx',
    'src/app/(dashboard)/leads/page.tsx',
    'src/app/(dashboard)/worklog/page.tsx',
    'src/app/(dashboard)/admin/directory/page.tsx',
    'src/app/(dashboard)/admin/users/page.tsx',
  ];

  for (const p of pagesWithExport) {
    const fullPath = path.resolve(process.cwd(), p);
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasPrint = content.includes('window.print()') || content.includes('Print / PDF');
    const hasExcel = content.includes('exportToExcel') || content.includes('Download Excel') || content.includes('Export Excel');
    const hasDocx = content.includes('exportToDocx') || content.includes('Download DOCX') || content.includes('Export DOCX');
    assert(hasPrint && hasExcel && hasDocx, `Export Toolbar complete on ${path.basename(path.dirname(p))}/${path.basename(p)}`);
  }

  // ─────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(`🏁 TEST ENGINEERING AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
