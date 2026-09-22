import { AssignedTask, TaskNotification, TaskPriority, TaskStatus, TaskGroupTarget } from '@/types/task';
import { UserRole, Branch } from '@/types/auth';
import { getAllUsers } from '@/lib/auth/user-store';

// Runtime in-memory stores for server handlers
let serverTasks: AssignedTask[] = [];

let serverNotifications: TaskNotification[] = [];

export function getAllTasks(): AssignedTask[] {
  return serverTasks;
}

export function getTasksForUser(userId: string): AssignedTask[] {
  return serverTasks.filter((t) => t.assignedToUserIds.includes(userId));
}

export function getTasksAssignedByUser(userId: string): AssignedTask[] {
  return serverTasks.filter((t) => t.assignedBy.id === userId);
}

export interface CreateTaskInput {
  title: string;
  description: string;
  assignedBy: {
    id: string;
    name: string;
    role: UserRole;
  };
  targetType: 'individual' | 'group';
  targetUserId?: string;
  targetGroup?: TaskGroupTarget;
  priority: TaskPriority;
  dueDate: string;
}

export function createTask(input: CreateTaskInput): AssignedTask {
  const allUsers = getAllUsers();
  let targetUserIds: string[] = [];
  let targetUserName: string | undefined;
  let targetUserRole: UserRole | undefined;

  if (input.targetType === 'individual') {
    if (!input.targetUserId) {
      throw new Error('Target user ID is required for individual task assignment.');
    }
    const targetUser = allUsers.find((u) => u.id === input.targetUserId);
    if (!targetUser) {
      throw new Error('Target user not found.');
    }
    targetUserIds = [targetUser.id];
    targetUserName = targetUser.name;
    targetUserRole = targetUser.role;
  } else {
    if (!input.targetGroup || !input.targetGroup.name) {
      throw new Error('Group target specification is required for group task assignment.');
    }
    // Filter matching users
    const matched = allUsers.filter((u) => {
      if (u.status !== 'active') return false;
      if (input.targetGroup?.role && u.role !== input.targetGroup.role) return false;
      if (
        input.targetGroup?.branch &&
        input.targetGroup.branch !== 'all' &&
        u.branch !== input.targetGroup.branch
      ) {
        return false;
      }
      if (
        input.targetGroup?.domain &&
        !u.specialization?.toLowerCase().includes(input.targetGroup.domain.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    targetUserIds = matched.map((u) => u.id);
    if (targetUserIds.length === 0) {
      // Fallback: assign to active users of that role or branch so demo does not error
      const fallback = allUsers.filter((u) => u.status === 'active' && ['intern', 'employee', 'hr'].includes(u.role));
      targetUserIds = fallback.map((u) => u.id);
    }
  }

  const taskId = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newTask: AssignedTask = {
    id: taskId,
    title: input.title.trim(),
    description: input.description.trim(),
    assignedBy: input.assignedBy,
    targetType: input.targetType,
    targetUserId: input.targetUserId,
    targetUserName,
    targetUserRole,
    targetGroup: input.targetGroup,
    assignedToUserIds: targetUserIds,
    priority: input.priority || 'medium',
    dueDate: input.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    status: 'pending',
    createdAt: now
  };

  serverTasks.unshift(newTask);

  // Dispatch notifications for each recipient
  targetUserIds.forEach((recipientId) => {
    const isGroup = input.targetType === 'group';
    const notification: TaskNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId,
      title: isGroup
        ? `Team Task: ${input.targetGroup?.name}`
        : 'New Task Assigned to You',
      message: isGroup
        ? `${input.assignedBy.name} (${input.assignedBy.role}) assigned team task for ${input.targetGroup?.name}: "${input.title}"`
        : `${input.assignedBy.name} (${input.assignedBy.role}) assigned you task: "${input.title}"`,
      type: isGroup ? 'team_task' : 'task_assigned',
      taskId,
      teamName: isGroup ? input.targetGroup?.name : undefined,
      isRead: false,
      createdAt: now
    };
    serverNotifications.unshift(notification);
  });

  return newTask;
}

export function updateTaskStatus(taskId: string, status: TaskStatus): AssignedTask {
  const task = serverTasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error('Task not found.');
  }
  task.status = status;
  return task;
}

export function getNotificationsForUser(recipientId: string): TaskNotification[] {
  return serverNotifications.filter((n) => n.recipientId === recipientId);
}

export function markNotificationAsRead(notificationId: string): boolean {
  const notif = serverNotifications.find((n) => n.id === notificationId);
  if (!notif) return false;
  notif.isRead = true;
  return true;
}

export function markAllNotificationsAsRead(recipientId: string): void {
  serverNotifications.forEach((n) => {
    if (n.recipientId === recipientId) {
      n.isRead = true;
    }
  });
}
