/**
 * clean-structure-only.mjs
 * 
 * Cleans the Firestore database to keep ONLY the organizational structure:
 * - Branches: 4 canonical branches (BR_CHN_01, BR_CBE_02, BR_MDU_03, BR_ERD_04)
 * - Users: Root Super Admin exclusively with ID "GSS_SA_001"
 * - Tasks: Cleared (0 documents, structure retained)
 * - Students: Cleared (0 documents, structure retained)
 * - Daily Worklogs: Cleared (0 documents, structure retained)
 * - Attendance: Cleared (0 documents, structure retained)
 * - Notifications: Cleared (0 documents, structure retained)
 * - Audit Logs: Cleared (0 documents, structure retained)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.resolve(__dirname, '../firebase-admin-key.json');
if (!fs.existsSync(keyPath)) {
  console.error(`Firebase key not found at ${keyPath}`);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
const app = initializeApp({
  credential: cert(sa),
  projectId: sa.project_id || 'gss-management-system-eef75'
});
const db = getFirestore(app);

async function purgeCollection(collectionName, keepIds = []) {
  const snap = await db.collection(collectionName).get();
  console.log(`Found ${snap.size} documents in '${collectionName}'.`);
  
  let deletedCount = 0;
  const batch = db.batch();
  
  for (const doc of snap.docs) {
    if (keepIds.includes(doc.id)) {
      console.log(`  -> Preserving '${doc.id}' in '${collectionName}'`);
      continue;
    }
    batch.delete(doc.ref);
    deletedCount++;
  }
  
  if (deletedCount > 0) {
    await batch.commit();
    console.log(`  ✓ Successfully deleted ${deletedCount} documents from '${collectionName}'.`);
  } else {
    console.log(`  ✓ No documents to delete in '${collectionName}'.`);
  }
}

async function ensureSuperAdminRoot() {
  const superAdminData = {
    id: 'GSS_SA_001',
    staffId: 'GSS_SA_001',
    name: 'SABARINATHAN Muthu',
    fullName: 'SABARINATHAN Muthu',
    email: 'gateway.managercbe@gmail.com',
    gmail: 'gateway.managercbe@gmail.com',
    mobile: '7397078885',
    role: 'superadmin',
    status: 'active',
    branch: 'Coimbatore',
    branchId: 'BR_CBE_02',
    designation: 'General Manager',
    department: 'Management',
    specialization: 'Enterprise Operations & Systems Administration',
    specializations: ['Enterprise Operations & Systems Administration'],
    majorSpecialization: 'Enterprise Operations & Systems Administration',
    additionalSpecializations: [],
    permissions: ['all'],
    startMonthYear: '2013-01',
    password: 'GatewaySS@2013#',
    passwordHash: 'GatewaySS@2013#',
    createdAt: '2013-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  };

  await db.collection('users').doc('GSS_SA_001').set(superAdminData, { merge: true });
  console.log('  ✓ Verified and updated canonical Super Admin GSS_SA_001');
}

async function main() {
  console.log('=====================================================');
  console.log('CLEANING FIRESTORE DATA — PRESERVING STRUCTURE ONLY');
  console.log('Target Project:', sa.project_id);
  console.log('=====================================================\n');

  // 1. Users: Keep ONLY GSS_SA_001
  console.log('[1/8] Cleaning users collection...');
  await purgeCollection('users', ['GSS_SA_001']);
  await ensureSuperAdminRoot();

  // 2. Tasks: Delete all sample tasks
  console.log('\n[2/8] Cleaning tasks collection...');
  await purgeCollection('tasks', []);

  // 3. Students: Delete all sample students
  console.log('\n[3/8] Cleaning students collection...');
  await purgeCollection('students', []);

  // 4. Daily Worklogs: Delete all sample worklogs
  console.log('\n[4/8] Cleaning daily_worklogs collection...');
  await purgeCollection('daily_worklogs', []);

  // 5. Attendance: Delete all sample attendance
  console.log('\n[5/8] Cleaning attendance collection...');
  await purgeCollection('attendance', []);

  // 6. Notifications: Delete all sample notifications
  console.log('\n[6/8] Cleaning notifications collection...');
  await purgeCollection('notifications', []);

  // 7. Audit Logs: Delete all sample audit logs
  console.log('\n[7/8] Cleaning audit_logs collection...');
  await purgeCollection('audit_logs', []);

  // 8. Branches: Confirm 4 canonical branches exist
  console.log('\n[8/8] Verifying canonical branches structure...');
  const branchSnap = await db.collection('branches').get();
  console.log(`Branches present: ${branchSnap.docs.map(d => `${d.id} (${d.data().name})`).join(', ')}`);

  console.log('\n=====================================================');
  console.log('DATABASE CLEANUP COMPLETE — STRUCTURE READY FOR PRODUCTION');
  console.log('=====================================================');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  });
