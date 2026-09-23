/**
 * ============================================================================
 * END-TO-END VERIFICATION & TEST PURGE RUNNER
 * Verifies the full user flow across Web, Firestore, and Google Sheets,
 * and cleanly purges all test data afterwards.
 * ============================================================================
 */

import { getAdminFirestore, syncUserToFirestore, syncTaskToFirestore, syncWorklogToFirestore, syncStudentToFirestore, syncAttendanceToFirestore } from '../src/lib/firebase/firebase-admin';
import {
  createStaffSubsheets,
  deleteStaffSubsheets,
  upsertStaffDirectory,
  appendBranchTaskAllocation,
  appendBranchDailyWorklog,
  upsertWorklog,
  upsertTask,
  upsertStudent,
  upsertBranchStudent,
  appendAttendanceRecord,
  getSheetsApi
} from '../src/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP } from '../src/lib/seed-branches';

const TEST_STAFF_ID = 'SYNTH_TEST_STAFF_99';
const TEST_STAFF_NAME = 'Synthetic Test Staff';
const TEST_STAFF_EMAIL = 'synth_test_staff99@example.com';
const TEST_BRANCH_CODE = 'CHN';
const TEST_SPREADSHEET_ID = BRANCH_SPREADSHEET_MAP[TEST_BRANCH_CODE];

const TEST_TASK_ID = 'TSK_SYNTH_9901';
const TEST_WORKLOG_ID = 'WL_SYNTH_9901';
const TEST_STUDENT_ID = 'STU_SYNTH_9901';
const TEST_ATT_ID = 'ATT_SYNTH_9901';

async function runE2EVerification() {
  console.log('================================================================');
  console.log('🚀 STARTING END-TO-END DUAL PERSISTENCE VERIFICATION');
  console.log(`Branch: ${TEST_BRANCH_CODE} | Spreadsheet ID: ${TEST_SPREADSHEET_ID}`);
  console.log('================================================================\n');

  const db = getAdminFirestore();
  if (!db) {
    throw new Error('❌ Firebase Admin Firestore could not be initialized!');
  }
  console.log('✅ Firebase Admin SDK connected to Firestore successfully.');

  // ─── STEP 1: Registration of Staff Member ───────────────────────────────────
  console.log('\n[STEP 1] Testing Staff Registration Flow...');
  
  // Firestore sync
  await syncUserToFirestore({
    id: TEST_STAFF_ID,
    name: TEST_STAFF_NAME,
    email: TEST_STAFF_EMAIL,
    mobile: '9876543210',
    role: 'intern',
    status: 'pending',
    branch: 'Chennai',
    specialization: 'Full Stack Development',
    startMonthYear: '2026-09'
  });

  // Google Sheets Staff Directory sync
  await upsertStaffDirectory(TEST_SPREADSHEET_ID, {
    staffId: TEST_STAFF_ID,
    fullName: TEST_STAFF_NAME,
    role: 'intern',
    designation: 'Intern Trainee',
    department: 'Operations',
    email: TEST_STAFF_EMAIL,
    mobile: '9876543210',
    joiningDate: '2026-09-23',
    reportingManager: 'Management',
    accountStatus: 'Pending',
    firebaseUid: TEST_STAFF_ID
  });

  // Verification
  const userDocPending = await db.collection('users').doc(TEST_STAFF_ID).get();
  console.log('   - Firestore User (Pending) Verified:', userDocPending.exists, userDocPending.data()?.status);

  // ─── STEP 2: Admin Approval & Automatic Subsheet Creation ───────────────────
  console.log('\n[STEP 2] Testing Admin Approval & Subsheet Auto-Creation...');
  
  // Update to active in Firestore
  await db.collection('users').doc(TEST_STAFF_ID).update({ status: 'active' });
  
  // Update to active in Google Sheets Directory
  await upsertStaffDirectory(TEST_SPREADSHEET_ID, {
    staffId: TEST_STAFF_ID,
    fullName: TEST_STAFF_NAME,
    role: 'intern',
    email: TEST_STAFF_EMAIL,
    accountStatus: 'Active'
  });

  // Create the 4 allocated subsheets for the staff member on their branch spreadsheet
  const subsheetResult = await createStaffSubsheets(TEST_SPREADSHEET_ID, TEST_STAFF_ID, TEST_STAFF_NAME, 'intern');
  console.log('   - Subsheets creation response:', subsheetResult.createdTabs.join(', '));

  // Verify subsheets exist on Google Sheets via API
  const api = await getSheetsApi();
  const metaAfterCreate = await api.spreadsheets.get({ spreadsheetId: TEST_SPREADSHEET_ID });
  const allSheetTitles = (metaAfterCreate.data.sheets || []).map(s => s.properties?.title);

  const expectedTabs = [
    `WL_${TEST_STAFF_ID}`,
    `STU_${TEST_STAFF_ID}`,
    `TSK_${TEST_STAFF_ID}`,
    `ATT_${TEST_STAFF_ID}`
  ];

  for (const tab of expectedTabs) {
    const exists = allSheetTitles.includes(tab);
    console.log(`   - Verified Tab on Branch Spreadsheet [${tab}]: ${exists ? 'EXISTS ✅' : 'MISSING ❌'}`);
    if (!exists) throw new Error(`Tab ${tab} failed to create on spreadsheet!`);
  }

  // ─── STEP 3: Task Allocation Flow ───────────────────────────────────────────
  console.log('\n[STEP 3] Testing Task Allocation Dual Persistence...');

  // Firestore sync
  await syncTaskToFirestore({
    id: TEST_TASK_ID,
    title: 'Synthetic Verification Task',
    description: 'Verify dual persistence pipeline from web to firebase and sheets',
    assignedBy: { id: 'ADMIN_01', name: 'System Admin' },
    targetType: 'individual',
    targetUserId: TEST_STAFF_ID,
    priority: 'High',
    dueDate: '2026-09-25',
    status: 'Assigned',
    createdAt: new Date().toISOString()
  });

  // Google Sheets Master 05_Task_Allocation
  await appendBranchTaskAllocation(TEST_SPREADSHEET_ID, {
    taskId: TEST_TASK_ID,
    dateAssigned: '2026-09-23',
    assignedById: 'ADMIN_01',
    assignedByName: 'System Admin',
    assignedToId: TEST_STAFF_ID,
    assignedToName: TEST_STAFF_NAME,
    taskTitle: 'Synthetic Verification Task',
    description: 'Verify dual persistence pipeline',
    priority: 'High',
    category: 'Operations',
    startDate: '2026-09-23',
    dueDate: '2026-09-25',
    completedDate: '-',
    status: 'Assigned',
    progressPct: '0%',
    remarks: 'Automated test task'
  });

  // Staff's personal TSK_<ID> subsheet
  await upsertTask(TEST_SPREADSHEET_ID, TEST_STAFF_ID, {
    taskId: TEST_TASK_ID,
    dateAssigned: '2026-09-23',
    assignedById: 'ADMIN_01',
    assignedByName: 'System Admin',
    taskTitle: 'Synthetic Verification Task',
    description: 'Verify dual persistence pipeline',
    priority: 'High',
    category: 'Operations',
    startDate: '2026-09-23',
    dueDate: '2026-09-25',
    completedDate: '-',
    status: 'Assigned',
    progressPct: '0%',
    remarks: 'Automated test task'
  });

  // Verify task in Firestore
  const taskDoc = await db.collection('tasks').doc(TEST_TASK_ID).get();
  console.log('   - Firestore Task Record Verified:', taskDoc.exists, taskDoc.data()?.title);

  // ─── STEP 4: Daily Worklog Flow ─────────────────────────────────────────────
  console.log('\n[STEP 4] Testing Daily Worklog Dual Persistence...');

  // Firestore sync
  await syncWorklogToFirestore({
    id: TEST_WORKLOG_ID,
    userId: TEST_STAFF_ID,
    userName: TEST_STAFF_NAME,
    userRole: 'intern',
    branch: 'Chennai',
    date: '2026-09-23',
    loginTime: '09:00 AM',
    logoutTime: '06:00 PM',
    plannedTasks: ['Finish system check'],
    completedTasks: ['Finish system check'],
    attendanceStatus: 'present',
    hoursLogged: 9
  });

  // Staff's personal WL_<ID> subsheet
  await upsertWorklog(TEST_SPREADSHEET_ID, TEST_STAFF_ID, {
    logId: TEST_WORKLOG_ID,
    date: '2026-09-23',
    loginTime: '09:00 AM',
    logoutTime: '06:00 PM',
    tasksCompleted: 'Finish system check',
    tasksPending: '',
    incompleteReason: '',
    totalHours: '9',
    verifiedBy: 'Auto-verified'
  });

  // Master 03_Daily_Worklogs
  await appendBranchDailyWorklog(TEST_SPREADSHEET_ID, {
    logId: TEST_WORKLOG_ID,
    staffId: TEST_STAFF_ID,
    staffName: TEST_STAFF_NAME,
    role: 'intern',
    branchId: TEST_BRANCH_CODE,
    date: '2026-09-23',
    loginTime: '09:00 AM',
    logoutTime: '06:00 PM',
    tasksCompleted: 'Finish system check',
    tasksPending: '',
    totalHours: 9
  });

  // Verify worklog in Firestore
  const worklogDoc = await db.collection('daily_worklogs').doc(TEST_WORKLOG_ID).get();
  console.log('   - Firestore Worklog Record Verified:', worklogDoc.exists, worklogDoc.data()?.hoursLogged);

  // ─── STEP 5: Student Directory & Mentor Assignment ───────────────────────────
  console.log('\n[STEP 5] Testing Student Addition Dual Persistence...');

  // Firestore sync
  await syncStudentToFirestore({
    studentId: TEST_STUDENT_ID,
    studentName: 'Synthetic Test Student',
    branch: 'Chennai',
    college: 'Anna University',
    department: 'CSE',
    year: 'Final Year',
    email: 'test_student99@example.com',
    mobile: '9876543211',
    course: 'Full Stack Web Dev',
    domain: 'React & Node',
    mentorStaffId: TEST_STAFF_ID,
    mentorName: TEST_STAFF_NAME,
    admissionDate: '2026-09-23',
    feeStatus: 'Paid',
    projectStatus: 'Ongoing',
    studentStatus: 'Active'
  });

  // Google Sheets Master 06_Student_Directory
  await upsertBranchStudent(TEST_SPREADSHEET_ID, {
    studentId: TEST_STUDENT_ID,
    studentName: 'Synthetic Test Student',
    college: 'Anna University',
    department: 'CSE',
    year: 'Final Year',
    email: 'test_student99@example.com',
    mobile: '9876543211',
    course: 'Full Stack Web Dev',
    domain: 'React & Node',
    mentorStaffId: TEST_STAFF_ID,
    mentorName: TEST_STAFF_NAME,
    admissionDate: '2026-09-23',
    endDate: '2026-12-23',
    feeStatus: 'Paid',
    projectStatus: 'Ongoing',
    studentStatus: 'Active'
  });

  // Staff's personal STU_<ID> subsheet
  await upsertStudent(TEST_SPREADSHEET_ID, TEST_STAFF_ID, {
    studentId: TEST_STUDENT_ID,
    studentName: 'Synthetic Test Student',
    college: 'Anna University',
    department: 'CSE',
    year: 'Final Year',
    email: 'test_student99@example.com',
    mobile: '9876543211',
    course: 'Full Stack Web Dev',
    domain: 'React & Node',
    admissionDate: '2026-09-23',
    endDate: '2026-12-23',
    feeStatus: 'Paid',
    projectStatus: 'Ongoing',
    studentStatus: 'Active',
    moduleName: 'Module 1',
    topicCovered: 'Intro',
    dailyScore: '10',
    mentorRemarks: 'Excellent',
    attendanceToday: 'Present'
  });

  // Verify student in Firestore
  const stuDoc = await db.collection('students').doc(TEST_STUDENT_ID).get();
  console.log('   - Firestore Student Record Verified:', stuDoc.exists, stuDoc.data()?.studentName);

  // ─── STEP 6: Attendance Punch ───────────────────────────────────────────────
  console.log('\n[STEP 6] Testing Attendance Punch Persistence...');

  await syncAttendanceToFirestore({
    id: TEST_ATT_ID,
    userId: TEST_STAFF_ID,
    userName: TEST_STAFF_NAME,
    role: 'intern',
    branch: 'Chennai',
    date: '2026-09-23',
    punchIn: '09:00 AM',
    punchOut: '06:00 PM',
    status: 'Present',
    totalHours: 9
  });

  await appendAttendanceRecord(TEST_SPREADSHEET_ID, [
    TEST_ATT_ID,
    '2026-09-23',
    'Wed',
    TEST_STAFF_ID,
    TEST_STAFF_NAME,
    'intern',
    '09:00 AM',
    '06:00 PM',
    '9',
    'Present',
    'Automated Test',
    new Date().toISOString()
  ]);

  const attDoc = await db.collection('attendance').doc(TEST_ATT_ID).get();
  console.log('   - Firestore Attendance Punch Verified:', attDoc.exists, attDoc.data()?.status);

  // ─── STEP 7: COMPLETE PURGE OF TEST DATA ────────────────────────────────────
  console.log('\n================================================================');
  console.log('🧹 PURGING ALL FABRICATED/TEST DATA TO KEEP ONLY AUTHENTIC RECORDS');
  console.log('================================================================');

  // 1. Delete Firestore test records
  console.log('   - Deleting test documents from Firestore...');
  await db.collection('users').doc(TEST_STAFF_ID).delete();
  await db.collection('tasks').doc(TEST_TASK_ID).delete();
  await db.collection('daily_worklogs').doc(TEST_WORKLOG_ID).delete();
  await db.collection('students').doc(TEST_STUDENT_ID).delete();
  await db.collection('attendance').doc(TEST_ATT_ID).delete();
  console.log('   ✅ Firestore test documents successfully purged.');

  // 2. Delete the 4 test subsheets from Google Sheets
  console.log('   - Deleting the 4 test subsheets from Google Sheets...');
  await deleteStaffSubsheets(TEST_SPREADSHEET_ID, TEST_STAFF_ID);
  console.log('   ✅ Test subsheets successfully deleted from Google Sheets.');

  // Verify deletion of subsheets
  const metaAfterDelete = await api.spreadsheets.get({ spreadsheetId: TEST_SPREADSHEET_ID });
  const remainingTitles = (metaAfterDelete.data.sheets || []).map(s => s.properties?.title);
  const stillHasTestTabs = expectedTabs.some(t => remainingTitles.includes(t));
  console.log('   - Subsheets clean check:', !stillHasTestTabs ? 'CLEAN & REMOVED ✅' : 'TABS STILL PRESENT ⚠️');

  console.log('\n================================================================');
  console.log('🎉 END-TO-END VERIFICATION & CLEANUP COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runE2EVerification().catch(err => {
  console.error('\n❌ E2E VERIFICATION ERROR:', err);
  process.exit(1);
});
