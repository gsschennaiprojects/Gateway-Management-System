import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getAllTasks,
  getTasksForUser,
  getTasksAssignedByUser,
  createTask,
  updateTaskStatus
} from '@/lib/tasks/task-store';
import { syncTaskToFirestore } from '@/lib/firebase/firebase-admin';
import { appendBranchTaskAllocation, upsertTask } from '@/lib/sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP, BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';

export const dynamic = 'force-dynamic';

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

    // 1. Dual persistence: Sync to Firebase Firestore
    try {
      await syncTaskToFirestore({
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        assignedBy: newTask.assignedBy,
        targetType: newTask.targetType,
        targetUserId: newTask.targetUserId,
        targetGroup: newTask.targetGroup,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        status: newTask.status,
        createdAt: newTask.createdAt
      });
    } catch (fsErr) {
      console.warn('[Tasks/POST] Firestore sync note:', fsErr);
    }

    // 2. Dual persistence: Sync to Google Sheets (Master 05_Task_Allocation + Staff TSK_<ID> tab)
    try {
      const branchName = session.user.branch;
      const branchCode = BRANCH_NAME_TO_CODE[branchName];
      const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;

      if (spreadsheetId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const assignedToName = targetUserId || targetGroup?.name || 'Assigned Staff';
        
        // Master 05_Task_Allocation
        await appendBranchTaskAllocation(spreadsheetId, {
          taskId: newTask.id,
          dateAssigned: todayStr,
          assignedById: session.user.id,
          assignedByName: session.user.name,
          assignedToId: targetUserId || 'GROUP',
          assignedToName,
          taskTitle: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          category: 'Operations',
          startDate: todayStr,
          dueDate: newTask.dueDate || todayStr,
          completedDate: '-',
          status: newTask.status,
          progressPct: '0%',
          remarks: ''
        });

        // Dedicated operational subsheet TSK_<ID> if individual assignment
        if (targetUserId) {
          await upsertTask(spreadsheetId, targetUserId, {
            taskId: newTask.id,
            dateAssigned: todayStr,
            assignedById: session.user.id,
            assignedByName: session.user.name,
            taskTitle: newTask.title,
            description: newTask.description,
            priority: (newTask.priority?.charAt(0).toUpperCase() + newTask.priority?.slice(1)) as any,
            category: 'Operations',
            startDate: todayStr,
            dueDate: newTask.dueDate || todayStr,
            completedDate: '-',
            status: 'Assigned',
            progressPct: '0%',
            remarks: ''
          });
        }
      }
    } catch (sheetErr) {
      console.warn('[Tasks/POST] Google Sheets sync note:', sheetErr);
    }

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

    // Sync updated task to Firestore
    try {
      await syncTaskToFirestore({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        assignedBy: updated.assignedBy,
        targetType: updated.targetType,
        targetUserId: updated.targetUserId,
        targetGroup: updated.targetGroup,
        priority: updated.priority,
        dueDate: updated.dueDate,
        status: updated.status,
        createdAt: updated.createdAt
      });
    } catch (fsErr) {
      console.warn('[Tasks/PATCH] Firestore sync note:', fsErr);
    }

    return NextResponse.json({ task: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update task';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
