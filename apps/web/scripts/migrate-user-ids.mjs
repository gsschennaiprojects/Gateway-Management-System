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

function generateRandomThreeDigitNumber() {
  return Math.floor(100 + Math.random() * 900);
}

function generateNewId(roleCode, existingIds) {
  let id = '';
  let attempts = 0;
  do {
    const num = generateRandomThreeDigitNumber();
    id = `GSS${roleCode}${num}`;
    attempts++;
    if (attempts > 5000) throw new Error(`Exceeded collision attempts for role ${roleCode}`);
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

async function migrate() {
  console.log('🚀 Starting User ID migration to format GSS[Role][Random 3-digit number]...\n');

  // Step 1: Collect all existing IDs across Firestore
  const existingIds = new Set();
  const collections = await db.listCollections();
  for (const col of collections) {
    const snap = await col.get();
    for (const doc of snap.docs) {
      existingIds.add(doc.id);
      const data = doc.data();
      if (data.employeeId) existingIds.add(String(data.employeeId));
      if (data.staffId) existingIds.add(String(data.staffId));
      if (data.id) existingIds.add(String(data.id));
      if (data.uid) existingIds.add(String(data.uid));
    }
  }

  // Generate new IDs
  const newSaId = generateNewId('SA', existingIds);
  const newEmpId = generateNewId('EMP', existingIds);
  const newHrId = generateNewId('HR', existingIds);

  console.log('Generated New IDs:');
  console.log(`- Super Admin (was GSS_SA_001):                         -> ${newSaId}`);
  console.log(`- Jasvanth S (was GSS_EMP_usr_30ad7c9b-57c3-4e4a...):   -> ${newEmpId}`);
  console.log(`- Srinithi S (was GSS_HR_usr_5fae6db0-8f47-4c8f...):    -> ${newHrId}`);
  console.log('');

  const oldEmpEmployeeId = 'GSS_EMP_usr_30ad7c9b-57c3-4e4a-813f-5c08c7d51327';
  const oldHrEmployeeId = 'GSS_HR_usr_5fae6db0-8f47-4c8f-a5fd-9cd152915221';
  const empUid = 'usr_30ad7c9b-57c3-4e4a-813f-5c08c7d51327';
  const hrUid = 'usr_5fae6db0-8f47-4c8f-a5fd-9cd152915221';
  const now = new Date().toISOString();

  // Step 2: Migrate users collection
  console.log('1. Migrating `users` collection...');
  const saDoc = await db.collection('users').doc('GSS_SA_001').get();
  if (saDoc.exists) {
    const saData = saDoc.data();
    await db.collection('users').doc(newSaId).set({
      ...saData,
      id: newSaId,
      uid: newSaId,
      staffId: newSaId,
      employeeId: newSaId,
      updatedAt: now,
    });
    await db.collection('users').doc('GSS_SA_001').delete();
    console.log(`  ✓ Replaced users/GSS_SA_001 with users/${newSaId}`);
  }

  const empDoc = await db.collection('users').doc(empUid).get();
  if (empDoc.exists) {
    await db.collection('users').doc(empUid).update({
      employeeId: newEmpId,
      updatedAt: now,
    });
    console.log(`  ✓ Updated users/${empUid} employeeId to ${newEmpId}`);
  }

  const hrDoc = await db.collection('users').doc(hrUid).get();
  if (hrDoc.exists) {
    await db.collection('users').doc(hrUid).update({
      employeeId: newHrId,
      updatedAt: now,
    });
    console.log(`  ✓ Updated users/${hrUid} employeeId to ${newHrId}`);
  }

  // Step 3: Migrate phoneIndex collection
  console.log('\n2. Migrating `phoneIndex` collection...');
  await db.collection('phoneIndex').doc('+917397078885').set({
    uid: newSaId,
    employeeId: newSaId,
    role: 'superadmin',
    updatedAt: now,
  }, { merge: true });
  console.log(`  ✓ Updated phoneIndex/+917397078885 -> uid: ${newSaId}, employeeId: ${newSaId}`);

  await db.collection('phoneIndex').doc('+918098421779').set({
    uid: empUid,
    employeeId: newEmpId,
    updatedAt: now,
  }, { merge: true });
  console.log(`  ✓ Updated phoneIndex/+918098421779 -> employeeId: ${newEmpId}`);

  await db.collection('phoneIndex').doc('+919003580181').set({
    uid: hrUid,
    employeeId: newHrId,
    updatedAt: now,
  }, { merge: true });
  console.log(`  ✓ Updated phoneIndex/+919003580181 -> employeeId: ${newHrId}`);

  // Step 4: Migrate staff_attendance collection
  console.log('\n3. Migrating `staff_attendance` collection...');
  const attendanceDocs = await db.collection('staff_attendance').get();
  for (const doc of attendanceDocs.docs) {
    const data = doc.data();
    let newDocId = doc.id;
    let modified = false;
    let newStaffId = data.staffId;
    let newEmployeeId = data.employeeId || data.staffId;

    if (doc.id.includes('GSS_SA_001')) {
      newDocId = doc.id.replace('GSS_SA_001', newSaId);
      newStaffId = newSaId;
      newEmployeeId = newSaId;
      modified = true;
    } else if (doc.id.includes(oldEmpEmployeeId)) {
      newDocId = doc.id.replace(oldEmpEmployeeId, newEmpId);
      newStaffId = newEmpId;
      newEmployeeId = newEmpId;
      modified = true;
    } else if (doc.id.includes(oldHrEmployeeId)) {
      newDocId = doc.id.replace(oldHrEmployeeId, newHrId);
      newStaffId = newHrId;
      newEmployeeId = newHrId;
      modified = true;
    }

    const updatedBy = data.updatedBy ? { ...data.updatedBy } : undefined;
    if (updatedBy?.id === 'GSS_SA_001') {
      updatedBy.id = newSaId;
      modified = true;
    }

    if (modified) {
      await db.collection('staff_attendance').doc(newDocId).set({
        ...data,
        id: newDocId,
        staffId: newStaffId,
        employeeId: newEmployeeId,
        ...(updatedBy ? { updatedBy } : {}),
        updatedAt: now,
      });
      await db.collection('staff_attendance').doc(doc.id).delete();
      console.log(`  ✓ Migrated staff_attendance/${doc.id} -> staff_attendance/${newDocId}`);
    }
  }

  // Step 5: Migrate audit_logs collection
  console.log('\n4. Migrating `audit_logs` collection...');
  const auditDocs = await db.collection('audit_logs').get();
  for (const doc of auditDocs.docs) {
    const data = doc.data();
    let changed = false;
    const updates = {};

    if (data.userId === 'GSS_SA_001') {
      updates.userId = newSaId;
      changed = true;
    } else if (data.userId === oldEmpEmployeeId) {
      updates.userId = newEmpId;
      changed = true;
    } else if (data.userId === oldHrEmployeeId) {
      updates.userId = newHrId;
      changed = true;
    }

    if (data.recordId === 'GSS_SA_001') {
      updates.recordId = newSaId;
      changed = true;
    } else if (data.recordId === oldEmpEmployeeId) {
      updates.recordId = newEmpId;
      changed = true;
    } else if (data.recordId === oldHrEmployeeId) {
      updates.recordId = newHrId;
      changed = true;
    }

    if (changed) {
      await db.collection('audit_logs').doc(doc.id).update(updates);
      console.log(`  ✓ Updated audit_logs/${doc.id}`);
    }
  }

  // Step 6: Migrate projection_jobs collection
  console.log('\n5. Migrating `projection_jobs` collection...');
  const jobDocs = await db.collection('projection_jobs').get();
  for (const doc of jobDocs.docs) {
    const data = doc.data();
    let newDocId = doc.id;
    let changed = false;
    let entityId = data.entityId;

    if (typeof entityId === 'string') {
      if (entityId.includes('GSS_SA_001')) {
        entityId = entityId.replace('GSS_SA_001', newSaId);
        changed = true;
      }
      if (entityId.includes(oldEmpEmployeeId)) {
        entityId = entityId.replace(oldEmpEmployeeId, newEmpId);
        changed = true;
      }
      if (entityId.includes(oldHrEmployeeId)) {
        entityId = entityId.replace(oldHrEmployeeId, newHrId);
        changed = true;
      }
    }

    if (doc.id.includes('GSS_SA_001')) {
      newDocId = doc.id.replace('GSS_SA_001', newSaId);
      changed = true;
    } else if (doc.id.includes(oldEmpEmployeeId)) {
      newDocId = doc.id.replace(oldEmpEmployeeId, newEmpId);
      changed = true;
    } else if (doc.id.includes(oldHrEmployeeId)) {
      newDocId = doc.id.replace(oldHrEmployeeId, newHrId);
      changed = true;
    }

    if (changed) {
      await db.collection('projection_jobs').doc(newDocId).set({
        ...data,
        id: newDocId,
        entityId,
      });
      if (newDocId !== doc.id) {
        await db.collection('projection_jobs').doc(doc.id).delete();
      }
      console.log(`  ✓ Updated projection_jobs/${doc.id} -> ${newDocId}`);
    }
  }

  console.log('\n✅ All migrations completed successfully!');
  console.log('Summary of Mapped IDs:');
  console.log(JSON.stringify({
    superadmin: { old: 'GSS_SA_001', new: newSaId },
    employee: { old: oldEmpEmployeeId, new: newEmpId },
    hr: { old: oldHrEmployeeId, new: newHrId }
  }, null, 2));
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
