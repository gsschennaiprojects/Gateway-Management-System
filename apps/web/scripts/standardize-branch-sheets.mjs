import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_SHEETS = [
  {
    name: '01_Branch_Info',
    headers: ['Branch_ID', 'Branch_Name', 'Branch_Code', 'Location', 'Address', 'Contact_Email', 'Contact_Phone', 'Work_Start_Time', 'Work_End_Time', 'Status', 'Updated_At']
  },
  {
    name: '02_Staff_Directory',
    headers: ['Staff_ID', 'Full_Name', 'Role', 'Designation', 'Department', 'Email', 'Mobile', 'Joining_Date', 'Reporting_Manager', 'Account_Status', 'Firebase_UID', 'Updated_At']
  },
  {
    name: '03_Daily_Worklogs',
    headers: ['Log_ID', 'Staff_ID', 'Staff_Name', 'Role', 'Branch_ID', 'Date', 'Login_Time', 'Logout_Time', 'Tasks_Completed', 'Tasks_Pending', 'Incomplete_Reason', 'Total_Hours', 'Verified_By', 'Timestamp']
  },
  {
    name: '04_Staff_Attendance',
    headers: ['Attendance_ID', 'Date', 'Day', 'Staff_ID', 'Staff_Name', 'Role', 'Check_In', 'Check_Out', 'Total_Hours', 'Status', 'Marked_By', 'Timestamp']
  },
  {
    name: '05_Task_Allocation',
    headers: ['Task_ID', 'Date_Assigned', 'Assigned_By_ID', 'Assigned_By_Name', 'Assigned_To_ID', 'Assigned_To_Name', 'Task_Title', 'Description', 'Priority', 'Category', 'Start_Date', 'Due_Date', 'Completed_Date', 'Status', 'Progress_Pct', 'Remarks']
  },
  {
    name: '06_Student_Directory',
    headers: ['Student_ID', 'Student_Name', 'College', 'Department', 'Year', 'Email', 'Mobile', 'Course', 'Domain', 'Mentor_Staff_ID', 'Mentor_Name', 'Admission_Date', 'End_Date', 'Fee_Status', 'Project_Status', 'Student_Status']
  },
  {
    name: '07_Student_Progress',
    headers: ['Progress_ID', 'Student_ID', 'Student_Name', 'Mentor_ID', 'Date', 'Topic_Covered', 'Task_Assigned', 'Task_Status', 'Progress_Pct', 'Attendance_Today', 'Score', 'Remarks', 'Updated_At']
  },
  {
    name: '08_Candidate_Leads',
    headers: ['Lead_ID', 'Candidate_Name', 'Mobile', 'Email', 'College', 'Degree_Dept', 'Year_Of_Passing', 'Domain_Interested', 'Source', 'Lead_Status', 'Assigned_To', 'Remarks', 'Created_At']
  },
  {
    name: '09_System_Audit_Log',
    headers: ['Log_ID', 'Timestamp', 'User_ID', 'User_Name', 'Role', 'Action', 'Module', 'Record_ID', 'Branch_ID', 'Old_Value', 'New_Value', 'IP_Address']
  }
];

const BRANCHES = [
  { code: 'CHN', name: 'Gateway Chennai Branch', id: '1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY', branchId: 'BR_CHN_01' },
  { code: 'CBE', name: 'Gateway Coimbatore Branch', id: '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA', branchId: 'BR_CBE_02' },
  { code: 'MDU', name: 'Gateway Madurai Branch', id: '1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8', branchId: 'BR_MDU_03' },
  { code: 'ERD', name: 'Gateway Erode Branch', id: '1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY', branchId: 'BR_ERD_04' }
];

async function standardize() {
  const keyPath = path.resolve(__dirname, '../management-system-509313-306faa5b0c5e.json');
  const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  for (const b of BRANCHES) {
    console.log(`\n========================================`);
    console.log(`Standardizing Branch: ${b.code} (${b.name})`);
    console.log(`Spreadsheet ID: ${b.id}`);
    console.log(`========================================`);

    const meta = await sheets.spreadsheets.get({ spreadsheetId: b.id });
    const existingTitles = new Set(meta.data.sheets.map(s => s.properties.title));

    for (const master of MASTER_SHEETS) {
      if (!existingTitles.has(master.name)) {
        console.log(`[+] Creating missing sheet: ${master.name}`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: b.id,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: master.name }
              }
            }]
          }
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: b.id,
          range: `'${master.name}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [master.headers] }
        });
        console.log(`    ✓ Initialized with ${master.headers.length} headers`);
      } else {
        // Verify headers exist
        const row = await sheets.spreadsheets.values.get({
          spreadsheetId: b.id,
          range: `'${master.name}'!1:1`
        });
        if (!row.data.values || row.data.values.length === 0) {
          console.log(`[!] Empty headers in ${master.name}, writing standard headers...`);
          await sheets.spreadsheets.values.update({
            spreadsheetId: b.id,
            range: `'${master.name}'!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [master.headers] }
          });
          console.log(`    ✓ Written ${master.headers.length} headers`);
        } else {
          console.log(`[=] Sheet ${master.name} already exists with ${row.data.values[0].length} headers`);
        }
      }
    }
  }

  console.log('\n✅ All 4 branch spreadsheets successfully standardized!');
}

standardize().catch(console.error);
