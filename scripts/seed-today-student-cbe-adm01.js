/**
 * Seed a student joining today (2026-09-22) with a 3-month duration on CBE_ADM01.
 * 
 * Target:
 * 1. STU_CBE_ADM01 — Student Directory (19 columns)
 * 2. ATT_CBE_ADM01 — Monthly Attendance & Task Tracker Matrix (29 columns)
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, '..', 'management-system-509313-306faa5b0c5e.json');
const CBE_SPREADSHEET_ID = '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA';
const STAFF_ID = 'CBE_ADM01';

const WORKING_DAYS_SEP_2026 = [
  '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
  '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
  '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
  '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
  '2026-09-28', '2026-09-29', '2026-09-30'
];

async function main() {
  console.log('🚀 Seeding new student joining today (22-09-2026) with 3 months duration for CBE_ADM01...');

  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Check or write to STU_CBE_ADM01
  const studentData = [
    'STU_CBE_ADM_001',
    'Rithanya M',
    'Kumaraguru College of Technology (KCT)',
    'Information Technology',
    'Final Year',
    'rithanya.kct@gmail.com',
    '9842109876',
    'Enterprise Cloud & Full Stack Internship',
    'Cloud & DevOps Engineering',
    '22-09-2026',
    '22-12-2026',
    'Paid',
    'Ongoing',
    'Active',
    'Cloud Onboarding & Git Architecture',
    'Workstation Setup, CI/CD Pipelines & Team Workflow Orientation',
    '10',
    'Joined today (22-09-2026) on a 3-month internship. Workstation setup verified, Git configured, onboarding completed.',
    'Present'
  ];

  console.log('📝 Writing student to STU_CBE_ADM01...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: `'STU_${STAFF_ID}'!A2:S2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [studentData]
    }
  });
  console.log('✅ Student Rithanya M saved to STU_CBE_ADM01');

  // 2. Build ATT_CBE_ADM01 Tracker Matrix with this student + sample cohort
  // Days 0-14 (Sept 1-21) are "Not Joined"
  // Day 15 (Sept 22) is "Present" (attendance) and "Completed" (task)
  // Days 16-21 (Sept 23-30) are pending ""
  const rithanyaAttendance = Array(22).fill('');
  const rithanyaTasks = Array(22).fill('');

  for (let i = 0; i < 15; i++) {
    rithanyaAttendance[i] = 'Not Joined';
    rithanyaTasks[i] = 'Not Joined';
  }
  rithanyaAttendance[15] = 'Present'; // 2026-09-22 TODAY!
  rithanyaTasks[15] = 'Completed';    // 2026-09-22 TODAY!

  // Also include the other 3 sample students so CBE_ADM01 has a rich cohort:
  const cohort = [
    {
      name: 'Rithanya M',
      domain: 'Cloud & DevOps Engineering',
      startDate: '2026-09-22',
      endDate: '2026-12-22',
      attendance: rithanyaAttendance,
      tasks: rithanyaTasks
    },
    {
      name: 'Thirumala',
      domain: 'Python Full Stack',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      attendance: ['Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present'],
      tasks: ['Completed', 'Completed', 'Completed', 'Not Completed', 'Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Holiday', 'Not Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed']
    },
    {
      name: 'Venkata Koushik',
      domain: 'Data Science & Cloud',
      startDate: '2026-09-07',
      endDate: '2026-12-07',
      attendance: ['Not Joined', 'Not Joined', 'Not Joined', 'Not Joined', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present'],
      tasks: ['Not Joined', 'Not Joined', 'Not Joined', 'Not Joined', 'Not Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed']
    }
  ];

  const totalCols = 29;
  const rows = [];

  // Row 1: Banner
  const row1 = Array(totalCols).fill('');
  row1[0] = 'MONTHLY ATTENDANCE & TASK TRACKER — SEPTEMBER 2026';
  rows.push(row1);

  // Row 2: Sub-banner
  const row2 = Array(totalCols).fill('');
  row2[0] = 'Cohort: Q3-Q4 2026 | Mon-Fri Tracking | Dropdown Validation';
  rows.push(row2);

  // Row 3: Header 1
  rows.push([
    'Intern Name',
    'Tracking Metric',
    ...WORKING_DAYS_SEP_2026,
    'Total Present',
    'Total Absent',
    'Attendance %',
    'Tasks Completed',
    'Completion %'
  ]);

  // Row 4: Header 2
  const dayNames = ['Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed'];
  rows.push([
    'Domain / Track & Tenure',
    'Daily Log Type',
    ...dayNames,
    'Summary',
    'Summary',
    'Rate %',
    'Summary',
    'Rate %'
  ]);

  cohort.forEach((s, idx) => {
    const rAtt = 5 + idx * 2;
    const rTsk = 6 + idx * 2;

    const attRow = [
      s.name,
      'Attendance',
      ...s.attendance,
      `=COUNTIF(C${rAtt}:X${rAtt}, "Present")`,
      `=COUNTIF(C${rAtt}:X${rAtt}, "Absent")`,
      `=IF(Y${rAtt}+Z${rAtt}>0, ROUND(Y${rAtt}/(Y${rAtt}+Z${rAtt})*100, 1) & "%", "100%")`,
      '',
      ''
    ];
    rows.push(attRow);

    const tskRow = [
      `${s.domain} [${s.startDate} → ${s.endDate}]`,
      'Task Completion',
      ...s.tasks,
      '',
      '',
      '',
      `=COUNTIF(C${rTsk}:X${rTsk}, "Completed")`,
      `=IF(COUNTIF(C${rTsk}:X${rTsk}, "<>Not Joined")>0, ROUND(AB${rTsk}/COUNTIF(C${rTsk}:X${rTsk}, "<>Not Joined")*100, 1) & "%", "0%")`
    ];
    rows.push(tskRow);
  });

  const studentCount = cohort.length;
  const lastStudentRow = 4 + studentCount * 2;

  function colLetter(n) {
    let r = '';
    while (n > 0) {
      n--;
      r = String.fromCharCode(65 + (n % 26)) + r;
      n = Math.floor(n / 26);
    }
    return r;
  }

  const dailyPresentRow = [
    'Daily Total Present',
    'Cohort Attendance',
    ...WORKING_DAYS_SEP_2026.map((_, i) => {
      const c = colLetter(i + 3);
      return `=COUNTIF(${c}5:${c}${lastStudentRow}, "Present")`;
    }),
    cohort.map((_, i) => `Y${5 + i * 2}`).join('+') ? `=${cohort.map((_, i) => `Y${5 + i * 2}`).join('+')}` : '',
    cohort.map((_, i) => `Z${5 + i * 2}`).join('+') ? `=${cohort.map((_, i) => `Z${5 + i * 2}`).join('+')}` : '',
    '',
    '',
    ''
  ];
  rows.push(dailyPresentRow);

  const dailyTasksRow = [
    'Daily Tasks Completed',
    'Cohort Tasks',
    ...WORKING_DAYS_SEP_2026.map((_, i) => {
      const c = colLetter(i + 3);
      return `=COUNTIF(${c}5:${c}${lastStudentRow}, "Completed")`;
    }),
    '',
    '',
    '',
    cohort.map((_, i) => `AB${6 + i * 2}`).join('+') ? `=${cohort.map((_, i) => `AB${6 + i * 2}`).join('+')}` : '',
    ''
  ];
  rows.push(dailyTasksRow);

  console.log('📝 Writing updated matrix to ATT_CBE_ADM01...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: `'ATT_${STAFF_ID}'!A1:AC${rows.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows }
  });

  console.log('🎉 SUCCESS: Seeded student Rithanya M (Join date: 22-09-2026, 3 Months duration) to both STU_CBE_ADM01 and ATT_CBE_ADM01!');
  console.log('   Attendance prior to 22-09-2026 is marked as "Not Joined".');
  console.log('   Today (22-09-2026) is marked as "Present" with Task "Completed".');
  console.log('   Attendance rate is 100% (1/1 active days).');
}

main().catch(err => {
  console.error('❌ Error seeding student:', err);
  process.exit(1);
});
