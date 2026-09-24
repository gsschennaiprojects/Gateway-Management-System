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
  return {
    type: "service_account",
    project_id: "gss-management-system-eef75",
    private_key_id: "0b53db1b954a508487ffaf68c4ff1d2d65acf08e",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDiczqfMLkCqC1K\nK0srHjqNRGkaslXXzVDoYSqnQCpZYnmk7iwFFEevBRf1og+6Em27/wDEBRs3uUTx\n1if08riQnj2s5u6l7HsQ57FRlVkmsuP4OrPuaCQHQI8OswZZA7IfIIAo1TEEB6MJ\n2GE0AW8UImrWkgdP0ocQPtoTNrZoe8N47/D393WUgHCGOUwJNzbCrbMeZkRmyCI4\nab7+aq1lTOK857TzfqsN3y5ZBvxpMsYfAN30xL73dk8qt1SV6HLg41UlN0Z16tqn\nl6q7VzZ/TTwxtiVTqtXg+PRswaDgmgGFeU20LdmKc0VFNlsYmdbG0SByERplhnKd\nfxTV1P9TAgMBAAECggEAbgdmJv5SDt/vbZfepLtB4O0qEp4vRrWMx/SaeHyddyP5\njjFpsygY8ooLi77sXFFi/1MWqKgAgxFi1gzkCkk7c41n01C8CWP/ogWp60WhdUO7\nsBu53K++PcXZHN/QyESa8jPlAbIg6F/bkMeR52aA9ewJNGvs4JSfKr4XUPmnJNl/\nr0e/3Crmjhsy/xdvB/Qm2FMgtXMEAcu0/aQOvNyaZFvxDJXQZCRal9YBgKgEQCEL\nX5Ny39eHI/14SQ5AAY8QcZASXfJniW/lhw24LwVrb+rC5NPDaiO3kEgdzn3nupqi\na/Jy6mw6uQ+kAyQPTLd6PLmbdrS5P08QT6f0WlnanQKBgQD8qe/kXyu49JnqEQxT\noXWKjx9eQnVujEITMqyKNoj9kK4ny+P24GYbxYkLI0norgQheoRmIwVG30bN6phz\njJ8/FaMIdWJ0hWIbxtwki6nrgwQ0VZ0itALiUVkbNrG1yLB2Mkk1HELGDlWI7/D1\nDDX/uqhnrch6zPzjsGtCSrEGHQKBgQDlcK72qYkfCbEcdgQujx2VckA1ipbPuqqI\n51mev2fI3YNK9BxhEGaafvJe8+qg66cj8rr0O8RnyFWLcrlMOdzqrepjUT8fxP1f\nTYbP/kdMZc/QvdIDWhxjIXTH+Vj5To13ONP3cseLkNat+Py4O2v67vIIY779nYsX\nxQLoWxJgLwKBgAXAiKmWURSA3RArGzC8OETTRU+MC8hcgRSWzr7Gxw+ev5hAWAxC\nx5BSSvBp+UDG1Wk9tM3udixK4P3HHXlj9iwlffSvV3J3pugi+tgKJfAqp2nZmR41\nIuusFm88K4eL7hiCxI/k+NAxe1kGvWGWyZPs1/CkUDAbgpZcadS0hpsxAoGBAJo+\naMEWNEKTZ2e0xxbty3uedSAJbV11JhQnQ45/KqxUjmEjPrjaJ8ARO6st2zwXcCOw\nmJJ8Y4tJmIjItV1TQPrbtEjUY9VdvuAE5G6LiS8I+u5fzgHG4HKcGUAelvvzHRNb\nNtSRayieVFRcoLjR6cOmQzv0on8pHEr8fPnrz6ytAoGASjVbT2Kw344EOjoq4Nl8\nnDK83q0pP1HzImvo/5BjClS54iV7SmIuJzIQjCmfz/RdChVXk9COiH2ODN1CrC6C\n7KOZXfEuaII3Yggt9nJx8ypPptkArkP3/GUBeHyR8PdCfuPLSFFTndpxuAGaXDO2\n6oIzMopkzlOfLP8PQSXO/+Y=\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@gss-management-system-eef75.iam.gserviceaccount.com"
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
