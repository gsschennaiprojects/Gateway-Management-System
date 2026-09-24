import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const keyPath = path.resolve('firebase-admin-key.json');
const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

console.log(`Using Service Account for Project: ${keyData.project_id}`);

if (getApps().length === 0) {
  initializeApp({
    credential: cert(keyData),
    projectId: keyData.project_id
  });
}

const db = getFirestore();

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
  },
];

async function seed() {
  console.log('Seeding branches...');
  for (const b of BRANCH_SEED_DATA) {
    await db.collection('branches').doc(b.branchId).set({
      ...b,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`- Seeded branch: ${b.branchCode} (${b.branchId})`);
  }

  console.log('Seeding Super Admin user...');
  const superAdmin = {
    id: 'GSS_SA_001',
    staffId: 'GSS_SA_001',
    email: 'gateway.managercbe@gmail.com',
    name: 'Super Admin',
    fullName: 'Super Admin',
    role: 'superadmin',
    branch: 'Coimbatore',
    branchId: 'BR_CBE_02',
    department: 'Management',
    designation: 'General Manager',
    status: 'active',
    mobile: '9876543210',
    joiningDate: '2020-01-01',
    permissions: ['all'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.collection('users').doc('GSS_SA_001').set(superAdmin, { merge: true });
  console.log(`- Seeded Super Admin: ${superAdmin.email}`);

  console.log('Seeding complete! Check your Firebase Console now.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
