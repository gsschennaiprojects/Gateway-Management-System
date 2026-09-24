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

  // 1. Authoritative Firestore Fetch
  let firestoreTasks: any[] = [];
  try {
    const { getFirestoreTasks } = await import('@/lib/firebase/firebase-admin');
    firestoreTasks = await getFirestoreTasks({ role, userId, branch });
  } catch (err) {
    console.warn('[Tasks/GET] Firestore fetch notice:', err);
  }

  // 2. In-memory fallback / merge
  const inMemAll = getAllTasks();
  let filteredInMem: any[] = [];
  if (role === 'superadmin') {
    filteredInMem = inMemAll;
  } else if (role === 'admin') {
    filteredInMem = inMemAll.filter(
      (t) =>
        t.assignedBy?.id === userId ||
        (t.targetGroup?.branch === branch) ||
        t.assignedToUserIds?.includes(userId)
    );
  } else {
    filteredInMem = getTasksForUser(userId);
  }

  // 3. Deduplicate by ID with Firestore as source of truth
  const taskMap = new Map<string, any>();
  for (const t of filteredInMem) {
    taskMap.set(t.id, t);
  }
  for (const ft of firestoreTasks) {
    taskMap.set(ft.id, ft);
  }

  const tasks = Array.from(taskMap.values()).sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only Admin and Super Admin can assign tasks
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

    // 1. Authoritative Firestore Persistence
    try {
      await syncTaskToFirestore({
        id: newTask.id,
        title: newTask.title,
        description: newTask.description,
        assignedBy: newTask.assignedBy,
        targetType: newTask.targetType,
        targetUserId: newTask.targetUserId,
        targetUserName: newTask.targetUserName,
        targetUserRole: newTask.targetUserRole,
        targetGroup: newTask.targetGroup,
        assignedToUserIds: newTask.assignedToUserIds,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        status: newTask.status,
        createdAt: newTask.createdAt
      });

      // Also persist notifications to Firestore
      const { syncNotificationToFirestore } = await import('@/lib/firebase/firebase-admin');
      for (const recipientId of newTask.assignedToUserIds) {
        const isGroup = newTask.targetType === 'group';
        await syncNotificationToFirestore({
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          recipientId,
          title: isGroup
            ? `Team Task: ${newTask.targetGroup?.name}`
            : 'New Task Assigned to You',
          message: isGroup
            ? `${newTask.assignedBy.name} (${newTask.assignedBy.role}) assigned team task for ${newTask.targetGroup?.name}: "${newTask.title}"`
            : `${newTask.assignedBy.name} (${newTask.assignedBy.role}) assigned you task: "${newTask.title}"`,
          type: isGroup ? 'team_task' : 'task_assigned',
          taskId: newTask.id,
          teamName: isGroup ? newTask.targetGroup?.name : undefined,
          isRead: false,
          createdAt: newTask.createdAt
        });
      }
    } catch (fsErr) {
      console.warn('[Tasks/POST] Firestore sync note:', fsErr);
    }

    // 2. Non-blocking Google Sheets projection
    try {
      const branchName = session.user.branch;
      const branchCode = BRANCH_NAME_TO_CODE[branchName];
      const spreadsheetId = branchCode ? BRANCH_SPREADSHEET_MAP[branchCode] : null;

      if (spreadsheetId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const assignedToName = targetUserId || targetGroup?.name || 'Assigned Staff';
        
        await Promise.race([
          (async () => {
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
          })(),
          new Promise((resolve) => setTimeout(resolve, 3500))
        ]);
      }
    } catch (sheetErr) {
      console.warn('[Tasks/POST] Google Sheets projection note:', sheetErr);
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

    // Sync updated task to Firestore authoritatively
    try {
      const { updateFirestoreTaskStatus } = await import('@/lib/firebase/firebase-admin');
      await updateFirestoreTaskStatus(taskId, status);
    } catch (fsErr) {
      console.warn('[Tasks/PATCH] Firestore sync note:', fsErr);
    }

    return NextResponse.json({ task: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update task';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
