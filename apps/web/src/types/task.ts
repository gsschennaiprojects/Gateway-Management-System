/**
 * Task Allocation & Notification Domain Models
 *
 * PURPOSE:
 * Defines task assignment structures, state-machine transitions, and team
 * broadcast notification models.
 *
 * TASK STATE MACHINE:
 * 1. `pending`: Newly assigned task awaiting acknowledgement.
 * 2. `in_progress`: Assignee has started working on the task (`startedAt` stamped).
 * 3. `completed`: Successfully finalized deliverable (`completedAt` stamped).
 * 4. `partially_stopped`: Work paused with a mandatory 10+ character explanation (`stoppedAt`, `stopReason`).
 *
 * DATA AUTHORITY:
 * Cloud Firestore (`tasks` and `task_history` collections).
 *
 * PROJECTIONS:
 * Synchronized to the per-staff `TSK_<staffId>` tab in the operational spreadsheet.
 */

import { UserRole, Branch } from './auth';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'partially_stopped';
export type TaskTargetType = 'individual' | 'group';

export interface TaskGroupTarget {
  name: string; // e.g. "All Interns - Coimbatore", "Gen AI Team", "HR Talent Ops"
  role?: UserRole;
  branch?: Branch | 'all';
  domain?: string;
}

export interface AssignedTask {
  id: string;
  title: string;
  description: string;
  assignedBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  targetType: TaskTargetType;
  targetUserId?: string;
  targetUserName?: string;
  targetUserRole?: UserRole;
  targetGroup?: TaskGroupTarget;
  assignedToUserIds: string[]; // List of user IDs receiving this task
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  createdAt: string;
}

export interface TaskNotification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'team_task' | 'system';
  taskId?: string;
  teamName?: string; // If assigned grouply, notify with team tag
  isRead: boolean;
  createdAt: string;
}
