import { WorkLogEntry, StaffMonthlySummary } from '@/types/worklog';
import { User, UserRole, Branch } from '@/types/auth';
import { getAllUsers, findUserById } from '@/lib/auth/user-store';

// Runtime work logs store
let serverWorkLogs: WorkLogEntry[] = [];

/**
 * Filter work logs according to strict hierarchical security rules:
 * - Super Admin: Can view work logs of ALL roles (Admin, HR, Employee, Intern) across all branches.
 * - Admin: Can view work logs of Employees and Interns strictly in their own branch.
 * - HR: Can view work logs of Employees and Interns across the system.
 * - Employee/Intern: Can only view their own work logs.
 */
export function getWorkLogs(actor: User, filter?: { targetUserId?: string; branch?: Branch | 'all'; date?: string }): WorkLogEntry[] {
  let logs = [...serverWorkLogs];

  if (actor.role === 'superadmin') {
    // Super Admin can see everyone
    if (filter?.branch && filter.branch !== 'all') {
      logs = logs.filter((l) => l.branch === filter.branch);
    }
    if (filter?.targetUserId) {
      logs = logs.filter((l) => l.userId === filter.targetUserId);
    }
  } else if (actor.role === 'admin') {
    // Admin can ONLY see employees and interns in their own branch
    logs = logs.filter(
      (l) =>
        l.branch === actor.branch &&
        ['employee', 'intern'].includes(l.userRole)
    );
    if (filter?.targetUserId) {
      logs = logs.filter((l) => l.userId === filter.targetUserId);
    }
  } else if (actor.role === 'hr') {
    // HR can see employees and interns
    logs = logs.filter((l) => ['employee', 'intern'].includes(l.userRole));
    if (filter?.targetUserId) {
      logs = logs.filter((l) => l.userId === filter.targetUserId);
    }
  } else {
    // Employee or Intern can only see their own logs
    logs = logs.filter((l) => l.userId === actor.id);
  }

  if (filter?.date) {
    logs = logs.filter((l) => l.date === filter.date);
  }

  return logs;
}

export function getWorkLogsForUser(actor: User, targetUserId: string): WorkLogEntry[] {
  return getWorkLogs(actor, { targetUserId });
}

export function getStaffMonthlySummary(targetUserId: string): StaffMonthlySummary {
  const user = findUserById(targetUserId) || getAllUsers().find((u) => u.id === targetUserId);
  const userLogs = serverWorkLogs.filter((l) => l.userId === targetUserId);

  const totalPlanned = userLogs.reduce((sum, l) => sum + l.plannedTasks.length, 0);
  const totalCompleted = userLogs.reduce((sum, l) => sum + l.completedTasks.length, 0);
  const presentDays = userLogs.filter((l) => l.attendanceStatus === 'present').length;
  const workingDays = 26; // Working days in Sep 2026

  return {
    userId: targetUserId,
    userName: user?.name || 'Staff Member',
    userRole: user?.role || 'employee',
    branch: user?.branch || 'Coimbatore',
    month: 'September 2026',
    totalWorkingDays: workingDays,
    presentDays,
    absentDays: 0,
    holidayDays: 0,
    attendanceRate: workingDays > 0 ? Math.round((presentDays / workingDays) * 1000) / 10 : 0,
    totalPlannedTasks: totalPlanned,
    totalCompletedTasks: totalCompleted,
    completionRate: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
    assignedStudentsCount: 0
  };
}

export function addWorkLog(entry: Omit<WorkLogEntry, 'id'> & { id?: string }): WorkLogEntry {
  const targetId = entry.id || `wlg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const existingIndex = serverWorkLogs.findIndex(
    (l) => l.id === targetId || (l.userId === entry.userId && (l.date === entry.date || l.date.replace(/-/g, '') === entry.date.replace(/-/g, '')))
  );

  if (existingIndex !== -1) {
    const existing = serverWorkLogs[existingIndex];
    const merged: WorkLogEntry = {
      ...existing,
      ...entry,
      id: existing.id || targetId,
      loginTime: entry.loginTime !== undefined ? entry.loginTime : existing.loginTime,
      logoutTime: entry.logoutTime !== undefined ? entry.logoutTime : existing.logoutTime,
      plannedTasks: Array.isArray(entry.plannedTasks) && entry.plannedTasks.length > 0 ? entry.plannedTasks : existing.plannedTasks,
      completedTasks: Array.isArray(entry.completedTasks) && entry.completedTasks.length > 0 ? entry.completedTasks : existing.completedTasks,
      incompleteReason: entry.incompleteReason !== undefined ? entry.incompleteReason : existing.incompleteReason,
      hoursLogged: entry.hoursLogged !== undefined ? entry.hoursLogged : existing.hoursLogged,
      totalHours: entry.totalHours !== undefined ? entry.totalHours : existing.totalHours,
    };
    serverWorkLogs[existingIndex] = merged;
    return merged;
  }

  const newEntry: WorkLogEntry = {
    id: targetId,
    ...entry,
  };
  serverWorkLogs.unshift(newEntry);
  return newEntry;
}

export function clearTodayWorkLog(userId: string, date: string): void {
  serverWorkLogs = serverWorkLogs.filter((l) => !(l.userId === userId && (l.date === date || l.date.replace(/-/g, '') === date.replace(/-/g, ''))));
}


