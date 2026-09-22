import { Branch } from './auth';

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
  email?: string;
  mobile?: string;
  college: string;
  domain: string;
  branch: Branch;
  mentorName: string;
  mentorRole: string;
  feeStatus: 'paid' | 'partial' | 'pending';
  startDate: string; // Format: YYYY-MM-DD (e.g. 2026-07-01)
  endDate: string;   // Format: YYYY-MM-DD (e.g. 2026-09-30)
  duration: string;  // e.g. "3 Months"
  projectTitle: string;
  projectCompleted: boolean;
  todayStatus: 'present' | 'absent' | 'holiday';
  yesterdayTaskDone: boolean;
  // Day-by-day attendance for calendar days (1..30)
  dailyAttendance: Record<number, 'present' | 'absent' | 'holiday'>;
  // Day-by-day task deliverables (1..30)
  dailyTasks: Record<number, { title: string; completed: boolean }>;
}

export function calculateDuration(startDateStr: string, endDateStr: string): string {
  if (!startDateStr || !endDateStr) return '';
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return '';

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 45) {
    const weeks = Math.max(1, Math.round(diffDays / 7));
    return weeks === 1 ? '1 Week' : `${weeks} Weeks`;
  }
  
  const months = Math.max(1, Math.round(diffDays / 30.4375));
  return months === 1 ? '1 Month' : `${months} Months`;
}

export function formatStudentDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function calculateTenureProgress(startDateStr: string, endDateStr: string): {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  percentage: number;
} {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const now = new Date('2026-09-12T00:00:00'); // Consistent system date September 12, 2026

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return { totalDays: 90, elapsedDays: 45, remainingDays: 45, percentage: 50 };
  }

  const totalTime = end.getTime() - start.getTime();
  const totalDays = Math.ceil(totalTime / (1000 * 60 * 60 * 24));

  const elapsedTime = Math.max(0, now.getTime() - start.getTime());
  const elapsedDays = Math.min(totalDays, Math.ceil(elapsedTime / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const percentage = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  return { totalDays, elapsedDays, remainingDays, percentage };
}

// September 2026 working days (omitting Sundays: Sep 6, 13, 20, 27)
export const SEP_WORKING_DAYS = [
  1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 28, 29, 30
];
export const INITIAL_STUDENTS_DATA: Student[] = [];

