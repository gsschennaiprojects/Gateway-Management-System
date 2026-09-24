/**
 * One-time / Maintenance script to seed the 4 branch documents into Firestore
 * using the Firebase Admin SDK and service account key.
 * 
 * Usage: node seed-branches-admin.js
 */

const path = require('path');
const fs = require('fs');

let keyPath = path.join(__dirname, 'gss-management-system-eef75-firebase-adminsdk-fbsvc-0b53db1b95.json');
if (!fs.existsSync(keyPath)) {
  keyPath = path.join(__dirname, 'firebase-admin-key.json');
}
if (!fs.existsSync(keyPath)) {
  console.error('❌ Service account key not found at:', keyPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

const { createRequire } = require('module');
const webRequire = createRequire(path.join(__dirname, 'apps', 'web', 'package.json'));

const { initializeApp, cert, getApps } = webRequire('firebase-admin/app');
const { getFirestore, FieldValue } = webRequire('firebase-admin/firestore');

let app;
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

const BRANCH_SEED_DATA = [
  {
    branchId: 'BR_CHN_01',
    branchName: 'Gateway Chennai Branch',
    branchCode: 'CHN',
    location: 'Chennai, Tamil Nadu',
    address: 'GSS Technology Campus, Chennai, Tamil Nadu',
    contactEmail: 'chn@gatewaysolutions.com',
    contactPhone: '+91 98765 43210',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY',
    updatedAt: FieldValue.serverTimestamp()
  },
  {
    branchId: 'BR_CBE_02',
    branchName: 'Gateway Coimbatore Branch',
    branchCode: 'CBE',
    location: 'Coimbatore, Tamil Nadu',
    address: 'GSS Technology Campus, Coimbatore, Tamil Nadu',
    contactEmail: 'cbe@gatewaysolutions.com',
    contactPhone: '+91 98765 43211',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA',
    updatedAt: FieldValue.serverTimestamp()
  },
  {
    branchId: 'BR_MDU_03',
    branchName: 'Gateway Madurai Branch',
    branchCode: 'MDU',
    location: 'Madurai, Tamil Nadu',
    address: 'GSS Technology Campus, Madurai, Tamil Nadu',
    contactEmail: 'mdu@gatewaysolutions.com',
    contactPhone: '+91 98765 43212',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8',
    updatedAt: FieldValue.serverTimestamp()
  },
  {
    branchId: 'BR_ERD_04',
    branchName: 'Gateway Erode Branch',
    branchCode: 'ERD',
    location: 'Erode, Tamil Nadu',
    address: 'GSS Technology Campus, Erode, Tamil Nadu',
    contactEmail: 'erd@gatewaysolutions.com',
    contactPhone: '+91 98765 43213',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY',
    updatedAt: FieldValue.serverTimestamp()
  },
];

async function seed() {
  console.log('🚀 Seeding branches to Firestore collection `branches`...');
  for (const b of BRANCH_SEED_DATA) {
    await db.collection('branches').doc(b.branchId).set(b, { merge: true });
    console.log(`✅ Seeded branch ${b.branchCode} (${b.branchName}) [ID: ${b.branchId}]`);
  }
  console.log('🎉 All 4 branches successfully seeded into Firestore!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error seeding branches:', err);
  process.exit(1);
});
