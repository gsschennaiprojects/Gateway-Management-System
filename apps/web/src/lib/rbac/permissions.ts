import { UserRole, User } from '@/types/auth';

export type Permission =
  | 'view_employee_dashboard'
  | 'mark_own_attendance'
  | 'manage_assigned_students'
  | 'view_employee_directory'
  | 'edit_employee_attendance'
  | 'view_employee_attendance_readonly'
  | 'manage_leads'
  | 'manage_email_campaigns'
  | 'manage_users'
  | 'assign_roles'
  | 'approve_pending_users'
  | 'assign_tasks'
  | 'view_work_logs'
  | 'download_individual_reports'
  | 'view_reports'
  | 'export_reports'
  | 'view_audit_logs';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [
    'view_employee_dashboard',
    'mark_own_attendance',
    'manage_assigned_students',
    'view_employee_directory',
    'edit_employee_attendance',
    'view_employee_attendance_readonly',
    'manage_leads',
    'manage_email_campaigns',
    'manage_users',
    'assign_roles',
    'approve_pending_users',
    'assign_tasks',
    'view_work_logs',
    'download_individual_reports',
    'view_reports',
    'export_reports',
    'view_audit_logs'
  ],
  admin: [
    'view_employee_dashboard',
    'mark_own_attendance',
    'manage_assigned_students',
    'view_employee_directory',
    'edit_employee_attendance',
    'view_employee_attendance_readonly',
    'manage_users', // scoped to their branch
    'assign_roles', // scoped to their branch
    'approve_pending_users', // scoped to their branch
    'assign_tasks', // for HR, Employee, Intern
    'view_work_logs', // for Employee, Intern in their branch
    'download_individual_reports',
    'view_reports',
    'export_reports',
    'view_audit_logs'
  ],
  hr: [
    'view_employee_directory',
    'view_employee_attendance_readonly',
    'manage_leads',
    'manage_email_campaigns',
    'view_work_logs', // for Employee, Intern
    'download_individual_reports',
    'view_reports'
  ],
  employee: [
    'view_employee_dashboard',
    'mark_own_attendance',
    'manage_assigned_students',
    'view_work_logs', // own logs
    'view_reports',
    'export_reports'
  ],
  intern: [
    'view_employee_dashboard',
    'mark_own_attendance',
    'manage_assigned_students',
    'view_work_logs', // own logs
    'view_reports',
    'export_reports'
  ]
};

export function hasPermission(roleOrUser: UserRole | User, permission: Permission): boolean {
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser.role;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getDefaultDashboardRoute(role: UserRole): string {
  switch (role) {
    case 'superadmin':
    case 'admin':
      return '/admin/directory';
    case 'hr':
      return '/leads';
    case 'employee':
    case 'intern':
    default:
      return '/dashboard';
  }
}

/**
 * Check if the actor can view or manage targetUser.
 * Super Admin can access all branches.
 * Admin can only access targetUser if targetUser is in the same branch.
 */
export function canManageTargetUser(actor: User, targetUser: User): boolean {
  if (actor.role === 'superadmin') return true;

  if (actor.role === 'admin') {
    // Admin cannot modify superadmins
    if (targetUser.role === 'superadmin') return false;
    // Admin can only manage users in their own branch
    return actor.branch === targetUser.branch;
  }

  return false;
}

/**
 * Strict deletion permissions:
 * - Super Admin can NEVER be deleted by anyone.
 * - Admin and HR can ONLY be deleted by Super Admin.
 * - Admins and HR do NOT have access to delete Super Admin, Admins, or HR.
 * - Admins can only delete regular staff (employees/interns) in their own branch.
 */
export function canDeleteUser(actor: User, targetUser: User): boolean {
  // Super Admin can NEVER be deleted by anyone
  if (targetUser.role === 'superadmin') return false;

  // ONLY Super Admin has permission to delete Admin and HR accounts
  if (targetUser.role === 'admin' || targetUser.role === 'hr') {
    return actor.role === 'superadmin';
  }

  // Super Admin has permission to delete staff
  if (actor.role === 'superadmin') return true;

  // Admin can only delete employees/interns in their own branch
  if (actor.role === 'admin') {
    return actor.branch === targetUser.branch && ['employee', 'intern'].includes(targetUser.role);
  }

  // HR or others cannot delete accounts
  return false;
}

/**
 * Work Log inspection permissions:
 * - Super Admin can see work logs of ALL users (Admin, HR, Employee, Intern) across all branches.
 * - Admin can see work logs of Employees and Interns in their branch.
 * - HR can see work logs of Employees and Interns across the system.
 * - Employee and Intern can only see their own work logs.
 */
export function canViewUserWorkLogs(actor: User, targetUser: User): boolean {
  if (actor.role === 'superadmin') return true;

  if (actor.role === 'admin') {
    return actor.branch === targetUser.branch && ['employee', 'intern'].includes(targetUser.role);
  }

  if (actor.role === 'hr') {
    return ['employee', 'intern'].includes(targetUser.role);
  }

  return actor.id === targetUser.id;
}

/**
 * Task assignment permission:
 * Admin and Super Admin can assign tasks to HR, Employee, and Intern.
 */
export function canAssignTasks(actor: User): boolean {
  return ['superadmin', 'admin'].includes(actor.role);
}
