import { getAdminFirestore } from '../src/lib/firebase/firebase-admin';
import { getSheetsApi, deleteRowsMatching, deleteStaffSubsheets } from '../src/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP } from '../src/lib/seed-branches';

async function auditAndClean() {
  console.log('================================================================');
  console.log('🔍 SYSTEM AUDIT: FIREBASE, GOOGLE SHEETS & DEPLOYMENT VERIFICATION');
  console.log('================================================================\n');

  const db = getAdminFirestore();
  if (!db) {
    throw new Error('Firebase Admin Firestore could not be initialized');
  }

  // ─── 1. FIREBASE AUDIT & CLEANUP ───────────────────────────────────────────
  console.log('--- 1. FIREBASE FIRESTORE AUDIT ---');
  const collections = ['users', 'tasks', 'daily_worklogs', 'students', 'attendance'];
  for (const collName of collections) {
    const snap = await db.collection(collName).get();
    console.log(`Collection [${collName}]: ${snap.size} total documents`);
    for (const doc of snap.docs) {
      const data = doc.data();
      const id = doc.id;
      const isTest = id.includes('SYNTH_') || id.includes('TEST_') || id.includes('ANTIGRAVITY_') || (data.name && String(data.name).includes('Synthetic'));
      if (isTest) {
        console.log(`   🚨 Found test document [${collName}/${id}] - Deleting...`);
        await doc.ref.delete();
        console.log(`   ✅ Deleted [${collName}/${id}]`);
      } else {
        console.log(`   ✓ Authentic doc: [${collName}/${id}] -> ${data.name || data.fullName || data.title || data.userId || 'Record'}`);
      }
    }
  }

  // ─── 2. GOOGLE SHEETS AUDIT & STANDARDIZATION ACROSS ALL 4 BRANCHES ────────
  console.log('\n--- 2. GOOGLE SHEETS AUDIT (ALL 4 BRANCHES) ---');
  const sheetsApi = await getSheetsApi();

  for (const [branch, spreadsheetId] of Object.entries(BRANCH_SPREADSHEET_MAP)) {
    console.log(`\nAuditing Branch [${branch}] (Spreadsheet ID: ${spreadsheetId})...`);
    const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
    const tabs = (meta.data.sheets || []).map(s => s.properties?.title || '');
    console.log(`   Total tabs: ${tabs.length}`);
    console.log(`   Tabs: ${tabs.join(', ')}`);

    // Check for any leftover test subsheets (e.g., WL_SYNTH_..., STU_SYNTH_..., etc.)
    for (const tab of tabs) {
      if (tab.includes('SYNTH_') || tab.includes('TEST_') || tab.includes('TMP')) {
        console.log(`   🚨 Removing leftover test tab: ${tab}`);
        const sheetObj = meta.data.sheets?.find(s => s.properties?.title === tab);
        if (sheetObj?.properties?.sheetId !== undefined) {
          await sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ deleteSheet: { sheetId: sheetObj.properties.sheetId } }]
            }
          });
          console.log(`   ✅ Removed test tab: ${tab}`);
        }
      }
    }

    // Clean any test rows from core tabs
    const coreTabs = [
      { tab: '02_Staff_Directory', col: 0 },
      { tab: '03_Daily_Worklogs', col: 0 },
      { tab: '04_Staff_Attendance', col: 0 },
      { tab: '05_Task_Allocation', col: 0 },
      { tab: '06_Student_Directory', col: 0 }
    ];

    for (const { tab, col } of coreTabs) {
      if (tabs.includes(tab)) {
        try {
          const res = await sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: `${tab}!A:Z`
          });
          const rows = res.data.values || [];
          let hasTestRow = false;
          for (let r = 1; r < rows.length; r++) {
            const rowStr = JSON.stringify(rows[r]);
            if (rowStr.includes('SYNTH_') || rowStr.includes('TEST_') || rowStr.includes('Synthetic')) {
              hasTestRow = true;
              break;
            }
          }
          if (hasTestRow) {
            console.log(`   🚨 Purging test rows from ${tab}...`);
            await deleteRowsMatching(spreadsheetId, tab, (row) => {
              const str = JSON.stringify(row);
              return str.includes('SYNTH_') || str.includes('TEST_') || str.includes('Synthetic');
            });
            console.log(`   ✅ Test rows purged from ${tab}`);
          }
        } catch (e: any) {
          console.error(`   Error checking rows in ${tab}:`, e.message);
        }
      }
    }
  }

  // ─── 3. AUDIT LIVE VERCEL ROUTES ──────────────────────────────────────────
  console.log('\n--- 3. LIVE VERCEL DEPLOYMENT ROUTE AUDIT ---');
  const base = 'https://gss-management-system-v1.vercel.app';
  const routesToTest = [
    '/',
    '/login',
    '/register',
    '/dashboard',
    '/students',
    '/my-students',
    '/worklog',
    '/tasks',
    '/leads',
    '/reports',
    '/admin/users',
    '/admin/directory',
    '/admin/attendance',
    '/admin/approvals',
    '/account',
    '/account/personal-info',
    '/account/security',
    '/privacy',
    '/terms',
    '/help',
    '/manifest.json',
    '/sw.js',
    '/api/health'
  ];

  let passCount = 0;
  for (const r of routesToTest) {
    try {
      const res = await fetch(base + r, { redirect: 'manual' });
      const status = res.status;
      const ok = (status >= 200 && status < 400);
      console.log(`   [${ok ? 'PASS ✅' : 'FAIL ❌'}] ${r.padEnd(25)} HTTP ${status}`);
      if (ok) passCount++;
    } catch (e: any) {
      console.log(`   [FAIL ❌] ${r.padEnd(25)} Error: ${e.message}`);
    }
  }

  console.log(`\nRoute Health Summary: ${passCount} / ${routesToTest.length} Passed`);
  console.log('\n================================================================');
  console.log('✅ AUDIT AND VERIFICATION COMPLETE');
  console.log('================================================================\n');
}

auditAndClean().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
