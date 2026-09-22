const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SERVICE_ACCOUNT_KEY_PATH = path.join(__dirname, '..', 'management-system-509313-306faa5b0c5e.json');
const CBE_SPREADSHEET_ID = '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA';

async function verify() {
  const keyFile = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('🔍 Reading ATT_CBE_ADM01 rows 1 to 32...');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CBE_SPREADSHEET_ID,
    range: 'ATT_CBE_ADM01!A1:AC32'
  });

  const rows = res.data.values || [];
  rows.forEach((r, idx) => {
    const rowNum = idx + 1;
    const colA = r[0] || '(empty)';
    const colB = r[1] || '(empty)';
    const colY = r[24] || '';
    const colZ = r[25] || '';
    const colAA = r[26] || '';
    const colAB = r[27] || '';
    const colAC = r[28] || '';
    console.log(`Row ${String(rowNum).padStart(2, ' ')}: [A: ${colA.padEnd(25, ' ')}] [B: ${colB.padEnd(16, ' ')}] Summaries: Y=${colY} Z=${colZ} AA=${colAA} AB=${colAB} AC=${colAC}`);
  });
}

verify().catch(console.error);
