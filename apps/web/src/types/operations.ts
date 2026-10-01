import { Branch, UserRole } from './auth';

/**
 * Course Catalog & Curriculum Definition
 * Used to standardize academic and professional training programs.
 */
export interface Course {
  id: string;
  courseId: string;
  name: string;
  code: string;
  domain: string;
  durationWeeks: number;
  description?: string;
  syllabusTopics?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Cohort Training Batches
 * Groups students into cohorts for streamlined mentor assignment, bulk tasking, and attendance.
 */
export interface Batch {
  id: string;
  batchId: string;
  batchCode: string; // e.g. "CHN-AIML-2026-01"
  name: string;
  courseId: string;
  courseName: string;
  branch: Branch;
  branchId: string;
  mentorId: string;
  mentorName: string;
  startDate: string;
  endDate?: string;
  status: 'upcoming' | 'active' | 'completed' | 'paused';
  studentCount: number;
  maxCapacity: number;
  studentIds?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Student Daily Attendance Record
 * Tracks individual student lab/training attendance per batch and date.
 */
export type StudentAttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface StudentAttendance {
  id: string; // "att_student_{studentId}_{date}"
  studentId: string;
  studentName: string;
  batchId: string;
  batchCode: string;
  branch: Branch;
  branchId: string;
  date: string; // "YYYY-MM-DD"
  status: StudentAttendanceStatus;
  markedBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Leave Application & Approval Management
 * Handles staff and intern leave requests with multi-tier approval.
 */
export type LeaveType = 'casual' | 'sick' | 'permission' | 'emergency';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantRole: UserRole;
  branch: Branch;
  branchId: string;
  leaveType: LeaveType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  daysCount: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: {
    id: string;
    name: string;
    role: UserRole;
  };
  reviewedAt?: string;
  reviewerRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Internal Announcements & Broadcast Notices
 * Enables Super Admin and Branch Admins to broadcast messages targeted by branch/role.
 */
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetBranch: 'all' | Branch;
  targetRoles: UserRole[] | 'all';
  author: {
    id: string;
    name: string;
    role: UserRole;
  };
  pinned: boolean;
  expiresAt?: string;
  readBy?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Pre-Computed Branch Performance Metrics & Analytics Cache
 * Eliminates full-collection scans for instantaneous dashboard rendering.
 */
export interface BranchMetrics {
  id: string; // "metrics_{branchId}_{period}"
  branch: Branch;
  branchId: string;
  period: string; // "YYYY-MM" or "YYYY-MM-DD"
  type: 'daily' | 'monthly';
  totalStudents: number;
  activeStudents: number;
  completedStudents: number;
  totalStaff: number;
  activeStaff: number;
  staffAttendanceRate: number; // percentage (0-100)
  studentAttendanceRate: number; // percentage (0-100)
  tasksTotal: number;
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  taskCompletionRate: number; // percentage (0-100)
  totalLeads: number;
  convertedLeads: number;
  leadConversionRate: number; // percentage (0-100)
  lastAggregatedAt: string;
}
