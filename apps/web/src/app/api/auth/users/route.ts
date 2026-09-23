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
import { syncUserToFirestore, getAdminFirestore } from '@/lib/firebase/firebase-admin';
import { upsertStaffDirectory, createStaffSubsheets, deleteStaffSubsheets } from '@/lib/sheets/sheets-service';
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

  // Super Admin can view all branches or filter by branch via query param
  if (session.user.role === 'superadmin') {
    const { searchParams } = new URL(req.url);
    const branchParam = searchParams.get('branch');
    const all = branchParam ? getUsersByBranch(branchParam as any) : getAllUsers();
    return NextResponse.json({ users: all.map(stripSensitive) });
  }

  // Admin and HR have strictly scoped access to their OWN branch per requirement:
  // "the admin have only ccess to see the employee and their sudent detail in their branch"
  const branchUsers = getUsersByBranch(session.user.branch);
  return NextResponse.json({ users: branchUsers.map(stripSensitive) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Super Admin and Admin can approve, reject, or assign/change roles
  // "the super admin and admin(only for heir branch) want perissionon for assign and chang roles"
  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, action, status, role } = body;

    const target = findUserById(userId);
    if (!target) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Enforce branch isolation for Admin
    if (!canManageTargetUser(session.user, target)) {
      return NextResponse.json(
        { error: `Forbidden: You can only manage personnel within your branch (${session.user.branch})` },
        { status: 403 }
      );
    }

    if (action === 'update_status' && status) {
      const updated = updateUserStatus(userId, status);

      // 1. Dual persistence: Sync to Firebase Firestore
      try {
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
      // Both Super Admin (any branch) and Admin (their branch) can assign and change roles!
      // Admin cannot promote someone to superadmin
      if (session.user.role === 'admin' && role === 'superadmin') {
        return NextResponse.json(
          { error: 'Admins cannot promote users to Super Admin' },
          { status: 403 }
        );
      }

      const updated = updateUserRole(userId, role);

      // Sync updated role to Firestore
      try {
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

      // Clean up Firestore doc
      try {
        const db = getAdminFirestore();
        if (db) {
          await db.collection('users').doc(userId).delete();
        }
      } catch (fsErr) {
        console.warn('[Users/DELETE] Firestore doc delete note:', fsErr);
      }

      // Clean up Google Sheets subsheets
      try {
        const branchCode = BRANCH_NAME_TO_CODE[target.branch];
        const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;
        if (spreadsheetId) {
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
