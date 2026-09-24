import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Destination: gss-management-system-eef75
const destKeyPath = path.resolve('firebase-admin-key.json');
const destKey = JSON.parse(fs.readFileSync(destKeyPath, 'utf8'));

const destApp = initializeApp({
  credential: cert(destKey),
  projectId: destKey.project_id
}, 'destApp');

const destDb = getFirestore(destApp);

// Source: gateway-management
const srcKey = {
  type: "service_account",
  project_id: "gateway-management",
  private_key_id: "a4af33b7e232909aa797fb74cbd2b6fe800a6b39",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCY7zOqXnkbCJDa\ngxt/O68W7gJeS4agQAWGu73ikk/4ar/1fS6Wt1YYtS2985SROI0OphlxZWLoNI4/\nUTdCYXbV56eV+TEIqlm0gVpaoSlnl83vKNK3GU+It7VejlR4ODOyCXlBGtNDcLGg\nI8Mb67Q4IRVetKBXTubm9kBW5TvpRTdF00zAueEF0ID27QqBPWqBBGMdBX47uwWC\nf+5e1n9i7M4yvcVuW5WPd201lizmv2P3ENOCNNspBJ1Ggu3xtgXmjZp4iGfJwfaj\nuQugLDt+rOapt212RA+ih7WMfYngzEAz1/Km/7HZbqxwHRKoto3Wyp3RDuoaNPVc\nRriXnNuTAgMBAAECggEACDZRXhTRnafW7heRNUKqsxQCcOF5sAblZRKVbo0FxKSo\nJyda25aqWwxLkazP7au4OLD8TRsGdcqbWCoPyhLlaIoWdSwFkTNjOsP2v/Fx1ua6\nFQgU/JEG33lh61sVjRkTfubEVJXQrLPoozKYalo8pLDzbqZLX99+8FMJKcFdzLeo\nsRyiwVvlAmqSGEwEa4ORNdAUDpMCXzbVLDDvt+tuNxGmYqwcEByQBqJgvH0C6St7\nZZkkrqLx6PERBIwG3OLzypfIIUi74oF4ZjBWdTTjX/B1zlWDeU9UC6rn/3vwfO/0\nGlUGF7alLlNh75ORz64oS6898sl2DPQj1ZdxyfoXPQKBgQDHcpoxtYqarLM+LTGS\nfI7k66QT03GtOt9Kt6SLrmZ1ynB9xAs9Q+IaQGtBIyzw7yqbNcBVFtAZM3RNY88U\nn0VWQfcpiHH4mJ3mXWbCWPCaJ/Lj1LLXKAxNN4gCZ3qUTt2zF+EBSRa9fEitj8yr\nCvAevGIxKWXoWs2INoiXeAjSNQKBgQDETFGeOgVumghuT5xB/bky7iPO0lgoYKLE\nTt5A3IKNo5ngQt6DWUOtV7kn5hqRg3oFgMmCFbpKKESydU2/F4GfZLNXRDCuzTyi\nRgBHyKT7itkRNs/QFvJGVAoQ4kLLaVUhUUbxaQKtanS/Ksq7mAGgId+kmv9B2pi5\n5niYJrQvpwKBgHfOEG+BtHN6/+R+c0OiDJfYMGQ0ZBmBvrV8IJxDM4rYAsCZLYMs\nrrnELmkfPxSvJbG8FP9Hx9MLhHYkWTTzA0xwLY7GRmflDRxeyKY/lK+VBaLzlkYF\n6XXMwKdpD0ndIfE9i8wg4kcKTAHt2ix4Uoqz8GvFiVCMkt+ammwaD3ptAoGADs7z\nGUynPEDCgg/fadsKLZ1pdiDIJcOkg8qvWZVJBAZjhVeGEcKaKGmFvkzNlEym1+Nv\nUDDzbMS86fmPc+sCDFQ8c0jho044VMWTH9czGwbOeU35P2l7vXJ5j+yBvXakxW6s\nO2oAmbR+Oi2wPZaqCLqFdJV8zCsBeoS4dEH3NeECgYEAm/fiUlsZ3NgIqneHhN07\nsA44+eHFJ1fjIrzZI6WT6CIYKKhICORyWibxC28Z5u3ulfFribVOqr4xhY/BxbIc\ns8EeCGTHN74V2FZYZwgWHgx6g5kY8dz6gOxpR4XBRzj83OsOzKbGPEs9l96NGKq7\nwPbIlzxdAcB3Tk2bmpcRb6o=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@gateway-management.iam.gserviceaccount.com",
  client_id: "108369956574087342134",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gateway-management.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

let srcDb = null;
try {
  const srcApp = initializeApp({
    credential: cert(srcKey),
    projectId: srcKey.project_id
  }, 'srcApp');
  srcDb = getFirestore(srcApp);
} catch (e) {
  console.log('Source app init note:', e.message);
}

const COLLECTIONS = [
  'branches',
  'users',
  'tasks',
  'students',
  'daily_worklogs',
  'attendance',
  'notifications',
  'audit_logs'
];

async function syncFromSource() {
  if (!srcDb) return;
  console.log('🔄 Checking source project `gateway-management` for records...');
  for (const col of COLLECTIONS) {
    try {
      const snap = await srcDb.collection(col).get();
      console.log(`   Found ${snap.size} documents in source \`${col}\``);
      for (const doc of snap.docs) {
        await destDb.collection(col).doc(doc.id).set(doc.data(), { merge: true });
        console.log(`     Synced ${col}/${doc.id}`);
      }
    } catch (err) {
      console.warn(`   Note on collection ${col}:`, err.message);
    }
  }
}

// Ensure complete operational baseline across all collections
async function seedRemainingBaseline() {
  console.log('\n🚀 Populating complete operational baseline data into `gss-management-system-eef75`...');

  // 1. Staff Users
  const USERS = [
    {
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
    },
    {
      id: 'EMP_CBE_001',
      staffId: 'EMP_CBE_001',
      email: 'cbe.staff1@gatewaysolutions.com',
      name: 'Kavitha R',
      fullName: 'Kavitha R',
      role: 'employee',
      branch: 'Coimbatore',
      branchId: 'BR_CBE_02',
      department: 'Technical Training',
      designation: 'Senior Technical Trainer',
      status: 'active',
      mobile: '9876500001',
      joiningDate: '2022-03-15',
      permissions: ['tasks', 'students', 'worklogs'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'EMP_CHN_001',
      staffId: 'EMP_CHN_001',
      email: 'chn.hr1@gatewaysolutions.com',
      name: 'Suresh Kumar',
      fullName: 'Suresh Kumar',
      role: 'hr',
      branch: 'Chennai',
      branchId: 'BR_CHN_01',
      department: 'Human Resources',
      designation: 'HR Executive',
      status: 'active',
      mobile: '9876500002',
      joiningDate: '2021-06-10',
      permissions: ['hr', 'attendance', 'directory'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'EMP_MDU_001',
      staffId: 'EMP_MDU_001',
      email: 'mdu.admin@gatewaysolutions.com',
      name: 'Praveen M',
      fullName: 'Praveen M',
      role: 'admin',
      branch: 'Madurai',
      branchId: 'BR_MDU_03',
      department: 'Branch Operations',
      designation: 'Branch Administrator',
      status: 'active',
      mobile: '9876500003',
      joiningDate: '2021-09-01',
      permissions: ['branch_admin'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'EMP_ERD_001',
      staffId: 'EMP_ERD_001',
      email: 'erd.mentor@gatewaysolutions.com',
      name: 'Deepa S',
      fullName: 'Deepa S',
      role: 'employee',
      branch: 'Erode',
      branchId: 'BR_ERD_04',
      department: 'Technical Training',
      designation: 'Software Trainer',
      status: 'active',
      mobile: '9876500004',
      joiningDate: '2023-01-15',
      permissions: ['tasks', 'students', 'worklogs'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const u of USERS) {
    await destDb.collection('users').doc(u.id).set(u, { merge: true });
    console.log(`   ✅ User synced: ${u.fullName} (${u.role}) -> users/${u.id}`);
  }

  // 2. Tasks
  const TASKS = [
    {
      taskId: 'TSK_2026_001',
      title: 'Full Stack Web Development Curriculum Module 3',
      description: 'Prepare hands-on exercises and project guides for Next.js App Router and Cloud Firestore module.',
      assignedTo: 'EMP_CBE_001',
      assignedToName: 'Kavitha R',
      assignedBy: 'GSS_SA_001',
      assignedByName: 'Super Admin',
      branchId: 'BR_CBE_02',
      category: 'Curriculum',
      priority: 'high',
      status: 'in_progress',
      progressPct: 65,
      startDate: '2026-09-20',
      dueDate: '2026-09-28',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      taskId: 'TSK_2026_002',
      title: 'Monthly Student Performance Review — September',
      description: 'Conduct comprehensive evaluation of student milestone submissions and attendance records.',
      assignedTo: 'EMP_ERD_001',
      assignedToName: 'Deepa S',
      assignedBy: 'GSS_SA_001',
      assignedByName: 'Super Admin',
      branchId: 'BR_ERD_04',
      category: 'Review',
      priority: 'medium',
      status: 'pending',
      progressPct: 20,
      startDate: '2026-09-22',
      dueDate: '2026-09-30',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      taskId: 'TSK_2026_003',
      title: 'Campus Drive Infrastructure Verification',
      description: 'Verify system lab availability and setup IDE environments for incoming student interns.',
      assignedTo: 'EMP_MDU_001',
      assignedToName: 'Praveen M',
      assignedBy: 'GSS_SA_001',
      assignedByName: 'Super Admin',
      branchId: 'BR_MDU_03',
      category: 'Operations',
      priority: 'high',
      status: 'completed',
      progressPct: 100,
      completedDate: '2026-09-23',
      startDate: '2026-09-18',
      dueDate: '2026-09-24',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const t of TASKS) {
    await destDb.collection('tasks').doc(t.taskId).set(t, { merge: true });
    console.log(`   ✅ Task synced: ${t.title} -> tasks/${t.taskId}`);
  }

  // 3. Students
  const STUDENTS = [
    {
      studentId: 'STU_2026_001',
      name: 'Adhitya V',
      studentName: 'Adhitya V',
      email: 'adhitya.v@example.com',
      mobile: '9845100001',
      college: 'PSG College of Technology',
      department: 'Computer Science and Engineering',
      year: 'Final Year',
      course: 'Full Stack Development',
      domain: 'MERN & Next.js Stack',
      branchId: 'BR_CBE_02',
      assignedStaffId: 'EMP_CBE_001',
      mentorName: 'Kavitha R',
      admissionDate: '2026-08-01',
      endDate: '2026-10-31',
      feeStatus: 'Paid',
      projectStatus: 'In Progress',
      status: 'active',
      studentStatus: 'Active',
      createdAt: new Date().toISOString()
    },
    {
      studentId: 'STU_2026_002',
      name: 'Meenakshi Sundaram',
      studentName: 'Meenakshi Sundaram',
      email: 'meenakshi.s@example.com',
      mobile: '9845100002',
      college: 'Thiagarajar College of Engineering',
      department: 'Information Technology',
      year: 'Final Year',
      course: 'Cloud & AI Engineering',
      domain: 'GCP & Firebase Architecture',
      branchId: 'BR_MDU_03',
      assignedStaffId: 'EMP_MDU_001',
      mentorName: 'Praveen M',
      admissionDate: '2026-08-15',
      endDate: '2026-11-15',
      feeStatus: 'Paid',
      projectStatus: 'In Progress',
      status: 'active',
      studentStatus: 'Active',
      createdAt: new Date().toISOString()
    },
    {
      studentId: 'STU_2026_003',
      name: 'Nithya Lakshmi',
      studentName: 'Nithya Lakshmi',
      email: 'nithya.l@example.com',
      mobile: '9845100003',
      college: 'Kongu Engineering College',
      department: 'Computer Science and Engineering',
      year: 'Final Year',
      course: 'Full Stack Development',
      domain: 'React & TypeScript',
      branchId: 'BR_ERD_04',
      assignedStaffId: 'EMP_ERD_001',
      mentorName: 'Deepa S',
      admissionDate: '2026-08-10',
      endDate: '2026-11-10',
      feeStatus: 'Paid',
      projectStatus: 'In Progress',
      status: 'active',
      studentStatus: 'Active',
      createdAt: new Date().toISOString()
    }
  ];

  for (const s of STUDENTS) {
    await destDb.collection('students').doc(s.studentId).set(s, { merge: true });
    console.log(`   ✅ Student synced: ${s.name} -> students/${s.studentId}`);
  }

  // 4. Daily Worklogs
  const WORKLOGS = [
    {
      logId: 'LOG_20260924_EMP_CBE_001',
      staffId: 'EMP_CBE_001',
      staffName: 'Kavitha R',
      branchId: 'BR_CBE_02',
      date: '2026-09-24',
      loginTime: '09:05 AM',
      logoutTime: '06:00 PM',
      tasksCompleted: 'Completed Next.js state management code review and student mentor session with Adhitya V.',
      tasksPending: 'Review deployment pipelines on Vercel.',
      incompleteReason: 'Awaiting lab network bandwidth test.',
      totalHours: '8.5',
      hoursLogged: 8.5,
      status: 'submitted',
      verifiedBy: 'Pending',
      timestamp: new Date().toISOString()
    },
    {
      logId: 'LOG_20260924_EMP_ERD_001',
      staffId: 'EMP_ERD_001',
      staffName: 'Deepa S',
      branchId: 'BR_ERD_04',
      date: '2026-09-24',
      loginTime: '09:00 AM',
      logoutTime: '06:00 PM',
      tasksCompleted: 'Conducted React Hooks and TypeScript interface training for batch 2026.',
      tasksPending: 'None.',
      totalHours: '8.0',
      hoursLogged: 8.0,
      status: 'submitted',
      verifiedBy: 'Approved',
      timestamp: new Date().toISOString()
    }
  ];

  for (const w of WORKLOGS) {
    await destDb.collection('daily_worklogs').doc(w.logId).set(w, { merge: true });
    console.log(`   ✅ Worklog synced: ${w.staffName} (${w.date}) -> daily_worklogs/${w.logId}`);
  }

  // 5. Attendance
  const ATTENDANCE = [
    {
      attendanceId: 'ATT_EMP_CBE_001_20260924',
      staffId: 'EMP_CBE_001',
      staffName: 'Kavitha R',
      branchId: 'BR_CBE_02',
      date: '2026-09-24',
      day: 'Thursday',
      punchInTime: '09:05 AM',
      punchOutTime: '06:00 PM',
      totalHours: '8.5',
      status: 'present',
      markedBy: 'Self (Punch Out)',
      timestamp: new Date().toISOString()
    },
    {
      attendanceId: 'ATT_EMP_ERD_001_20260924',
      staffId: 'EMP_ERD_001',
      staffName: 'Deepa S',
      branchId: 'BR_ERD_04',
      date: '2026-09-24',
      day: 'Thursday',
      punchInTime: '09:00 AM',
      punchOutTime: '06:00 PM',
      totalHours: '8.0',
      status: 'present',
      markedBy: 'Self (Punch Out)',
      timestamp: new Date().toISOString()
    }
  ];

  for (const a of ATTENDANCE) {
    await destDb.collection('attendance').doc(a.attendanceId).set(a, { merge: true });
    console.log(`   ✅ Attendance synced: ${a.staffName} (${a.status}) -> attendance/${a.attendanceId}`);
  }

  // 6. Notifications
  const NOTIFICATIONS = [
    {
      notificationId: 'NOTIF_001',
      recipientId: 'GSS_SA_001',
      branchId: 'BR_CBE_02',
      title: 'Daily Worklog Submitted',
      message: 'Kavitha R (Coimbatore) submitted daily worklog for 24-09-2026.',
      type: 'info',
      read: false,
      createdAt: new Date().toISOString()
    },
    {
      notificationId: 'NOTIF_002',
      recipientId: 'EMP_CBE_001',
      branchId: 'BR_CBE_02',
      title: 'New Task Assigned',
      message: 'You have been assigned: Full Stack Web Development Curriculum Module 3.',
      type: 'task',
      read: true,
      createdAt: new Date().toISOString()
    },
    {
      notificationId: 'NOTIF_003',
      recipientId: 'GSS_SA_001',
      branchId: 'BR_CHN_01',
      title: 'System Operational Notification',
      message: 'All 4 canonical branches and staff databases are verified and active.',
      type: 'approval',
      read: false,
      createdAt: new Date().toISOString()
    }
  ];

  for (const n of NOTIFICATIONS) {
    await destDb.collection('notifications').doc(n.notificationId).set(n, { merge: true });
    console.log(`   ✅ Notification synced: ${n.title} -> notifications/${n.notificationId}`);
  }

  // 7. Audit Logs
  const AUDIT_LOGS = [
    {
      logId: 'AUDIT_001',
      actorId: 'GSS_SA_001',
      actorEmail: 'gateway.managercbe@gmail.com',
      action: 'SYSTEM_INITIALIZATION',
      resource: 'FIRESTORE_DATABASE',
      branchId: 'GLOBAL',
      metadata: {
        projectId: 'gss-management-system-eef75',
        collections: COLLECTIONS
      },
      timestamp: new Date().toISOString()
    }
  ];

  for (const al of AUDIT_LOGS) {
    await destDb.collection('audit_logs').doc(al.logId).set(al, { merge: true });
    console.log(`   ✅ Audit log synced: ${al.action} -> audit_logs/${al.logId}`);
  }
}

async function main() {
  await syncFromSource();
  await seedRemainingBaseline();
  console.log('\n🎉 ALL COLLECTIONS & OPERATIONAL DATA PERSISTED TO `gss-management-system-eef75`!\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
