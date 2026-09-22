const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, '..', 'management-system-509313-306faa5b0c5e.json');
const CBE_SPREADSHEET_ID = '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA';

async function fixFormula() {
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const formula = '=IF(COUNTIF(C6:X6, "Completed")+COUNTIF(C6:X6, "Not Completed")>0, ROUND(AB6/(COUNTIF(C6:X6, "Completed")+COUNTIF(C6:X6, "Not Completed"))*100, 1) & "%", "100%")';

  console.log('Updating formula in ATT_CBE_ADM01!AC6...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: 'ATT_CBE_ADM01!AC6',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[formula]]
    }
  });

  console.log('Reading updated summary values...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: 'ATT_CBE_ADM01!Y5:AC6'
  });
  console.log('Row 5 (Attendance):', res.data.values[0]);
  console.log('Row 6 (Tasks):     ', res.data.values[1]);
}

fixFormula().catch(console.error);
