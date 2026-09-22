import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getAllTasks,
  getTasksForUser,
  getTasksAssignedByUser,
  createTask,
  updateTaskStatus
} from '@/lib/tasks/task-store';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, id: userId, branch } = session.user;
  const all = getAllTasks();

  if (role === 'superadmin') {
    // Super Admin can see all tasks
    return NextResponse.json({ tasks: all });
  }

  if (role === 'admin') {
    // Admin can see tasks created by them, or tasks targeting their branch
    const adminTasks = all.filter(
      (t) =>
        t.assignedBy.id === userId ||
        (t.targetGroup?.branch === branch) ||
        t.assignedToUserIds.includes(userId)
    );
    return NextResponse.json({ tasks: adminTasks });
  }

  // HR, Employee, Intern: see tasks assigned to them
  const myTasks = getTasksForUser(userId);
  return NextResponse.json({ tasks: myTasks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Admin and Super Admin can assign tasks per user requirement:
  // "also the Admin and Super Admin can assign task for HR, Employee and Intern"
  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: Only Admin and Super Admin can assign tasks.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { title, description, targetType, targetUserId, targetGroup, priority, dueDate } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required.' }, { status: 400 });
    }

    if (targetType === 'individual' && !targetUserId) {
      return NextResponse.json(
        { error: 'Target user must be specified for individual task assignment.' },
        { status: 400 }
      );
    }

    if (targetType === 'group' && (!targetGroup || !targetGroup.name)) {
      return NextResponse.json(
        { error: 'Target group details must be specified for group task assignment.' },
        { status: 400 }
      );
    }

    // Branch Admin validation: Admin can only target their own branch
    if (session.user.role === 'admin' && targetGroup) {
      targetGroup.branch = session.user.branch;
    }

    const newTask = createTask({
      title,
      description: description || '',
      assignedBy: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role
      },
      targetType: targetType || 'individual',
      targetUserId,
      targetGroup,
      priority: priority || 'medium',
      dueDate: dueDate || ''
    });

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create task';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { taskId, status } = body;

    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId and status are required.' }, { status: 400 });
    }

    const updated = updateTaskStatus(taskId, status);
    return NextResponse.json({ task: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update task';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
