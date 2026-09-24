import { UserRole, Branch } from './auth';

export interface WorkLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  branch: Branch;
  date: string; // YYYY-MM-DD
  loginTime: string | null; // e.g. "09:15 AM"
  logoutTime: string | null; // e.g. "06:30 PM"
  plannedTasks: string[];
  completedTasks: string[];
  incompleteReason?: string;
  attendanceStatus: 'present' | 'absent' | 'holiday';
  hoursLogged?: number;
  totalHours?: string | number;
}

export interface StaffMonthlySummary {
  userId: string;
  userName: string;
  userRole: UserRole;
  branch: Branch;
  month: string; // e.g. "September 2026"
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  holidayDays: number;
  attendanceRate: number;
  totalPlannedTasks: number;
  totalCompletedTasks: number;
  completionRate: number;
  assignedStudentsCount: number;
}
