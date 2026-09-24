import { NextRequest, NextResponse } from 'next/server';
import {
  getAllUsers,
  getUsersByBranch,
  findUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  stripSensitive
} from '@/lib/auth/user-store';
import { getSession } from '@/lib/auth/session';
import { canManageTargetUser, canDeleteUser } from '@/lib/rbac/permissions';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow Super Admin, Admin, and HR to view directory
  if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all users from Firestore to merge with in-memory users
  let firestoreUsers: any[] = [];
  try {
    const { getFirestoreUsers } = await import('@/lib/firebase/firebase-admin');
    firestoreUsers = await getFirestoreUsers();
  } catch (fsErr) {
    console.warn('[Users/GET] Firestore load note:', fsErr);
  }

  // Deduplicate and combine users
  const userMap = new Map<string, any>();
  for (const u of getAllUsers()) {
    userMap.set(u.id, u);
    if (u.email) userMap.set(u.email.toLowerCase(), u);
  }
  for (const fu of firestoreUsers) {
    userMap.set(fu.id, fu);
    if (fu.email) userMap.set(fu.email.toLowerCase(), fu);
  }
  const allUsers = Array.from(new Set(userMap.values()));

  const { searchParams } = new URL(req.url);
  const branchParam = searchParams.get('branch');

  // Super Admin can view all branches or filter by branch via query param, and view passwords
  if (session.user.role === 'superadmin') {
    const filtered = (branchParam && branchParam !== 'All' && branchParam !== 'all')
      ? allUsers.filter(u => u.branch === branchParam)
      : allUsers;
    const usersWithPassword = filtered.map(u => ({
      ...stripSensitive(u),
      password: u.passwordHash || u.password || 'GatewaySS@2013#'
    }));
    return NextResponse.json({ users: usersWithPassword });
  }

  // Admin and HR have strictly scoped access to their OWN branch (NO passwords)
  const branchUsers = allUsers.filter(u => u.branch === session.user.branch);
  return NextResponse.json({ users: branchUsers.map(stripSensitive) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Super Admin and Admin can perform user management operations
  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, action, status, role } = body;

    let target = findUserById(userId);
    if (!target) {
      try {
        const { getAdminFirestore } = await import('@/lib/firebase/firebase-admin');
        const db = getAdminFirestore();
        if (db) {
          const docSnap = await db.collection('users').doc(userId).get();
          if (docSnap.exists) {
            const d = docSnap.data();
            target = {
              id: docSnap.id,
              name: d?.name || 'Staff Member',
              email: d?.email || d?.gmail || '',
              mobile: d?.mobile || '',
              role: d?.role || 'intern',
              status: d?.status || 'pending',
              branch: d?.branch || 'Coimbatore',
              specialization: d?.specialization || 'Operations',
              createdAt: d?.createdAt || new Date().toISOString(),
              passwordHash: d?.password || d?.passwordHash || undefined
            } as any;
          }
        }
      } catch (err) {
        console.warn('[Users/PATCH] Target lookup in Firestore note:', err);
      }
    }

    if (!target) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Comprehensive staff editing — ONLY Super Admin is authorized to edit staff data
    if (action === 'edit_staff') {
      if (session.user.role !== 'superadmin') {
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admin is authorized to edit staff data' },
          { status: 403 }
        );
      }

      const {
        name,
        email,
        mobile,
        branch,
        role: newRole,
        status: newStatus,
        specialization,
        password: newPassword
      } = body;

      if (name && typeof name === 'string') target.name = name.trim();
      if (email && typeof email === 'string') target.email = email.trim().toLowerCase();
      if (mobile && typeof mobile === 'string') target.mobile = mobile.trim();
      if (branch && typeof branch === 'string') target.branch = branch as any;
      if (newRole && typeof newRole === 'string') target.role = newRole as any;
      if (newStatus && typeof newStatus === 'string') target.status = newStatus as any;
      if (specialization !== undefined) target.specialization = specialization;
      if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
        target.passwordHash = newPassword;
      }

      const { upsertServerUser } = await import('@/lib/auth/user-store');
      upsertServerUser(target);

      try {
        const { syncUserToFirestore } = await import('@/lib/firebase/firebase-admin');
        await syncUserToFirestore({
          id: target.id,
          name: target.name,
          email: target.email,
          mobile: target.mobile,
          role: target.role,
          status: target.status,
          branch: target.branch,
          specialization: target.specialization,
          specializations: target.specializations,
          startMonthYear: target.startMonthYear,
          startDate: target.startDate,
          endDate: target.endDate,
          password: target.passwordHash,
          createdAt: target.createdAt
        });
      } catch (fsErr) {
        console.warn('[Users/edit_staff] Firestore sync note:', fsErr);
      }

      try {
        const branchCode = BRANCH_NAME_TO_CODE[target.branch];
        const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
        if (spreadsheetId) {
          const { upsertStaffDirectory, createStaffSubsheets } = await import('@/lib/sheets/sheets-service');
          await upsertStaffDirectory(spreadsheetId, {
            staffId: target.id,
            fullName: target.name,
            role: target.role,
            designation: target.specialization || target.role,
            department: 'Operations',
            email: target.email,
            mobile: target.mobile,
            joiningDate: target.startDate || new Date().toISOString().split('T')[0],
            reportingManager: 'Management',
            accountStatus: target.status === 'active' ? 'Active' : target.status === 'rejected' ? 'Rejected' : 'Pending',
            firebaseUid: target.id
          });

          if (target.status === 'active') {
            await createStaffSubsheets(spreadsheetId, target.id, target.name, target.role);
          }
        }
      } catch (sheetErr) {
        console.warn('[Users/edit_staff] Sheet sync note:', sheetErr);
      }

      return NextResponse.json({
        success: true,
        user: {
          ...stripSensitive(target),
          password: target.passwordHash
        }
      });
    }

    // Enforce branch isolation for Admin
    if (!canManageTargetUser(session.user, target)) {
      return NextResponse.json(
        { error: `Forbidden: You can only manage personnel within your branch (${session.user.branch})` },
        { status: 403 }
      );
    }

    if (action === 'update_status' && status) {
      const updated = updateUserStatus(userId, status, target);

      // 1. Dual persistence: Sync to Firebase Firestore
      try {
        const { syncUserToFirestore } = await import('@/lib/firebase/firebase-admin');
        await syncUserToFirestore({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          mobile: updated.mobile,
          role: updated.role,
          status: updated.status,
          branch: updated.branch,
          specialization: updated.specialization,
          specializations: updated.specializations,
          startMonthYear: updated.startMonthYear,
          startDate: updated.startDate,
          endDate: updated.endDate,
          createdAt: updated.createdAt
        });
      } catch (fsErr) {
        console.warn('[Users/PATCH] Firestore sync note:', fsErr);
      }

      // 2. Dual persistence: Sync to Google Sheets and auto-create 4 subsheets if approved
      try {
        const branchCode = BRANCH_NAME_TO_CODE[updated.branch];
        const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
        if (spreadsheetId) {
          const { upsertStaffDirectory, createStaffSubsheets } = await import('@/lib/sheets/sheets-service');
          await upsertStaffDirectory(spreadsheetId, {
            staffId: updated.id,
            fullName: updated.name,
            role: updated.role,
            designation: updated.specialization || updated.role,
            department: 'Operations',
            email: updated.email,
            mobile: updated.mobile,
            joiningDate: updated.startDate || new Date().toISOString().split('T')[0],
            reportingManager: 'Management',
            accountStatus: status === 'active' ? 'Active' : status === 'rejected' ? 'Rejected' : 'Pending',
            firebaseUid: updated.id
          });

          // Create the 4 allocated subsheets (WL_<ID>, STU_<ID>, TSK_<ID>, ATT_<ID>) on branch sheet
          if (status === 'active') {
            await createStaffSubsheets(spreadsheetId, updated.id, updated.name, updated.role);
          }
        }
      } catch (sheetErr) {
        console.warn('[Users/PATCH] Google Sheets sync note:', sheetErr);
      }

      // Enterprise Audit Logging
      try {
        const { logAuditEvent } = await import('@/lib/audit/audit-service');
        await logAuditEvent({
          userId: session.user.id,
          userName: session.user.name,
          role: session.user.role,
          action: status === 'active' ? 'USER_APPROVED' : status === 'rejected' ? 'USER_REJECTED' : 'USER_STATUS_UPDATED',
          module: 'STAFF',
          recordId: updated.id,
          branch: updated.branch,
          oldValue: target.status,
          newValue: status,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1'
        });
      } catch (auditErr) {
        console.warn('[Users/PATCH] Non-blocking audit log warning:', auditErr);
      }

      return NextResponse.json({ success: true, user: stripSensitive(updated) });
    }

    if (action === 'update_role' && role) {
      // ONLY Super Admin can edit staff roles
      if (session.user.role !== 'superadmin') {
        return NextResponse.json(
          { error: 'Forbidden: Only Super Admin is authorized to edit staff roles' },
          { status: 403 }
        );
      }

      const updated = updateUserRole(userId, role, target);

      // Sync updated role to Firestore
      try {
        const { syncUserToFirestore } = await import('@/lib/firebase/firebase-admin');
        await syncUserToFirestore({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          mobile: updated.mobile,
          role: updated.role,
          status: updated.status,
          branch: updated.branch,
          specialization: updated.specialization,
          specializations: updated.specializations,
          startMonthYear: updated.startMonthYear,
          startDate: updated.startDate,
          endDate: updated.endDate,
          createdAt: updated.createdAt
        });
      } catch (fsErr) {
        console.warn('[Users/PATCH] Role Firestore sync note:', fsErr);
      }

      return NextResponse.json({ success: true, user: stripSensitive(updated) });
    }

    if (action === 'delete') {
      if (!canDeleteUser(session.user, target)) {
        if (target.role === 'superadmin') {
          return NextResponse.json(
            { error: 'Super Admin accounts cannot be deleted by anyone' },
            { status: 403 }
          );
        }
        if (target.role === 'admin' || target.role === 'hr') {
          return NextResponse.json(
            { error: 'Only Super Admin has permission to delete Admin and HR accounts' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to delete this user' },
          { status: 403 }
        );
      }
      const deleted = deleteUser(userId);

      // Clean up Firestore doc completely (by ID, email, gmail, mobile)
      try {
        const { deleteUserFromFirestore } = await import('@/lib/firebase/firebase-admin');
        await deleteUserFromFirestore(userId, target.email, target.mobile);
      } catch (fsErr) {
        console.warn('[Users/DELETE] Firestore doc delete note:', fsErr);
      }

      // Clean up Google Sheets subsheets
      try {
        const branchCode = BRANCH_NAME_TO_CODE[target.branch];
        const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
        if (spreadsheetId) {
          const { deleteStaffSubsheets } = await import('@/lib/sheets/sheets-service');
          await deleteStaffSubsheets(spreadsheetId, target.id);
        }
      } catch (sheetErr) {
        console.warn('[Users/DELETE] Subsheet delete note:', sheetErr);
      }

      return NextResponse.json({ success: deleted });
    }

    return NextResponse.json({ error: 'Invalid action requested' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
