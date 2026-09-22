/**
 * Setup Branch Student Directory (06_Student_Directory)
 * Delete redundant 07_Student_Progress
 * Setup ATT_CBE_ADM01 with Multi-Month Vertical Stacking (4-Row Gap)
 * and End-Date Lifecycle Rollover Filtering.
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, '..', 'management-system-509313-306faa5b0c5e.json');
const CBE_SPREADSHEET_ID = '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA';
const STAFF_ID = 'CBE_ADM01';

function getWorkingDays(year, month) {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalDays = new Date(year, month, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month - 1, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const yyyy = year;
      const mm = String(month).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push({ date: `${yyyy}-${mm}-${dd}`, day: dayNames[dayOfWeek] });
    }
  }
  return days;
}

const SEP_WORKING_DAYS = getWorkingDays(2026, 9);
const OCT_WORKING_DAYS = getWorkingDays(2026, 10);

async function main() {
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('🚀 Step 1: Check and delete 07_Student_Progress sheet if present...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: CBE_SPREADSHEET_ID });
  const s7 = meta.data.sheets.find(s => s.properties.title === '07_Student_Progress');
  if (s7) {
    console.log(`   Deleting sheet 07_Student_Progress (sheetId: ${s7.properties.sheetId})...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: CBE_SPREADSHEET_ID,
      requestBody: {
        requests: [
          { deleteSheet: { sheetId: s7.properties.sheetId } }
        ]
      }
    });
    console.log('   ✅ 07_Student_Progress deleted.');
  } else {
    console.log('   ℹ️ 07_Student_Progress not found or already deleted.');
  }

  console.log('\n🚀 Step 2: Populate 06_Student_Directory with all branch students & mentors...');
  const branchStudentsHeader = [
    'Student_ID', 'Student_Name', 'College', 'Department', 'Year',
    'Email', 'Mobile', 'Course', 'Domain',
    'Mentor_Staff_ID', 'Mentor_Name',
    'Admission_Date', 'End_Date', 'Fee_Status', 'Project_Status', 'Student_Status'
  ];

  const branchStudentsRows = [
    branchStudentsHeader,
    [
      'STU_CBE_ADM_001', 'Rithanya M', 'Kumaraguru College of Technology (KCT)', 'Information Technology', 'Final Year',
      'rithanya.kct@gmail.com', '9842109876', 'Enterprise Cloud & Full Stack Internship', 'Cloud & DevOps Engineering',
      'CBE_ADM01', 'Rajesh Kumar',
      '22-09-2026', '22-12-2026', 'Paid', 'Ongoing', 'Active'
    ],
    [
      'STU_CBE_ADM_002', 'Kavitha S', 'PSG College of Technology', 'Computer Science', '4th Year',
      'kavitha.psg@gmail.com', '9842112345', 'Web Architecture Internship', 'Frontend & UI Engineering',
      'CBE_ADM01', 'Rajesh Kumar',
      '20-08-2026', '20-09-2026', 'Paid', 'Completed', 'Completed'
    ],
    [
      'STU_CBE_EMP_001', 'Thirumala', 'Coimbatore Institute of Technology (CIT)', 'Computer Science', '4th Year',
      'thirumala.cit@gmail.com', '9842198765', 'Full Stack Python Development', 'Python Full Stack',
      'CBE_EMP01', 'Ananya Sharma',
      '01-09-2026', '30-11-2026', 'Paid', 'Ongoing', 'Active'
    ],
    [
      'STU_CBE_EMP_002', 'Venkata Koushik', 'Amrita Vishwa Vidyapeetham', 'Artificial Intelligence & Data Science', '3rd Year',
      'koushik.amrita@gmail.com', '9842154321', 'Cloud Data Science & ML', 'Data Science & Cloud',
      'CBE_EMP01', 'Ananya Sharma',
      '07-09-2026', '07-12-2026', 'Paid', 'Ongoing', 'Active'
    ],
    [
      'STU_CBE_EMP_003', 'Ahalya', 'Government College of Technology (GCT)', 'Electronics & Communication', 'Final Year',
      'ahalya.gct@gmail.com', '9842167890', 'Applied Generative AI', 'Gen AI & AIML',
      'CBE_EMP01', 'Ananya Sharma',
      '01-09-2026', '30-11-2026', 'Paid', 'Ongoing', 'Active'
    ],
    [
      'STU_CBE_EMP_004', 'Sneha', 'Sri Krishna College of Engineering (SKCET)', 'Information Technology', '4th Year',
      'sneha.skcet@gmail.com', '9842145678', 'Full Stack Web Development', 'Full Stack Web (MERN)',
      'CBE_EMP01', 'Ananya Sharma',
      '01-09-2026', '30-11-2026', 'Paid', 'Ongoing', 'Active'
    ]
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: "'06_Student_Directory'!A1:P7",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: branchStudentsRows }
  });
  console.log('   ✅ 06_Student_Directory populated with 6 branch students.');

  console.log('\n🚀 Step 3: Construct Multi-Month Stacking in ATT_CBE_ADM01 with 4-row gap...');
  
  function colLetter(n) {
    let r = '';
    while (n > 0) {
      n--;
      r = String.fromCharCode(65 + (n % 26)) + r;
      n = Math.floor(n / 26);
    }
    return r;
  }

  // Helper to build a monthly block
  function buildMonthBlock(monthTitle, subTitle, workingDays, studentsList, startRowOffset) {
    const totalCols = 2 + workingDays.length + 5;
    const blockRows = [];

    // Row 1: Banner
    const r1 = Array(totalCols).fill('');
    r1[0] = monthTitle;
    blockRows.push(r1);

    // Row 2: Sub-banner
    const r2 = Array(totalCols).fill('');
    r2[0] = subTitle;
    blockRows.push(r2);

    // Row 3: Header 1
    blockRows.push([
      'Intern Name',
      'Tracking Metric',
      ...workingDays.map(w => w.date),
      'Total Present',
      'Total Absent',
      'Attendance %',
      'Tasks Completed',
      'Completion %'
    ]);

    // Row 4: Header 2
    blockRows.push([
      'Domain / Track & Tenure',
      'Daily Log Type',
      ...workingDays.map(w => w.day),
      'Summary',
      'Summary',
      'Rate %',
      'Summary',
      'Rate %'
    ]);

    const lastColLet = colLetter(totalCols);
    const dayColStart = 3; // Col C
    const dayColEnd = 2 + workingDays.length; // Col X for 22 days
    const colC = colLetter(dayColStart);
    const colLastDay = colLetter(dayColEnd);
    const colTotPres = colLetter(dayColEnd + 1); // Col Y
    const colTotAbs = colLetter(dayColEnd + 2);  // Col Z
    const colAttPct = colLetter(dayColEnd + 3);  // Col AA
    const colTskComp = colLetter(dayColEnd + 4); // Col AB
    const colCompPct = colLetter(dayColEnd + 5); // Col AC

    studentsList.forEach((s, idx) => {
      const rAtt = startRowOffset + 5 + idx * 2;
      const rTsk = startRowOffset + 6 + idx * 2;

      const attRow = [
        s.name,
        'Attendance',
        ...s.attendance,
        `=COUNTIF(${colC}${rAtt}:${colLastDay}${rAtt}, "Present")`,
        `=COUNTIF(${colC}${rAtt}:${colLastDay}${rAtt}, "Absent")`,
        `=IF(${colTotPres}${rAtt}+${colTotAbs}${rAtt}>0, ROUND(${colTotPres}${rAtt}/(${colTotPres}${rAtt}+${colTotAbs}${rAtt})*100, 1) & "%", "100%")`,
        '',
        ''
      ];
      blockRows.push(attRow);

      const tskRow = [
        `${s.domain} [${s.startDate} → ${s.endDate}]`,
        'Task Completion',
        ...s.tasks,
        '',
        '',
        '',
        `=COUNTIF(${colC}${rTsk}:${colLastDay}${rTsk}, "Completed")`,
        `=IF(COUNTIF(${colC}${rTsk}:${colLastDay}${rTsk}, "Completed")+COUNTIF(${colC}${rTsk}:${colLastDay}${rTsk}, "Not Completed")>0, ROUND(${colTskComp}${rTsk}/(COUNTIF(${colC}${rTsk}:${colLastDay}${rTsk}, "Completed")+COUNTIF(${colC}${rTsk}:${colLastDay}${rTsk}, "Not Completed"))*100, 1) & "%", "100%")`
      ];
      blockRows.push(tskRow);
    });

    const studentCount = studentsList.length;
    const firstStuRow = startRowOffset + 5;
    const lastStuRow = startRowOffset + 4 + studentCount * 2;

    const dailyPresentRow = [
      'Daily Total Present',
      'Cohort Attendance',
      ...workingDays.map((_, i) => {
        const c = colLetter(i + 3);
        return `=COUNTIF(${c}${firstStuRow}:${c}${lastStuRow}, "Present")`;
      }),
      studentsList.map((_, i) => `${colTotPres}${firstStuRow + i * 2}`).join('+') ? `=${studentsList.map((_, i) => `${colTotPres}${firstStuRow + i * 2}`).join('+')}` : '',
      studentsList.map((_, i) => `${colTotAbs}${firstStuRow + i * 2}`).join('+') ? `=${studentsList.map((_, i) => `${colTotAbs}${firstStuRow + i * 2}`).join('+')}` : '',
      '',
      '',
      ''
    ];
    blockRows.push(dailyPresentRow);

    const dailyTasksRow = [
      'Daily Tasks Completed',
      'Cohort Tasks',
      ...workingDays.map((_, i) => {
        const c = colLetter(i + 3);
        return `=COUNTIF(${c}${firstStuRow}:${c}${lastStuRow}, "Completed")`;
      }),
      '',
      '',
      '',
      studentsList.map((_, i) => `${colTskComp}${firstStuRow + 1 + i * 2}`).join('+') ? `=${studentsList.map((_, i) => `${colTskComp}${firstStuRow + 1 + i * 2}`).join('+')}` : '',
      ''
    ];
    blockRows.push(dailyTasksRow);

    return blockRows;
  }

  // 1. September Students (includes Kavitha S who completed on 20-09-2026)
  const rithanyaSepAtt = Array(22).fill('');
  const rithanyaSepTsk = Array(22).fill('');
  for (let i = 0; i < 15; i++) {
    rithanyaSepAtt[i] = 'Not Joined';
    rithanyaSepTsk[i] = 'Not Joined';
  }
  rithanyaSepAtt[15] = 'Present'; // 2026-09-22
  rithanyaSepTsk[15] = 'Completed';

  // Kavitha S attended all 14 working days up to Sept 18 (ended Sept 20)
  const kavithaSepAtt = Array(22).fill('');
  const kavithaSepTsk = Array(22).fill('');
  for (let i = 0; i < 14; i++) {
    kavithaSepAtt[i] = 'Present';
    kavithaSepTsk[i] = 'Completed';
  }
  for (let i = 14; i < 22; i++) {
    kavithaSepAtt[i] = 'Course Completed';
    kavithaSepTsk[i] = 'Course Completed';
  }

  const sepStudents = [
    {
      name: 'Rithanya M',
      domain: 'Cloud & DevOps Engineering',
      startDate: '2026-09-22',
      endDate: '2026-12-22',
      attendance: rithanyaSepAtt,
      tasks: rithanyaSepTsk
    },
    {
      name: 'Kavitha S',
      domain: 'Frontend & UI Engineering',
      startDate: '2026-08-20',
      endDate: '2026-09-20', // COMPLETED IN SEPT!
      attendance: kavithaSepAtt,
      tasks: kavithaSepTsk
    },
    {
      name: 'Thirumala',
      domain: 'Python Full Stack',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      attendance: Array(22).fill('Present'),
      tasks: Array(22).fill('Completed')
    },
    {
      name: 'Venkata Koushik',
      domain: 'Data Science & Cloud',
      startDate: '2026-09-07',
      endDate: '2026-12-07',
      attendance: ['Not Joined', 'Not Joined', 'Not Joined', 'Not Joined', ...Array(18).fill('Present')],
      tasks: ['Not Joined', 'Not Joined', 'Not Joined', 'Not Joined', ...Array(18).fill('Completed')]
    }
  ];

  const sepBlock = buildMonthBlock(
    'MONTHLY ATTENDANCE & TASK TRACKER — SEPTEMBER 2026',
    'Cohort: Q3-Q4 2026 | Mon-Fri Tracking | Dropdown Validation',
    SEP_WORKING_DAYS,
    sepStudents,
    0 // starts at row 1
  );

  console.log(`   September Block generated: ${sepBlock.length} rows (Rows 1 to ${sepBlock.length})`);

  // 2. Gap of exactly 4 rows
  const gapRows = [
    Array(29).fill(''),
    Array(29).fill(''),
    Array(29).fill(''),
    Array(29).fill('')
  ];
  const octStartOffset = sepBlock.length + 4;
  console.log(`   4-Row Gap inserted: Rows ${sepBlock.length + 1} to ${octStartOffset}`);
  console.log(`   October Block starts at row ${octStartOffset + 1}`);

  // 3. October Students (LIFECYCLE FILTER: Kavitha S is omitted because endDate was 20-09-2026!)
  // Rithanya M is active (ends 22-12-2026)
  // Thirumala is active (ends 30-11-2026)
  // Venkata Koushik is active (ends 07-12-2026)
  const octStudents = [
    {
      name: 'Rithanya M',
      domain: 'Cloud & DevOps Engineering',
      startDate: '2026-09-22',
      endDate: '2026-12-22', // ACTIVE!
      attendance: Array(22).fill(''), // October is future/fresh
      tasks: Array(22).fill('')
    },
    {
      name: 'Thirumala',
      domain: 'Python Full Stack',
      startDate: '2026-09-01',
      endDate: '2026-11-30', // ACTIVE!
      attendance: Array(22).fill(''),
      tasks: Array(22).fill('')
    },
    {
      name: 'Venkata Koushik',
      domain: 'Data Science & Cloud',
      startDate: '2026-09-07',
      endDate: '2026-12-07', // ACTIVE!
      attendance: Array(22).fill(''),
      tasks: Array(22).fill('')
    }
  ];

  const octBlock = buildMonthBlock(
    'MONTHLY ATTENDANCE & TASK TRACKER — OCTOBER 2026',
    'Cohort: Q4 2026 | Mon-Fri Tracking | Rolling Monthly Lifecycle',
    OCT_WORKING_DAYS,
    octStudents,
    octStartOffset
  );

  console.log(`   October Block generated: ${octBlock.length} rows (Rows ${octStartOffset + 1} to ${octStartOffset + octBlock.length})`);
  console.log(`   Notice: Kavitha S is NOT in October (End Date: 20-09-2026)!`);
  console.log(`   Notice: Rithanya M IS in October (End Date: 22-12-2026, 3-month duration)!`);

  const fullSheetRows = [
    ...sepBlock,
    ...gapRows,
    ...octBlock
  ];

  console.log(`\n📝 Writing entire stacked matrix to ATT_CBE_ADM01 (${fullSheetRows.length} rows)...`);
  
  // Clear any leftover rows first
  await sheets.spreadsheets.values.clear({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: `'ATT_${STAFF_ID}'!A1:AC100`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: `'ATT_${STAFF_ID}'!A1:AC${fullSheetRows.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: fullSheetRows }
  });

  console.log('🎉 SUCCESS: ATT_CBE_ADM01 updated with September + 4-row gap + October!');
}

main().catch(err => {
  console.error('❌ Setup error:', err);
  process.exit(1);
});
