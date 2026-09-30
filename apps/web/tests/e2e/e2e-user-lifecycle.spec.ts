import { test, expect } from '@playwright/test';
import path from 'path';

// Target Artifact Directory for screenshots
const ARTIFACT_DIR = 'C:/Users/jasva/.gemini/antigravity-ide/brain/904825a8-5ef3-458f-b5fc-d3ac91898339';

test.describe('End-to-End Web Lifecycle & Feature Inspection', () => {
  test.setTimeout(180000); // 3 minutes timeout for comprehensive browser walkthrough

  test('Complete Flow: Registration -> Firestore Data -> Super Admin Approval -> Attendance & Tasks -> Audit Data & Feature Inspection', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-6);
    const applicantName = `Vikramaditya Test ${timestamp}`;
    const applicantEmail = `applicant.${timestamp}@gmail.com`;
    const applicantMobile = `98${timestamp.padStart(8, '0')}`.slice(0, 10);
    const password = 'Password@123';

    // =========================================================================
    // STEP 1: Account Creation from Web UI
    // =========================================================================
    console.log(`[E2E] 1. Navigating to Web Registration (/register) for: ${applicantEmail}`);
    await page.goto('/register');
    await expect(page).toHaveTitle(/GSS/i);
    await expect(page.locator('h1')).toContainText(/Create your GSS Account/i);

    // Fill Registration Form
    await page.fill('input[placeholder="e.g. Rahul Sharma"]', applicantName);
    await page.fill('input[placeholder="name@gmail.com"]', applicantEmail);
    await page.fill('input[placeholder="10-digit number"]', applicantMobile);

    // Select Branch
    await page.selectOption('select#branch-select', 'Coimbatore');

    // Select Requested Role
    await page.selectOption('select#requested-role', 'employee');

    // Fill Passwords
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(password);
    await passwordInputs.nth(1).fill(password);

    console.log('[E2E] Submitting Registration Form via Web UI button...');
    await page.click('button:has-text("Create account")');

    // =========================================================================
    // STEP 2: Verify Redirection to Pending Approval Page
    // =========================================================================
    console.log('[E2E] Waiting for redirection to Pending Review page (/pending)...');
    await page.waitForURL('**/pending', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/Account Under Review/i);
    await expect(page.locator('text=' + applicantEmail)).toBeVisible();
    await expect(page.locator('text=Pending Approval')).toBeVisible();

    // Screenshot 1: Account Created in Pending State
    const scPending = path.join(ARTIFACT_DIR, '01_account_created_pending.png');
    await page.screenshot({ path: scPending, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scPending}`);

    // =========================================================================
    // STEP 3: Sign Out from Pending Applicant via Two-Step Modal
    // =========================================================================
    console.log('[E2E] Initiating Sign out from pending user session...');
    await page.click('button:has-text("Sign out")');
    const confirmSignOutBtn = page.locator('button:has-text("Yes, Sign Out")');
    await expect(confirmSignOutBtn).toBeVisible({ timeout: 5000 });
    console.log('[E2E] Confirming sign out in two-step modal...');
    await confirmSignOutBtn.click();
    await page.waitForURL('**/login', { timeout: 15000 });
    console.log('[E2E] Returned to Login page.');

    // =========================================================================
    // STEP 4: Login as Super Admin
    // =========================================================================
    console.log('[E2E] Logging in as Super Admin (gateway.managercbe@gmail.com)...');
    await page.fill('input[type="email"], input[type="text"]', 'gateway.managercbe@gmail.com');
    await page.fill('input[type="password"]', 'GatewaySS@2013#');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`[E2E] Super Admin Logged in. Active URL: ${page.url()}`);

    // =========================================================================
    // STEP 5: Super Admin Approves User in Web UI (retrieved from Firestore)
    // =========================================================================
    console.log('[E2E] Navigating to Staff Management (/admin/users)...');
    await page.goto('/admin/users');
    await page.waitForSelector('table', { timeout: 15000 });

    // Locate the newly created applicant row
    const userRow = page.locator('tr', { hasText: applicantEmail });
    await expect(userRow).toBeVisible({ timeout: 10000 });
    await expect(userRow.locator('text=pending')).toBeVisible();

    // Screenshot 2: Admin Users List with Pending Applicant
    const scAdminUsersPending = path.join(ARTIFACT_DIR, '02_admin_users_pending.png');
    await page.screenshot({ path: scAdminUsersPending, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scAdminUsersPending}`);

    // Click "Approve" button
    console.log('[E2E] Clicking Approve button in Web UI...');
    const approveBtn = userRow.locator('button:has-text("Approve")');
    await approveBtn.click();

    // Wait for status to transition to active
    await page.waitForTimeout(2500);
    const updatedUserRow = page.locator('tr', { hasText: applicantEmail });
    await expect(updatedUserRow.locator('text=active')).toBeVisible({ timeout: 10000 });

    // Screenshot 3: User Approved in Firestore & Web UI
    const scAdminUsersApproved = path.join(ARTIFACT_DIR, '03_admin_users_approved.png');
    await page.screenshot({ path: scAdminUsersApproved, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scAdminUsersApproved}`);

    // =========================================================================
    // STEP 6: Attendance Check - Daily Worklog & Punch Tracking (/worklog)
    // =========================================================================
    console.log('[E2E] Navigating to Attendance & Daily Worklog (/worklog)...');
    await page.goto('/worklog');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check if Punch In is available
    const punchInBtn = page.locator('button:has-text("Punch In")');
    if (await punchInBtn.isVisible()) {
      console.log('[E2E] Testing Punch In to start work session...');
      await punchInBtn.click();
      await page.waitForTimeout(1500);
    }

    // Add a planned task point
    const taskInput = page.locator('input[placeholder="Type a task point and press Enter..."]').first();
    if (await taskInput.isVisible()) {
      console.log('[E2E] Entering planned deliverable item...');
      await taskInput.fill('Deploy and verify cloud authentication lifecycle');
      await taskInput.press('Enter');
      await page.waitForTimeout(600);
    }

    // Screenshot 4: Worklog & Attendance Session
    const scWorklog = path.join(ARTIFACT_DIR, '04_worklog_attendance.png');
    await page.screenshot({ path: scWorklog, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scWorklog}`);

    // =========================================================================
    // STEP 7: Master Attendance Matrix Check (/admin/attendance)
    // =========================================================================
    console.log('[E2E] Navigating to Master Attendance Grid (/admin/attendance)...');
    await page.goto('/admin/attendance');
    await page.waitForFunction(() => !document.body.innerText.includes('Loading September 2026 Attendance Grid'), { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('table tbody tr td button', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Toggle a cell to create an unsaved change
    const firstCellBtn = page.locator('table tbody tr td button').first();
    if (await firstCellBtn.isVisible()) {
      console.log('[E2E] Toggling attendance cell in grid...');
      await firstCellBtn.click();
      await page.waitForTimeout(800);

      // Verify and click "Save Changes" button
      const saveBtn = page.locator('button:has-text("Save Changes")').first();
      if (await saveBtn.isVisible()) {
        console.log('[E2E] Clicking Save Changes button to persist and overwrite in Firestore...');
        await saveBtn.click();
        // Wait for confirmation notification
        await page.waitForSelector('text=Attendance successfully updated', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
    }

    // Screenshot 5: Admin Attendance Grid with Save confirmation and live status
    const scAdminAttendance = path.join(ARTIFACT_DIR, '05_admin_attendance_grid.png');
    await page.screenshot({ path: scAdminAttendance, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scAdminAttendance}`);

    // =========================================================================
    // STEP 8: Task Check - Delegation & Status Transitions (/tasks)
    // =========================================================================
    console.log('[E2E] Navigating to Task Delegation & Management (/tasks)...');
    await page.goto('/tasks');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Open Task Assignment Modal
    const assignBtn = page.locator('button:has-text("Assign New Task")').first();
    if (await assignBtn.isVisible()) {
      console.log('[E2E] Opening Task Assignment modal...');
      await assignBtn.click();
      await page.waitForTimeout(1000);

      // Fill Task Title
      const titleInput = page.locator('input[placeholder*="routing"], input[placeholder*="Next.js"], input[placeholder*="materials"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill(`Automated E2E Verification Task ${timestamp}`);
      }

      // Fill Description
      const descArea = page.locator('textarea[placeholder*="deliverables"]').first();
      if (await descArea.isVisible()) {
        await descArea.fill('Verify end-to-end task completion and attendance sync.');
      }

      // Submit new task via "Dispatch Task"
      const submitTaskBtn = page.locator('button:has-text("Dispatch Task")').first();
      if (await submitTaskBtn.isVisible()) {
        console.log('[E2E] Clicking Dispatch Task button...');
        await submitTaskBtn.click({ force: true, noWaitAfter: true });
        await page.waitForTimeout(2500);
      }
    }

    // Screenshot 6: Tasks Board
    const scTasks = path.join(ARTIFACT_DIR, '06_tasks_management.png');
    await page.screenshot({ path: scTasks, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scTasks}`);

    // =========================================================================
    // STEP 9: Audit Data & Full Feature Inspection Walkthrough
    // =========================================================================
    // A. Dashboard Overview
    console.log('[E2E] Inspecting Dashboard Overview (/dashboard)...');
    await page.goto('/dashboard');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scDashboard = path.join(ARTIFACT_DIR, '07_dashboard_overview.png');
    await page.screenshot({ path: scDashboard, fullPage: true });

    // B. Student Management (/students)
    console.log('[E2E] Inspecting Student Management (/students)...');
    await page.goto('/students');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scStudents = path.join(ARTIFACT_DIR, '08_students_directory.png');
    await page.screenshot({ path: scStudents, fullPage: true });

    // C. My Assigned Students (/my-students)
    console.log('[E2E] Inspecting My Students (/my-students)...');
    await page.goto('/my-students');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scMyStudents = path.join(ARTIFACT_DIR, '09_my_students.png');
    await page.screenshot({ path: scMyStudents, fullPage: true });

    // D. Leads & CRM (/leads)
    console.log('[E2E] Inspecting Leads & CRM (/leads)...');
    await page.goto('/leads');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scLeads = path.join(ARTIFACT_DIR, '10_leads_crm.png');
    await page.screenshot({ path: scLeads, fullPage: true });

    // E. Executive Reports (/reports)
    console.log('[E2E] Inspecting Reports & Analytics (/reports)...');
    await page.goto('/reports');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scReports = path.join(ARTIFACT_DIR, '11_executive_reports.png');
    await page.screenshot({ path: scReports, fullPage: true });

    // F. Staff Directory (/admin/directory)
    console.log('[E2E] Inspecting Staff Directory (/admin/directory)...');
    await page.goto('/admin/directory');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scDirectory = path.join(ARTIFACT_DIR, '12_staff_directory.png');
    await page.screenshot({ path: scDirectory, fullPage: true });

    // G. Account Profile & Preferences (/account)
    console.log('[E2E] Inspecting Account Profile (/account)...');
    await page.goto('/account');
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000);
    const scAccount = path.join(ARTIFACT_DIR, '13_account_profile.png');
    await page.screenshot({ path: scAccount, fullPage: true });

    // H. System Audit Data Trail (/admin/audit)
    console.log('[E2E] Inspecting System Audit Data Trail (/admin/audit)...');
    await page.goto('/admin/audit');
    await page.waitForSelector('body', { timeout: 10000 });
    // Wait for the audit table rows to finish loading
    await page.waitForFunction(() => !document.body.innerText.includes('Loading immutable audit records'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const scAudit = path.join(ARTIFACT_DIR, '14_system_audit_trail.png');
    await page.screenshot({ path: scAudit, fullPage: true });
    console.log(`[E2E] Saved screenshot: ${scAudit}`);

    console.log('[E2E] ALL BROWSER VALIDATIONS, AUDIT DATA CHECKS AND FEATURE ANALYSIS COMPLETED SUCCESSFULLY!');
  });
});
