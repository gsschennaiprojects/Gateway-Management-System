import { UserRole, Branch } from './auth';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
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
