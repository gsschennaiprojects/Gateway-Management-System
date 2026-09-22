/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — ENTERPRISE BRANCH INITIALIZER v4.0
 * Hybrid Architecture: 4 Common Sheets + Per-Employee Sub-Sheets
 * ============================================================================
 * 
 * Architecture:
 *   Common Sheets (1 per branch, shared across all staff):
 *     02_Staff_Directory    — Master employee roster
 *     04_Staff_Attendance   — Daily attendance log (all staff)
 *     08_Candidate_Leads    — HR leads pipeline
 *     09_System_Audit_Log   — System audit trail
 * 
 *   Per-Employee Sub-Sheets (created dynamically per staff member):
 *     WL_{Staff_ID}   — Daily worklogs for this employee
 *     STU_{Staff_ID}  — Students assigned to this employee (directory + attendance + program)
 *     TSK_{Staff_ID}  — Tasks allocated to/by this employee
 * 
 * Usage:
 *   node initialize-branches.js                    # Initialize all branches
 *   node initialize-branches.js --branch CBE       # Single branch
 *   node initialize-branches.js --branch CBE,MDU   # Multiple branches
 *   node initialize-branches.js --sync             # Non-destructive: add missing employee tabs only
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, 'management-system-509313-306faa5b0c5e.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// ─── CLI Arguments ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let targetBranchCodes = null;
const branchIdx = args.indexOf('--branch');
if (branchIdx !== -1 && args[branchIdx + 1]) {
  targetBranchCodes = args[branchIdx + 1].split(',').map(s => s.trim().toUpperCase());
}
const syncMode = args.includes('--sync'); // Non-destructive mode: only add missing tabs

// ─── Branch Definitions ────────────────────────────────────────────────────────

const BRANCHES = [
  { id: 'BR_CHN_01', code: 'CHN', name: 'Gateway Chennai Branch', location: 'Chennai, Tamil Nadu', spreadsheetId: '1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY' },
  { id: 'BR_CBE_02', code: 'CBE', name: 'Gateway Coimbatore Branch', location: 'Coimbatore, Tamil Nadu', spreadsheetId: '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA' },
  { id: 'BR_MDU_03', code: 'MDU', name: 'Gateway Madurai Branch', location: 'Madurai, Tamil Nadu', spreadsheetId: '1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8' },
  { id: 'BR_ERD_04', code: 'ERD', name: 'Gateway Erode Branch', location: 'Erode, Tamil Nadu', spreadsheetId: '1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY' },
];

// ─── Colors ────────────────────────────────────────────────────────────────────

const COLORS = {
  PRIMARY_BG:     { red: 0.102, green: 0.451, blue: 0.910 }, // #1A73E8 Royal Blue
  PRIMARY_TEXT:   { red: 1.0,   green: 1.0,   blue: 1.0   },
  SUCCESS:        { red: 0.204, green: 0.659, blue: 0.325 }, // #34A853 Green
  WARNING:        { red: 0.984, green: 0.737, blue: 0.020 }, // #FBBC05 Amber
  DANGER:         { red: 0.914, green: 0.263, blue: 0.208 }, // #EA4335 Red
  PURPLE:         { red: 0.416, green: 0.306, blue: 0.745 }, // #6A4EBE
  TEAL:           { red: 0.000, green: 0.737, blue: 0.831 }, // #00BCD4
  SLATE:          { red: 0.350, green: 0.400, blue: 0.450 }, // #596673
  WL_TAB:         { red: 0.122, green: 0.467, blue: 0.706 }, // #1F77B4 Blue
  STU_TAB:        { red: 1.000, green: 0.498, blue: 0.055 }, // #FF7F0E Orange
  TSK_TAB:        { red: 0.173, green: 0.627, blue: 0.173 }, // #2CA02C Green
  NAVY_HEADER:    { red: 0.106, green: 0.212, blue: 0.365 }, // #1B365D Dark Navy
  NAVY_SUBHEADER: { red: 0.141, green: 0.259, blue: 0.435 }, // #24426E
  PRESENT_BG:     { red: 0.902, green: 0.957, blue: 0.918 }, // #E6F4EA
  PRESENT_TEXT:   { red: 0.075, green: 0.451, blue: 0.200 }, // #137333
  ABSENT_BG:      { red: 0.988, green: 0.910, blue: 0.902 }, // #FCE8E6
  ABSENT_TEXT:    { red: 0.773, green: 0.133, blue: 0.122 }, // #C5221F
  HOLIDAY_BG:     { red: 0.996, green: 0.969, blue: 0.878 }, // #FEF7E0
  HOLIDAY_TEXT:   { red: 0.690, green: 0.376, blue: 0.000 }, // #B06000
  IN_PROGRESS_BG: { red: 0.910, green: 0.941, blue: 0.996 }, // #E8F0FE
  IN_PROGRESS_TEXT: { red: 0.102, green: 0.451, blue: 0.910 }, // #1A73E8
  SUMMARY_BG:     { red: 0.945, green: 0.961, blue: 0.976 }, // #F1F5F9
};

// ─── Common Sheet Definitions ──────────────────────────────────────────────────

function getCommonSheetDefinitions() {
  return [
    {
      title: '02_Staff_Directory',
      tabColor: COLORS.SUCCESS,
      headers: [
        'Staff_ID', 'Full_Name', 'Role', 'Designation', 'Department',
        'Email', 'Mobile', 'Joining_Date', 'Reporting_Manager',
        'Account_Status', 'Firebase_UID', 'Updated_At'
      ],
      validations: [
        { col: 2, values: ['SUPER_ADMIN', 'ADMIN', 'HR', 'EMPLOYEE', 'INTERN'] },
        { col: 9, values: ['Pending Approval', 'Active', 'Suspended', 'Rejected'] }
      ]
    },
    {
      title: '04_Staff_Attendance',
      tabColor: COLORS.TEAL,
      headers: [
        'Attendance_ID', 'Date', 'Day', 'Staff_ID', 'Staff_Name', 'Role',
        'Check_In', 'Check_Out', 'Total_Hours', 'Status', 'Marked_By', 'Timestamp'
      ],
      validations: [
        { col: 5, values: ['ADMIN', 'HR', 'EMPLOYEE', 'INTERN'] },
        { col: 9, values: ['Present', 'Absent', 'Half-Day', 'On Leave', 'Holiday'] }
      ]
    },
    {
      title: '08_Candidate_Leads',
      tabColor: COLORS.TEAL,
      headers: [
        'Lead_ID', 'Date_Received', 'Candidate_Name', 'Email', 'Mobile',
        'City', 'Course_Interested', 'Source', 'Assigned_HR_ID',
        'Lead_Status', 'Remarks', 'Dedupe_Key'
      ],
      validations: [
        { col: 9, values: ['New', 'Contacted', 'Interested', 'Not Interested', 'Enrolled', 'Rejected'] }
      ]
    },
    {
      title: '09_System_Audit_Log',
      tabColor: COLORS.DANGER,
      headers: [
        'Audit_ID', 'Timestamp', 'Actor_UID', 'Actor_Name', 'Actor_Role',
        'Action', 'Target_Module', 'Record_ID', 'Old_Value', 'New_Value'
      ],
      validations: [
        { col: 4, values: ['SUPER_ADMIN', 'ADMIN', 'HR', 'EMPLOYEE', 'SYSTEM'] }
      ]
    }
  ];
}

// ─── Per-Employee Sheet Templates ──────────────────────────────────────────────

/**
 * Returns the 3 per-employee sheet definitions for a given staff member.
 */
function getEmployeeSheetDefinitions(staffId) {
  return [
    {
      title: `WL_${staffId}`,
      tabColor: COLORS.WL_TAB,
      headers: [
        'Log_ID', 'Date', 'Login_Time', 'Logout_Time',
        'Tasks_Completed', 'Tasks_Pending', 'Incomplete_Reason',
        'Total_Hours', 'Verified_By'
      ],
      validations: []
    },
    {
      title: `STU_${staffId}`,
      tabColor: COLORS.STU_TAB,
      headers: [
        'Student_ID', 'Student_Name', 'College', 'Department', 'Year',
        'Email', 'Mobile', 'Course', 'Domain', 'Admission_Date',
        'End_Date', 'Fee_Status', 'Project_Status', 'Student_Status',
        'Module_Name', 'Topic_Covered', 'Daily_Score', 'Mentor_Remarks',
        'Attendance_Today'
      ],
      validations: [
        { col: 11, values: ['Paid', 'Partial', 'Pending'] },
        { col: 12, values: ['Not Started', 'Ongoing', 'Under Review', 'Completed'] },
        { col: 13, values: ['Active', 'Completed', 'Discontinued'] },
        { col: 16, values: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'] },
        { col: 18, values: ['Present', 'Absent', 'Holiday'] }
      ]
    },
    {
      title: `TSK_${staffId}`,
      tabColor: COLORS.TSK_TAB,
      headers: [
        'Task_ID', 'Date_Assigned', 'Assigned_By_ID', 'Assigned_By_Name',
        'Task_Title', 'Description', 'Priority', 'Category',
        'Start_Date', 'Due_Date', 'Completed_Date', 'Status',
        'Progress_Pct', 'Remarks'
      ],
      validations: [
        { col: 6, values: ['Low', 'Medium', 'High', 'Urgent'] },
        { col: 7, values: ['Project', 'Admin', 'Training', 'Support'] },
        { col: 11, values: ['Assigned', 'On Progress', 'Completed', 'Partially Stopped'] }
      ]
    },
    {
      title: `ATT_${staffId}`,
      tabColor: COLORS.NAVY_HEADER,
      isAttendanceTracker: true
    }
  ];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function colLetter(n) {
  let r = '';
  while (n > 0) {
    n--;
    r = String.fromCharCode(65 + (n % 26)) + r;
    n = Math.floor(n / 26);
  }
  return r;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let apiCallCount = 0;
async function rateLimitedCall(fn, label = '') {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      apiCallCount++;
      await delay(1200); // Safe pacing: 1.2s between API calls
      return await fn();
    } catch (err) {
      const isQuota = err.message && (
        err.message.includes('Quota exceeded') ||
        err.message.includes('rate limit') ||
        err.code === 429
      );
      if (isQuota && attempt < MAX_RETRIES) {
        const waitSec = Math.pow(2, attempt + 2) * 5;
        console.log(`   ⏳ Rate limit hit${label ? ` (${label})` : ''}. Waiting ${waitSec}s...`);
        await delay(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

async function authenticate() {
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  return new google.auth.GoogleAuth({ credentials: keyFile, scopes: SCOPES });
}

// ─── Sheet Creation & Formatting ───────────────────────────────────────────────

/**
 * Creates a sheet tab if it doesn't exist, writes headers, and applies formatting.
 */
async function ensureSheet(sheetsApi, spreadsheetId, def, sheetMap, sheetIndex) {
  // 1. Create tab if missing
  if (sheetMap[def.title] === undefined) {
    try {
      const resp = await rateLimitedCall(() => sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: def.title,
                index: sheetIndex,
                tabColor: def.tabColor,
                gridProperties: {
                  frozenRowCount: 1,
                  frozenColumnCount: def.headers.length > 2 ? 2 : 0
                }
              }
            }
          }]
        }
      }), `create ${def.title}`);
      sheetMap[def.title] = resp.data.replies[0].addSheet.properties.sheetId;
      console.log(`   🆕 Created "${def.title}"`);
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log(`   ✅ "${def.title}" already exists.`);
        return;
      }
      console.error(`   ⚠️  Error creating "${def.title}": ${err.message}`);
      return;
    }
  } else {
    console.log(`   ✅ "${def.title}" exists.`);
  }

  const sheetId = sheetMap[def.title];
  if (sheetId === undefined) return;

  // 2. Check if headers are already set
  let hasHeaders = false;
  try {
    const check = await rateLimitedCall(() => sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `'${def.title}'!A1:B1`
    }), `check ${def.title}`);
    if (check.data.values && check.data.values.length > 0 && check.data.values[0][0]) {
      hasHeaders = true;
    }
  } catch (e) { /* new sheet, no data */ }

  if (!hasHeaders) {
    // Write headers
    await rateLimitedCall(() => sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `'${def.title}'!A1:${colLetter(def.headers.length)}1`,
      valueInputOption: 'RAW',
      resource: { values: [def.headers] }
    }), `headers ${def.title}`);
  }

  // 3. Format headers + data validations in one batchUpdate
  const requests = [
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: def.headers.length
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.PRIMARY_BG,
            textFormat: {
              foregroundColor: COLORS.PRIMARY_TEXT,
              fontFamily: 'Roboto',
              fontSize: 10,
              bold: true
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 38 },
        fields: 'pixelSize'
      }
    },
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: def.headers.length
        }
      }
    }
  ];

  // Add data validations
  if (def.validations) {
    for (const v of def.validations) {
      requests.push({
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 501,
            startColumnIndex: v.col,
            endColumnIndex: v.col + 1
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: v.values.map(val => ({ userEnteredValue: val }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      });
    }
  }

  await rateLimitedCall(() => sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests }
  }), `format ${def.title}`);
  console.log(`   🎨 "${def.title}" — ${def.headers.length} cols formatted.`);
}

// ─── Monthly Attendance & Task Tracker Matrix Builder ─────────────────────────

const WORKING_DAYS_SEP_2026 = [
  { date: '2026-09-01', day: 'Tue' },
  { date: '2026-09-02', day: 'Wed' },
  { date: '2026-09-03', day: 'Thu' },
  { date: '2026-09-04', day: 'Fri' },
  { date: '2026-09-07', day: 'Mon' },
  { date: '2026-09-08', day: 'Tue' },
  { date: '2026-09-09', day: 'Wed' },
  { date: '2026-09-10', day: 'Thu' },
  { date: '2026-09-11', day: 'Fri' },
  { date: '2026-09-14', day: 'Mon' },
  { date: '2026-09-15', day: 'Tue' },
  { date: '2026-09-16', day: 'Wed' },
  { date: '2026-09-17', day: 'Thu' },
  { date: '2026-09-18', day: 'Fri' },
  { date: '2026-09-21', day: 'Mon' },
  { date: '2026-09-22', day: 'Tue' },
  { date: '2026-09-23', day: 'Wed' },
  { date: '2026-09-24', day: 'Thu' },
  { date: '2026-09-25', day: 'Fri' },
  { date: '2026-09-28', day: 'Mon' },
  { date: '2026-09-29', day: 'Tue' },
  { date: '2026-09-30', day: 'Wed' }
];

const DEFAULT_SAMPLE_STUDENTS = [
  {
    name: 'Thirumala',
    domain: 'Python Full Stack',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    tenureDays: 90,
    attendance: ['Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present'],
    tasks: ['Completed', 'Completed', 'Completed', 'Not Completed', 'Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Holiday', 'Not Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed']
  },
  {
    name: 'Ahalya',
    domain: 'Gen AI & AIML',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    tenureDays: 90,
    attendance: ['Present', 'Present', 'Absent', 'Present', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present'],
    tasks: ['Completed', 'Completed', 'Not Completed', 'Completed', 'Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed']
  },
  {
    name: 'Sneha',
    domain: 'Full Stack Web (MERN)',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    tenureDays: 90,
    attendance: ['Present', 'Present', 'Present', 'Absent', 'Present', 'Present', 'Holiday', 'Absent', 'Absent', 'Holiday', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present'],
    tasks: ['Completed', 'Completed', 'Completed', 'Not Completed', 'Completed', 'Completed', 'Holiday', 'Not Completed', 'Not Completed', 'Holiday', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed']
  },
  {
    name: 'Venkata Koushik',
    domain: 'Data Science & Cloud',
    startDate: '2026-09-07',
    endDate: '2026-12-07',
    tenureDays: 90,
    attendance: ['Not Joined', 'Not Joined', 'Not Joined', 'Not Joined', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Holiday', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present', 'Present'],
    tasks: ['Not Joined', 'Not Joined', 'Not Joined', 'Not Joined', 'Not Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Holiday', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed', 'Completed']
  }
];

async function buildAttendanceTrackerSheet(sheetsApi, spreadsheetId, staffId, sheetMap, sheetIndex) {
  const title = `ATT_${staffId}`;
  
  if (sheetMap[title] === undefined) {
    try {
      const resp = await rateLimitedCall(() => sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title,
                index: sheetIndex,
                tabColor: COLORS.NAVY_HEADER,
                gridProperties: {
                  frozenRowCount: 4,
                  frozenColumnCount: 0
                }
              }
            }
          }]
        }
      }), `create ${title}`);
      sheetMap[title] = resp.data.replies[0].addSheet.properties.sheetId;
      console.log(`   🆕 Created Monthly Attendance Tracker "${title}"`);
    } catch (err) {
      if (!err.message || !err.message.includes('already exists')) {
        console.error(`   ⚠️  Error creating "${title}": ${err.message}`);
        return;
      }
    }
  } else {
    console.log(`   ✅ "${title}" exists.`);
  }

  const sheetId = sheetMap[title];
  if (sheetId === undefined) return;

  let hasData = false;
  try {
    const check = await rateLimitedCall(() => sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A1:B1`
    }), `check ${title}`);
    if (check.data.values && check.data.values.length > 0 && check.data.values[0][0]) {
      hasData = true;
    }
  } catch (e) { /* empty sheet */ }

  const totalCols = 2 + WORKING_DAYS_SEP_2026.length + 5; // 29 cols (A to AC)
  const lastColLetter = colLetter(totalCols);

  if (!hasData) {
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
    const row3 = [
      'Intern Name',
      'Tracking Metric',
      ...WORKING_DAYS_SEP_2026.map(w => w.date),
      'Total Present',
      'Total Absent',
      'Attendance %',
      'Tasks Completed',
      'Completion %'
    ];
    rows.push(row3);

    // Row 4: Header 2
    const row4 = [
      'Domain / Track',
      'Daily Log Type',
      ...WORKING_DAYS_SEP_2026.map(w => w.day),
      'Summary',
      'Summary',
      'Rate %',
      'Summary',
      'Rate %'
    ];
    rows.push(row4);

    const students = DEFAULT_SAMPLE_STUDENTS;
    students.forEach((s, idx) => {
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

    const studentCount = students.length;
    const lastStudentRow = 4 + studentCount * 2;

    const dailyPresentRow = [
      'Daily Total Present',
      'Cohort Attendance',
      ...WORKING_DAYS_SEP_2026.map((_, i) => {
        const cLetter = colLetter(i + 3);
        return `=COUNTIF(${cLetter}5:${cLetter}${lastStudentRow}, "Present")`;
      }),
      students.map((_, i) => `Y${5 + i * 2}`).join('+') ? `=${students.map((_, i) => `Y${5 + i * 2}`).join('+')}` : '',
      students.map((_, i) => `Z${5 + i * 2}`).join('+') ? `=${students.map((_, i) => `Z${5 + i * 2}`).join('+')}` : '',
      '',
      '',
      ''
    ];
    rows.push(dailyPresentRow);

    const dailyTasksRow = [
      'Daily Tasks Completed',
      'Cohort Tasks',
      ...WORKING_DAYS_SEP_2026.map((_, i) => {
        const cLetter = colLetter(i + 3);
        return `=COUNTIF(${cLetter}5:${cLetter}${lastStudentRow}, "Completed")`;
      }),
      '',
      '',
      '',
      students.map((_, i) => `AB${6 + i * 2}`).join('+') ? `=${students.map((_, i) => `AB${6 + i * 2}`).join('+')}` : '',
      ''
    ];
    rows.push(dailyTasksRow);

    await rateLimitedCall(() => sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1:${lastColLetter}${rows.length}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows }
    }), `values ${title}`);
  }

  const studentCount = DEFAULT_SAMPLE_STUDENTS.length;
  const lastStudentRow = 4 + studentCount * 2;

  const requests = [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 4,
            frozenColumnCount: 0
          }
        },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
      }
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
        mergeType: 'MERGE_ALL'
      }
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
        mergeType: 'MERGE_ALL'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.NAVY_HEADER,
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, fontFamily: 'Roboto', fontSize: 13, bold: true },
            horizontalAlignment: 'RIGHT',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.NAVY_SUBHEADER,
            textFormat: { foregroundColor: { red: 0.9, green: 0.94, blue: 1 }, fontFamily: 'Roboto', fontSize: 10, italic: true },
            horizontalAlignment: 'RIGHT',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.118, green: 0.227, blue: 0.541 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, fontFamily: 'Roboto', fontSize: 10, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: lastStudentRow, endRowIndex: lastStudentRow + 2, startColumnIndex: 0, endColumnIndex: totalCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.SUMMARY_BG,
            textFormat: { foregroundColor: { red: 0.08, green: 0.12, blue: 0.2 }, fontFamily: 'Roboto', fontSize: 10, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: lastStudentRow, endRowIndex: lastStudentRow + 2, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'LEFT'
          }
        },
        fields: 'userEnteredFormat(horizontalAlignment)'
      }
    },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 24 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: 4 }, properties: { pixelSize: 28 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 4, endIndex: lastStudentRow + 2 }, properties: { pixelSize: 30 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 160 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 140 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 24 }, properties: { pixelSize: 92 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 24, endIndex: totalCols }, properties: { pixelSize: 110 }, fields: 'pixelSize' } }
  ];

  for (let i = 0; i < studentCount; i++) {
    const rStart = 4 + i * 2;
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: rStart, endRowIndex: rStart + 2, startColumnIndex: 0, endColumnIndex: 1 },
        mergeType: 'MERGE_ALL'
      }
    });
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: rStart, endRowIndex: rStart + 2, startColumnIndex: 0, endColumnIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { fontFamily: 'Roboto', fontSize: 10, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)'
      }
    });
  }

  for (let i = 0; i < studentCount; i++) {
    const rAtt = 4 + i * 2;
    const rTsk = 5 + i * 2;
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: rAtt, endRowIndex: rAtt + 1, startColumnIndex: 2, endColumnIndex: 24 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: ['Present', 'Absent', 'Holiday', 'On Leave', 'Not Joined'].map(v => ({ userEnteredValue: v }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    });
    requests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: rTsk, endRowIndex: rTsk + 1, startColumnIndex: 2, endColumnIndex: 24 },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: ['Completed', 'Not Completed', 'In Progress', 'Holiday', 'Not Joined'].map(v => ({ userEnteredValue: v }))
          },
          showCustomUi: true,
          strict: true
        }
      }
    });
  }

  const condRange = { sheetId, startRowIndex: 4, endRowIndex: lastStudentRow, startColumnIndex: 2, endColumnIndex: 24 };
  const condRules = [
    { value: 'Present', bg: COLORS.PRESENT_BG, fg: COLORS.PRESENT_TEXT },
    { value: 'Completed', bg: COLORS.PRESENT_BG, fg: COLORS.PRESENT_TEXT },
    { value: 'Absent', bg: COLORS.ABSENT_BG, fg: COLORS.ABSENT_TEXT },
    { value: 'Not Completed', bg: COLORS.ABSENT_BG, fg: COLORS.ABSENT_TEXT },
    { value: 'Holiday', bg: COLORS.HOLIDAY_BG, fg: COLORS.HOLIDAY_TEXT },
    { value: 'In Progress', bg: COLORS.IN_PROGRESS_BG, fg: COLORS.IN_PROGRESS_TEXT },
    { value: 'Not Joined', bg: { red: 0.95, green: 0.95, blue: 0.96 }, fg: { red: 0.45, green: 0.47, blue: 0.50 } }
  ];

  condRules.forEach(rule => {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [condRange],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: rule.value }]
            },
            format: {
              backgroundColor: rule.bg,
              textFormat: { foregroundColor: rule.fg, bold: true }
            }
          }
        },
        index: 0
      }
    });
  });

  await rateLimitedCall(() => sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests }
  }), `format ${title}`);

  console.log(`   🎨 "${title}" — Monthly Attendance & Task Tracker Matrix formatted with 29 cols & formulas.`);
}

/**
 * Read staff IDs from the Staff_Directory sheet for per-employee tab creation.
 */
async function readStaffIds(sheetsApi, spreadsheetId) {
  try {
    const resp = await rateLimitedCall(() => sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `'02_Staff_Directory'!A2:B100` // Staff_ID and Full_Name columns
    }), 'read staff IDs');

    if (!resp.data.values || resp.data.values.length === 0) {
      return [];
    }

    return resp.data.values
      .filter(row => row[0] && row[0].trim())
      .map(row => ({
        staffId: row[0].trim(),
        name: row[1] ? row[1].trim() : 'Unknown'
      }));
  } catch (err) {
    console.log(`   ⚠️  Could not read Staff_Directory: ${err.message}`);
    return [];
  }
}

// ─── Branch Initialization ─────────────────────────────────────────────────────

async function initializeBranch(sheetsApi, branch) {
  const spreadsheetId = branch.spreadsheetId;
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🏢 INITIALIZING HYBRID ARCHITECTURE: ${branch.name} (${branch.id})`);
  console.log(`${'═'.repeat(70)}`);

  // 1. Fetch existing sheets
  let existingSheets = [];
  try {
    const response = await rateLimitedCall(() => sheetsApi.spreadsheets.get({ spreadsheetId }), 'get');
    existingSheets = response.data.sheets.map(s => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId
    }));
    console.log(`   📋 Found ${existingSheets.length} existing sheet(s): ${existingSheets.map(s => s.title).join(', ')}`);
  } catch (err) {
    console.error(`   ❌ Cannot access spreadsheet: ${err.message}`);
    console.error(`   ⚠️  Ensure spreadsheet is shared with: gss-508@management-system-509313.iam.gserviceaccount.com`);
    return false;
  }

  const sheetMap = {};
  existingSheets.forEach(s => { sheetMap[s.title] = s.sheetId; });

  // 2. Create/verify all 4 common sheets
  console.log(`\n   ──── COMMON SHEETS ────`);
  const commonDefs = getCommonSheetDefinitions();
  for (let i = 0; i < commonDefs.length; i++) {
    await ensureSheet(sheetsApi, spreadsheetId, commonDefs[i], sheetMap, i);
  }

  // 3. Read staff directory to create per-employee tabs
  console.log(`\n   ──── PER-EMPLOYEE SUB-SHEETS ────`);
  const staffList = await readStaffIds(sheetsApi, spreadsheetId);
  
  if (staffList.length === 0) {
    console.log(`   ℹ️  No staff members found in 02_Staff_Directory. Per-employee tabs will be created when staff are added.`);
  } else {
    console.log(`   👥 Found ${staffList.length} staff member(s): ${staffList.map(s => s.staffId).join(', ')}`);
    
    // Re-fetch sheet map after common sheets were potentially created
    try {
      const response = await rateLimitedCall(() => sheetsApi.spreadsheets.get({ spreadsheetId }), 'refresh');
      response.data.sheets.forEach(s => {
        sheetMap[s.properties.title] = s.properties.sheetId;
      });
    } catch (e) { /* use existing map */ }

    let tabIndex = commonDefs.length;
    for (const staff of staffList) {
      console.log(`\n   👤 ${staff.name} (${staff.staffId}):`);
      const employeeDefs = getEmployeeSheetDefinitions(staff.staffId);
      for (const def of employeeDefs) {
        if (def.isAttendanceTracker) {
          await buildAttendanceTrackerSheet(sheetsApi, spreadsheetId, staff.staffId, sheetMap, tabIndex++);
        } else {
          await ensureSheet(sheetsApi, spreadsheetId, def, sheetMap, tabIndex++);
        }
      }
    }
  }

  // 4. Prune obsolete sheets (skip in sync mode)
  if (!syncMode) {
    // Build the set of valid sheet names
    const validTitles = new Set(commonDefs.map(d => d.title));
    for (const staff of staffList) {
      const empDefs = getEmployeeSheetDefinitions(staff.staffId);
      empDefs.forEach(d => validTitles.add(d.title));
    }

    // Re-fetch sheet map one final time
    try {
      const response = await rateLimitedCall(() => sheetsApi.spreadsheets.get({ spreadsheetId }), 'final-check');
      const currentSheets = response.data.sheets.map(s => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId
      }));

      const obsoleteSheets = currentSheets.filter(s => !validTitles.has(s.title));
      if (obsoleteSheets.length > 0 && currentSheets.length > obsoleteSheets.length) {
        console.log(`\n   🧹 Pruning ${obsoleteSheets.length} obsolete sheet(s)...`);
        for (const obs of obsoleteSheets) {
          try {
            await rateLimitedCall(() => sheetsApi.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: { requests: [{ deleteSheet: { sheetId: obs.sheetId } }] }
            }), `delete ${obs.title}`);
            console.log(`   🗑️  Deleted: "${obs.title}"`);
          } catch (err) {
            console.log(`   ⚠️  Could not delete "${obs.title}": ${err.message}`);
          }
        }
      }
    } catch (e) { /* skip pruning on error */ }
  } else {
    console.log(`\n   🔒 SYNC MODE: Skipping sheet deletion.`);
  }

  console.log(`\n   ✅ ${branch.name} — HYBRID SETUP COMPLETE ✅\n`);
  return true;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   GSS ENTERPRISE BRANCH INITIALIZER v4.0                           ║');
  console.log('║   Hybrid Architecture: 4 Common + Per-Employee Sub-Sheets          ║');
  console.log('║   WL_{id} • STU_{id} • TSK_{id} • Scalable & Production-Ready      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  if (syncMode) {
    console.log('🔒 SYNC MODE ACTIVE: Will only add missing tabs, no deletions.\n');
  }

  const auth = await authenticate();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  console.log('✅ Service Account authenticated successfully.\n');

  const branchesToInit = targetBranchCodes
    ? BRANCHES.filter(b => targetBranchCodes.includes(b.code))
    : BRANCHES;

  console.log(`📋 Target branches: ${branchesToInit.map(b => `${b.code} (${b.name})`).join(', ')}\n`);

  let ok = 0;
  for (let i = 0; i < branchesToInit.length; i++) {
    const branch = branchesToInit[i];
    try {
      const result = await initializeBranch(sheetsApi, branch);
      if (result) ok++;
    } catch (err) {
      console.error(`   ❌ Failed on ${branch.name}: ${err.message}`);
    }
    if (i < branchesToInit.length - 1) {
      console.log('   ⏳ Cooldown pause (10s) between branches...');
      await delay(10000);
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🎉 SUMMARY: ${ok}/${branchesToInit.length} branches successfully initialized.`);
  console.log(`📊 Total API calls: ${apiCallCount}`);
  if (ok === branchesToInit.length) {
    console.log('✅ ALL BRANCHES ARE NOW HYBRID, SCALABLE, AND PRODUCTION-READY.');
  }
  console.log(`${'═'.repeat(70)}\n`);
}

main();
