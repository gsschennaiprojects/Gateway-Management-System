const BASE_URL = 'http://localhost:3000';

async function test() {
  // Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'gateway.managercbe@gmail.com', password: 'GatewaySS@2013#' }),
  });
  const loginData = await loginRes.json();
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log('=== LOGIN ===');
  console.log('Status:', loginRes.status, loginData.success ? 'OK' : 'FAIL');
  console.log('User:', loginData.user?.name, '|', loginData.user?.role);

  // Test all API endpoints
  const endpoints = [
    { method: 'GET', path: '/api/auth/me' },
    { method: 'GET', path: '/api/auth/users' },
    { method: 'GET', path: '/api/tasks' },
    { method: 'GET', path: '/api/notifications' },
    { method: 'GET', path: '/api/worklogs' },
    { method: 'GET', path: '/api/sheets?type=worklog&staffId=GSS_SA_001&branchCode=CBE' },
    { method: 'GET', path: '/api/sheets?type=branch_student_directory&branchCode=CBE' },
    { method: 'GET', path: '/api/sheets?type=attendance_tracker&staffId=CBE_ADM01&branchCode=CBE&month=2026-09' },
  ];

  console.log('\n=== API ENDPOINTS ===');
  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep.path}`, { headers: { Cookie: cookie } });
    const ct = res.headers.get('content-type') || '';
    let detail = '';
    if (ct.includes('json')) {
      const d = await res.json();
      if (d.users) detail = 'users: ' + d.users.length;
      else if (d.tasks) detail = 'tasks: ' + d.tasks.length;
      else if (d.notifications) detail = 'notifs: ' + d.notifications.length;
      else if (d.data?.length) detail = 'records: ' + d.data.length;
      else if (d.data?.students) detail = 'students: ' + d.data.students.length;
      else if (d.user) detail = 'user: ' + d.user.name;
      else if (d.success !== undefined) detail = 'success: ' + d.success;
      else detail = JSON.stringify(d).substring(0, 80);
    }
    console.log(res.status + ' ' + ep.method + ' ' + ep.path + ' -> ' + detail);
  }

  // Test PATCH /api/tasks (task status update)
  const tasksRes = await fetch(`${BASE_URL}/api/tasks`, { headers: { Cookie: cookie } });
  const tasksData = await tasksRes.json();
  if (tasksData.tasks?.length > 0) {
    const firstTask = tasksData.tasks[0];
    const patchRes = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ taskId: firstTask.id, status: 'in_progress' }),
    });
    console.log(patchRes.status + ' PATCH /api/tasks (status update) -> ' + (patchRes.ok ? 'OK' : 'FAIL'));
  }

  // Test logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  console.log(logoutRes.status + ' POST /api/auth/logout -> ' + (logoutRes.ok ? 'OK' : 'FAIL'));

  // Test page routes return HTML
  console.log('\n=== PAGE ROUTES ===');
  const pages = [
    '/', '/login', '/register', '/pending',
    '/dashboard', '/worklog', '/my-students', '/students',
    '/tasks', '/leads', '/reports',
    '/admin/directory', '/admin/attendance', '/admin/users', '/admin/approvals',
    '/account', '/account/personal-info', '/account/security',
    '/account/data-privacy', '/account/payments', '/account/people-sharing', '/account/about',
  ];

  // Re-login for page tests
  const loginRes2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'gateway.managercbe@gmail.com', password: 'GatewaySS@2013#' }),
  });
  const cookie2 = loginRes2.headers.get('set-cookie')?.split(';')[0] || '';

  let passed = 0;
  let failed = 0;
  for (const p of pages) {
    try {
      const res = await fetch(`${BASE_URL}${p}`, { headers: { Cookie: cookie2 }, redirect: 'manual' });
      const ct = res.headers.get('content-type') || '';
      const isHtml = ct.includes('text/html');
      const status = res.status;
      if (status === 200) {
        console.log('OK  ' + status + ' ' + p + (isHtml ? ' (HTML)' : ' (' + ct.substring(0, 30) + ')'));
        passed++;
      } else if (status === 307 || status === 308) {
        console.log('RDR ' + status + ' ' + p + ' -> redirect');
        passed++;
      } else {
        console.log('ERR ' + status + ' ' + p);
        failed++;
      }
    } catch (e) {
      console.log('ERR ' + p + ' -> ' + e.message);
      failed++;
    }
  }

  console.log('\n=== SUMMARY: ' + passed + ' passed, ' + failed + ' failed ===');
}

test().catch(e => console.error('Fatal:', e));
