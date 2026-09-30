/**
 * Daily Worklog & Attendance Domain Models
 *
 * PURPOSE:
 * Tracks daily staff and intern attendance, punch-in/out timestamps, planned tasks,
 * completed deliverables, and monthly operational summaries.
 *
 * WORKFLOW:
 * 1. Punch In: Records arrival timestamp (`loginTime`), initializing planned tasks.
 * 2. Save Progress: Mid-day updates to task bullet points.
 * 3. Punch Out: Finalizes `logoutTime`, calculates `hoursLogged`, and requires an
 *    incomplete reason if planned deliverables remain uncompleted.
 *
 * DATA AUTHORITY:
 * Cloud Firestore (`daily_worklogs` collection).
 *
 * PROJECTIONS:
 * Synchronized to the per-staff `WL_<staffId>` tab and central `04_Staff_Attendance` tab.
 */

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
