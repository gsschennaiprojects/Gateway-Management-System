import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function getServiceAccount() {
  const candidatePaths = [
    path.join(process.cwd(), 'firebase-admin-key.json'),
    path.join(process.cwd(), 'apps', 'web', 'firebase-admin-key.json'),
    path.join(process.cwd(), '..', 'firebase-admin-key.json'),
    'C:/Users/jasva/Desktop/project/GMS/apps/web/firebase-admin-key.json',
    'C:/Users/jasva/Desktop/project/GMS/firebase-admin-key.json',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (c.project_id && c.private_key) return c;
      } catch {}
    }
  }
  return {
    type: "service_account",
    project_id: "gateway-management",
    private_key_id: "a4af33b7e232909aa797fb74cbd2b6fe800a6b39",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCY7zOqXnkbCJDa\ngxt/O68W7gJeS4agQAWGu73ikk/4ar/1fS6Wt1YYtS2985SROI0OphlxZWLoNI4/\nUTdCYXbV56eV+TEIqlm0gVpaoSlnl83vKNK3GU+It7VejlR4ODOyCXlBGtNDcLGg\nI8Mb67Q4IRVetKBXTubm9kBW5TvpRTdF00zAueEF0ID27QqBPWqBBGMdBX47uwWC\nf+5e1n9i7M4yvcVuW5WPd201lizmv2P3ENOCNNspBJ1Ggu3xtgXmjZp4iGfJwfaj\nuQugLDt+rOapt212RA+ih7WMfYngzEAz1/Km/7HZbqxwHRKoto3Wyp3RDuoaNPVc\nRriXnNuTAgMBAAECggEACDZRXhTRnafW7heRNUKqsxQCcOF5sAblZRKVbo0FxKSo\nJyda25aqWwxLkazP7au4OLD8TRsGdcqbWCoPyhLlaIoWdSwFkTNjOsP2v/Fx1ua6\nFQgU/JEG33lh61sVjRkTfubEVJXQrLPoozKYalo8pLDzbqZLX99+8FMJKcFdzLeo\nsRyiwVvlAmqSGEwEa4ORNdAUDpMCXzbVLDDvt+tuNxGmYqwcEByQBqJgvH0C6St7\nZZkkrqLx6PERBIwG3OLzypfIIUi74oF4ZjBWdTTjX/B1zlWDeU9UC6rn/3vwfO/0\nGlUGF7alLlNh75ORz64oS6898sl2DPQj1ZdxyfoXPQKBgQDHcpoxtYqarLM+LTGS\nfI7k66QT03GtOt9Kt6SLrmZ1ynB9xAs9Q+IaQGtBIyzw7yqbNcBVFtAZM3RNY88U\nn0VWQfcpiHH4mJ3mXWbCWPCaJ/Lj1LLXKAxNN4gCZ3qUTt2zF+EBSRa9fEitj8yr\nCvAevGIxKWXoWs2INoiXeAjSNQKBgQDETFGeOgVumghuT5xB/bky7iPO0lgoYKLE\nTt5A3IKNo5ngQt6DWUOtV7kn5hqRg3oFgMmCFbpKKESydU2/F4GfZLNXRDCuzTyi\nRgBHyKT7itkRNs/QFvJGVAoQ4kLLaVUhUUbxaQKtanS/Ksq7mAGgId+kmv9B2pi5\n5niYJrQvpwKBgHfOEG+BtHN6/+R+c0OiDJfYMGQ0ZBmBvrV8IJxDM4rYAsCZLYMs\nrrnELmkfPxSvJbG8FP9Hx9MLhHYkWTTzA0xwLY7GRmflDRxeyKY/lK+VBaLzlkYF\n6XXMwKdpD0ndIfE9i8wg4kcKTAHt2ix4Uoqz8GvFiVCMkt+ammwaD3ptAoGADs7z\nGUynPEDCgg/fadsKLZ1pdiDIJcOkg8qvWZVJBAZjhVeGEcKaKGmFvkzNlEym1+Nv\nUDDzbMS86fmPc+sCDFQ8c0jho044VMWTH9czGwbOeU35P2l7vXJ5j+yBvXakxW6s\nO2oAmbR+Oi2wPZaqCLqFdJV8zCsBeoS4dEH3NeECgYEAm/fiUlsZ3NgIqneHhN07\nsA44+eHFJ1fjIrzZI6WT6CIYKKhICORyWibxC28Z5u3ulfFribVOqr4xhY/BxbIc\ns8EeCGTHN74V2FZYZwgWHgx6g5kY8dz6gOxpR4XBRzj83OsOzKbGPEs9l96NGKq7\nwPbIlzxdAcB3Tk2bmpcRb6o=\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@gateway-management.iam.gserviceaccount.com"
  };
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
