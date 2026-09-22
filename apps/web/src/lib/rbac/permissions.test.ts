import {
  hasPermission,
  canManageTargetUser,
  canDeleteUser,
  canViewUserWorkLogs,
  canAssignTasks,
} from './permissions';
import { User } from '@/types/auth';

describe('RBAC Permissions & Hierarchical Authorization Engine', () => {
  const superadmin: User = {
    id: 'usr_superadmin',
    name: 'Super Admin',
    email: 'gateway.managercbe@gmail.com',
    role: 'superadmin',
    branch: 'Coimbatore',
    mobile: '+91 9876543210',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const adminCbe: User = {
    id: 'usr_admin_cbe',
    name: 'Admin Coimbatore',
    email: 'admin.cbe@gatewayskill.in',
    role: 'admin',
    branch: 'Coimbatore',
    mobile: '+91 9876543211',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const adminChn: User = {
    id: 'usr_admin_chn',
    name: 'Admin Chennai',
    email: 'admin.chn@gatewayskill.in',
    role: 'admin',
    branch: 'Chennai',
    mobile: '+91 9876543212',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const hrUser: User = {
    id: 'usr_hr_cbe',
    name: 'HR Manager',
    email: 'hr.cbe@gatewayskill.in',
    role: 'hr',
    branch: 'Coimbatore',
    mobile: '+91 9876543213',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const employeeCbe: User = {
    id: 'usr_emp_cbe',
    name: 'Employee Coimbatore',
    email: 'emp.cbe@gatewayskill.in',
    role: 'employee',
    branch: 'Coimbatore',
    mobile: '+91 9876543214',
    status: 'active',
    createdAt: '2026-01-01',
  };

  const internCbe: User = {
    id: 'usr_intern_cbe',
    name: 'Intern Coimbatore',
    email: 'intern.cbe@gatewayskill.in',
    role: 'intern',
    branch: 'Coimbatore',
    mobile: '+91 9876543215',
    status: 'active',
    createdAt: '2026-01-01',
  };

  describe('hasPermission', () => {
    it('grants all permissions to superadmin', () => {
      expect(hasPermission(superadmin, 'manage_users')).toBe(true);
      expect(hasPermission(superadmin, 'export_reports')).toBe(true);
      expect(hasPermission(superadmin, 'manage_leads')).toBe(true);
      expect(hasPermission(superadmin, 'approve_pending_users')).toBe(true);
    });

    it('grants branch management permissions to admin', () => {
      expect(hasPermission(adminCbe, 'manage_users')).toBe(true);
      expect(hasPermission(adminCbe, 'export_reports')).toBe(true);
      expect(hasPermission(adminCbe, 'manage_leads')).toBe(false); // leads are HR/Superadmin
    });

    it('restricts employee from administrative actions', () => {
      expect(hasPermission(employeeCbe, 'manage_users')).toBe(false);
      expect(hasPermission(employeeCbe, 'edit_employee_attendance')).toBe(false);
      expect(hasPermission(employeeCbe, 'manage_assigned_students')).toBe(true);
      expect(hasPermission(employeeCbe, 'view_employee_dashboard')).toBe(true);
    });
  });

  describe('canManageTargetUser', () => {
    it('allows superadmin to manage any user across any branch', () => {
      expect(canManageTargetUser(superadmin, adminCbe)).toBe(true);
      expect(canManageTargetUser(superadmin, adminChn)).toBe(true);
      expect(canManageTargetUser(superadmin, employeeCbe)).toBe(true);
    });

    it('allows admin to manage only users in their own branch', () => {
      expect(canManageTargetUser(adminCbe, employeeCbe)).toBe(true);
      expect(canManageTargetUser(adminCbe, internCbe)).toBe(true);
      expect(canManageTargetUser(adminCbe, adminChn)).toBe(false); // different branch
      expect(canManageTargetUser(adminCbe, superadmin)).toBe(false); // cannot manage superadmin
    });
  });

  describe('canDeleteUser', () => {
    it('never allows deleting superadmin under any circumstances', () => {
      expect(canDeleteUser(superadmin, superadmin)).toBe(false);
      expect(canDeleteUser(adminCbe, superadmin)).toBe(false);
    });

    it('allows only superadmin to delete admin or hr accounts', () => {
      expect(canDeleteUser(superadmin, adminCbe)).toBe(true);
      expect(canDeleteUser(superadmin, hrUser)).toBe(true);
      expect(canDeleteUser(adminCbe, hrUser)).toBe(false);
      expect(canDeleteUser(adminCbe, adminChn)).toBe(false);
    });

    it('allows branch admin to delete regular staff in their own branch', () => {
      expect(canDeleteUser(adminCbe, employeeCbe)).toBe(true);
      expect(canDeleteUser(adminCbe, internCbe)).toBe(true);
      expect(canDeleteUser(adminChn, employeeCbe)).toBe(false); // different branch
    });
  });

  describe('canViewUserWorkLogs', () => {
    it('allows superadmin to view all user worklogs', () => {
      expect(canViewUserWorkLogs(superadmin, employeeCbe)).toBe(true);
      expect(canViewUserWorkLogs(superadmin, adminChn)).toBe(true);
    });

    it('allows branch admin to view staff in their own branch', () => {
      expect(canViewUserWorkLogs(adminCbe, employeeCbe)).toBe(true);
      expect(canViewUserWorkLogs(adminChn, employeeCbe)).toBe(false);
    });

    it('allows employees to view only their own worklogs', () => {
      expect(canViewUserWorkLogs(employeeCbe, employeeCbe)).toBe(true);
      expect(canViewUserWorkLogs(employeeCbe, internCbe)).toBe(false);
    });
  });

  describe('canAssignTasks', () => {
    it('allows superadmin and admin to assign tasks', () => {
      expect(canAssignTasks(superadmin)).toBe(true);
      expect(canAssignTasks(adminCbe)).toBe(true);
      expect(canAssignTasks(hrUser)).toBe(false);
      expect(canAssignTasks(employeeCbe)).toBe(false);
    });
  });
});
