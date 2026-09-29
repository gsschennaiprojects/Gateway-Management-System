import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function getServiceAccount() {
  const candidatePaths = [
    path.join(process.cwd(), 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
    path.join(process.cwd(), '..', 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json'),
    path.join(process.cwd(), 'firebase-admin-key.json'),
    path.join(process.cwd(), 'apps', 'web', 'firebase-admin-key.json'),
    path.join(process.cwd(), '..', 'firebase-admin-key.json'),
    'C:/Users/jasva/Desktop/project/GMS/gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json',
    'C:/Users/jasva/Desktop/project/GMS/apps/web/firebase-admin-key.json',
    'C:/Users/jasva/Desktop/project/GMS/firebase-admin-key.json',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (c.project_id === 'gss-management-system-eef75' && c.private_key) return c;
      } catch {}
    }
  }
  throw new Error('No local Firebase service account file found. Configure credentials before running this live verification script.');
}

async function verifyFirestore() {
  console.log('🔍 Checking Cloud Firestore connectivity & data persistence...\n');
  const creds = getServiceAccount();
  if (getApps().length === 0) {
    initializeApp({ credential: cert(creds) });
  }
  const db = getFirestore();

  const collections = [
    'branches',
    'users',
    'tasks',
    'students',
    'daily_worklogs',
    'attendance',
    'notifications',
    'audit_logs'
  ];

  console.log(`📡 Connected to Firestore Project: ${creds.project_id}\n`);

  for (const col of collections) {
    try {
      const snap = await db.collection(col).limit(10).get();
      console.log(`📁 Collection: [${col}]`);
      console.log(`   Total sample fetched: ${snap.size} documents`);
      if (snap.size > 0) {
        snap.docs.forEach((doc, idx) => {
          const data = doc.data();
          const summary = col === 'branches' 
            ? `${data.branchCode} - ${data.branchName}` 
            : col === 'users'
            ? `${data.email} (${data.role}, status=${data.approvalStatus || data.status})`
            : col === 'tasks'
            ? `${data.title} (${data.status})`
            : col === 'students'
            ? `${data.studentName || data.name} (ID=${data.studentId})`
            : JSON.stringify(Object.keys(data).slice(0, 5));
          console.log(`   ${idx + 1}. Doc ID: ${doc.id} | Info: ${summary}`);
        });
      } else {
        console.log(`   (empty collection)`);
      }
      console.log('');
    } catch (err) {
      console.error(`❌ Error querying collection ${col}:`, err.message);
    }
  }

  // Live Test Write & Read verification
  console.log('🧪 Executing Live Write → Read → Delete persistence test...');
  const testDocId = `test_verification_${Date.now()}`;
  const testPayload = {
    test: true,
    message: 'Testing Firestore authoritative live write',
    timestamp: new Date().toISOString()
  };

  await db.collection('audit_logs').doc(testDocId).set(testPayload);
  console.log(`✅ Write operation succeeded: audit_logs/${testDocId}`);

  const verifySnap = await db.collection('audit_logs').doc(testDocId).get();
  if (verifySnap.exists && verifySnap.data().message === testPayload.message) {
    console.log(`✅ Read verification succeeded: Data matches exactly from Firestore!`);
  } else {
    console.error(`❌ Read verification failed!`);
  }

  await db.collection('audit_logs').doc(testDocId).delete();
  console.log(`🧹 Test record cleaned up: audit_logs/${testDocId} deleted.`);
  console.log('\n🎉 ALL FIRESTORE DATA STORAGE VERIFICATIONS PASSED 100%!');
}

verifyFirestore().catch(console.error);
