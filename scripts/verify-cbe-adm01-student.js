/**
 * Verify CBE_ADM01 student data from both STU and ATT sheets.
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, '..', 'management-system-509313-306faa5b0c5e.json');
const CBE_SPREADSHEET_ID = '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA';
const STAFF_ID = 'CBE_ADM01';

async function main() {
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('\n🔍 Reading STU_CBE_ADM01...');
  const stuRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: `'STU_${STAFF_ID}'!A1:S5`
  });
  console.log('   Headers:', stuRes.data.values[0]?.slice(0, 5).join(' | '));
  console.log('   Student Row:', stuRes.data.values[1]?.slice(0, 11).join(' | '));

  console.log('\n🔍 Reading ATT_CBE_ADM01...');
  const attRes = await sheets.spreadsheets.values.get({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: `'ATT_${STAFF_ID}'!A3:AC7`
  });
  
  const h1 = attRes.data.values[0]; // Row 3: Intern Name, Metric, 2026-09-01...
  const sAtt = attRes.data.values[2]; // Row 5: Rithanya M, Attendance, ...
  const sTsk = attRes.data.values[3]; // Row 6: Domain, Task Completion, ...

  console.log('   Intern:', sAtt[0]);
  console.log('   Domain & Tenure:', sTsk[0]);
  console.log('   Metric:', sAtt[1]);
  console.log('   Sept 01 (Day 1):', sAtt[2]);
  console.log('   Sept 21 (Day 15):', sAtt[16]);
  console.log('   Sept 22 (TODAY, Day 16):', sAtt[17]); // Col C is index 2, so 2+15 = 17
  console.log('   Total Present:', sAtt[24]);
  console.log('   Total Absent:', sAtt[25]);
  console.log('   Attendance %:', sAtt[26]);
  console.log('   Tasks Completed:', sTsk[27]);
  console.log('   Completion %:', sTsk[28]);
  console.log('\n✅ Verification Complete!');
}

main().catch(console.error);
