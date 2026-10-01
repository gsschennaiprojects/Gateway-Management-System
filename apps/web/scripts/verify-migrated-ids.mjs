import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function getServiceAccount() {
  const candidatePaths = [
    path.join(process.cwd(), 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
    path.join(process.cwd(), '..', 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
    path.join(process.cwd(), '..', '..', 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
    'C:/Users/jasva/Desktop/project/GMS/gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (c.project_id === 'gss-management-system-eef75' && c.private_key) return c;
      } catch {}
    }
  }
  throw new Error('No local Firebase service account file found.');
}

const creds = getServiceAccount();
if (!getApps().length) {
  initializeApp({ credential: cert(creds) });
}
const db = getFirestore();

async function verify() {
  console.log('🔍 Verifying all collections for any remaining old IDs...');
  const collections = await db.listCollections();
  let oldIdMatches = 0;

  for (const col of collections) {
    const snap = await col.get();
    console.log(`Checking collection "${col.id}" (${snap.size} documents)...`);
    for (const doc of snap.docs) {
      const data = doc.data();
      const raw = JSON.stringify(data);
      if (doc.id.includes('GSS_SA_001') || doc.id.includes('GSS_EMP_') || doc.id.includes('GSS_HR_')) {
        console.error(`  ❌ Old ID found in Doc ID: ${col.id}/${doc.id}`);
        oldIdMatches++;
      }
      if (raw.includes('GSS_SA_001') || raw.includes('GSS_EMP_') || raw.includes('GSS_HR_')) {
        console.error(`  ❌ Old ID found in data: ${col.id}/${doc.id}: ${raw}`);
        oldIdMatches++;
      }
    }
  }

  if (oldIdMatches === 0) {
    console.log('\n🎉 SUCCESS! Zero legacy user IDs found across all collections in Firestore!');
  } else {
    console.error(`\n⚠️ Found ${oldIdMatches} occurrences of legacy IDs!`);
    process.exit(1);
  }

  console.log('\nVerifying current users:');
  const usersSnap = await db.collection('users').get();
  for (const d of usersSnap.docs) {
    const u = d.data();
    console.log(`- Doc ID: ${d.id}, employeeId: ${u.employeeId}, name: ${u.name}, role: ${u.role}, mobile: ${u.mobile}`);
  }

  console.log('\nVerifying staff_attendance:');
  const attSnap = await db.collection('staff_attendance').get();
  for (const d of attSnap.docs) {
    const a = d.data();
    console.log(`- Doc ID: ${d.id}, staffId: ${a.staffId}, employeeId: ${a.employeeId}, updatedBy: ${JSON.stringify(a.updatedBy)}`);
  }

  console.log('\nVerifying phoneIndex:');
  const phoneSnap = await db.collection('phoneIndex').get();
  for (const d of phoneSnap.docs) {
    const p = d.data();
    console.log(`- Phone: ${d.id}, uid: ${p.uid}, employeeId: ${p.employeeId}`);
  }
}

verify().catch(console.error);
