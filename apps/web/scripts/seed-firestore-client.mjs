/**
 * Seeds the 4 branch documents to Firestore project `gss-management-system-eef75`
 * by authenticating with the Super Admin credentials.
 * 
 * Usage: node scripts/seed-firestore-client.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBdu8_3m0H2a7llugxPQk1FtjjVSosmN6w",
  authDomain: "gss-management-system-eef75.firebaseapp.com",
  projectId: "gss-management-system-eef75",
  storageBucket: "gss-management-system-eef75.firebasestorage.app",
  messagingSenderId: "528394878333",
  appId: "1:528394878333:web:a9a5da85cefbe639b9a014",
  measurementId: "G-NNL9WX2Q24"
};

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

async function run() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('🔐 Authenticating as Super Admin (gateway.managercbe@gmail.com)...');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'gateway.managercbe@gmail.com', 'GatewaySS@2013#');
    console.log(`✅ Logged in as: ${cred.user.email} (UID: ${cred.user.uid})`);
  } catch (err) {
    console.warn(`⚠️ Super admin login note: ${err.message}. Proceeding with branch write...`);
  }

  console.log('🚀 Writing branches to Firestore collection `branches`...');
  for (const b of BRANCH_SEED_DATA) {
    await setDoc(doc(db, 'branches', b.branchId), {
      ...b,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`   ✅ Seeded ${b.branchCode}: ${b.branchName} [${b.branchId}]`);
  }

  console.log('\n🎉 ALL 4 BRANCHES SEEDED SUCCESSFULLY TO FIRESTORE!\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
