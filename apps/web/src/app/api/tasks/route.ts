import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreTasks, getFirestoreUsers } from '@/lib/firebase/firebase-admin';
import type { TaskPriority, TaskStatus } from '@/types/task';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const tasks = await getFirestoreTasks({ role: session.user.role, userId: session.user.id, branch: session.user.branch });
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: 'Tasks are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (!['admin', 'superadmin'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (hasOversizedBody(request, 20_000)) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid task.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const targetType = input.targetType === 'group' ? 'group' : input.targetType === 'individual' || input.targetType === undefined ? 'individual' : null;
    const priority = input.priority || 'medium';
    const dueDate = input.dueDate === undefined || input.dueDate === '' ? '' : input.dueDate;
    if (!title || title.length > 200 || description.length > 3000 || !targetType || !['low', 'medium', 'high', 'urgent'].includes(String(priority)) ||
        (dueDate !== '' && (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))))) {
      return NextResponse.json({ error: 'Please provide valid task details.' }, { status: 400 });
    }
    const users = await getFirestoreUsers();
    let recipients = [] as typeof users;
    if (targetType === 'individual') {
      if (typeof input.targetUserId !== 'string') return NextResponse.json({ error: 'Select a task assignee.' }, { status: 400 });
      const target = users.find(user => user.id === input.targetUserId || user.uid === input.targetUserId);
      if (!target || target.status !== 'active' || (session.user.role !== 'superadmin' && target.branch !== session.user.branch)) {
        return NextResponse.json({ error: 'Task assignee is unavailable.' }, { status: 404 });
      }
      recipients = [target];
    } else {
      const group = input.targetGroup as { name?: unknown; role?: unknown; branch?: unknown; domain?: unknown } | undefined;
      if (!group || typeof group.name !== 'string' || group.name.trim().length < 2 || group.name.length > 100) return NextResponse.json({ error: 'Select a valid task group.' }, { status: 400 });
      const branch = session.user.role === 'superadmin' && typeof group.branch === 'string' ? group.branch : session.user.branch;
      recipients = users.filter(user => user.status === 'active' && user.branch === branch &&
        (!group.role || user.role === group.role) && (!group.domain || user.specialization?.toLowerCase().includes(String(group.domain).toLowerCase())));
    }
    if (!recipients.length || recipients.length > 450) return NextResponse.json({ error: 'Task has no eligible assignees or exceeds the assignment limit.' }, { status: 400 });
    if (session.user.role === 'admin' && recipients.some(user => !['hr', 'employee', 'intern'].includes(user.role))) return NextResponse.json({ error: 'Admins may assign tasks only to HR, employees, and interns.' }, { status: 403 });
    const db = getAdminFirestore();
    if (!db) return NextResponse.json({ error: 'Task storage is unavailable.' }, { status: 503 });
    const now = new Date().toISOString();
    const id = `task_${randomUUID()}`;
    const branchId = recipients[0].branch.toUpperCase();
    const task = {
      id, title, description, assignedBy: { id: session.user.id, uid: session.uid, name: session.user.name, role: session.user.role },
      createdByUid: session.uid, branch: recipients[0].branch, branchId,
      targetType, targetUserId: targetType === 'individual' ? recipients[0].id : undefined,
      targetUserName: targetType === 'individual' ? recipients[0].name : undefined,
      targetUserRole: targetType === 'individual' ? recipients[0].role : undefined,
      targetGroup: targetType === 'group' ? input.targetGroup : undefined,
      assignedToUserIds: recipients.map(user => user.id), priority: priority as TaskPriority,
      dueDate, status: 'pending' as TaskStatus, createdAt: now, updatedAt: now,
    };
    const taskRef = db.collection('tasks').doc(id);
    const projectionRef = db.collection('projection_jobs').doc(`task:${id}:created`);
    await db.runTransaction(async transaction => {
      transaction.create(taskRef, task);
      transaction.create(db.collection('task_history').doc(`${id}:created`), { taskId: id, actorUid: session.uid, fromStatus: null, toStatus: 'pending', createdAt: now });
      transaction.create(projectionRef, { id: projectionRef.id, type: 'task.upsert', entityId: id, branchId, state: 'pending', attempts: 0, createdAt: now });
      for (const recipient of recipients) {
        const notificationId = `task_assigned:${id}:${recipient.id}`;
        transaction.create(db.collection('notifications').doc(notificationId), {
          id: notificationId, recipientId: recipient.id, title: targetType === 'group' ? 'Team task assigned' : 'New task assigned',
          message: `${session.user.name} assigned: ${title}`, type: targetType === 'group' ? 'team_task' : 'task_assigned',
          taskId: id, isRead: false, createdAt: now,
        });
      }
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Task could not be saved.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (hasOversizedBody(request, 10_000)) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const taskId = typeof input.taskId === 'string' ? input.taskId.trim() : '';
    if (!taskId || taskId.length > 150) return NextResponse.json({ error: 'Task ID is required.' }, { status: 400 });

    const isEditAction = input.action === 'edit_task';

    if (isEditAction) {
      const isSuperAdmin = session.user.role === 'superadmin';
      const isAdmin = session.user.role === 'admin';
      if (!isSuperAdmin && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden: Only administrators can edit task details.' }, { status: 403 });
      }
    } else {
      const status = input.status as string;
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!['pending', 'in_progress', 'completed', 'partially_stopped'].includes(String(status))) {
        return NextResponse.json({ error: 'Invalid task transition.' }, { status: 400 });
      }
      if (status === 'partially_stopped' && (reason.length < 10 || reason.length > 1000)) {
        return NextResponse.json({ error: 'Provide a reason of at least 10 characters for a partially stopped task.' }, { status: 400 });
      }
    }

    const db = getAdminFirestore();
    if (!db) return NextResponse.json({ error: 'Task storage is unavailable.' }, { status: 503 });
    const taskRef = db.collection('tasks').doc(taskId);
    const now = new Date().toISOString();

    // ── CASE A: Super Admin / Admin editing task details ──
    if (isEditAction) {
      const isSuperAdmin = session.user.role === 'superadmin';

      const updates: Record<string, unknown> = { updatedAt: now };
      if (typeof input.title === 'string' && input.title.trim().length >= 2) {
        updates.title = input.title.trim().slice(0, 200);
      }
      if (typeof input.description === 'string') {
        updates.description = input.description.trim().slice(0, 3000);
      }
      if (typeof input.priority === 'string' && ['low', 'medium', 'high', 'urgent'].includes(input.priority)) {
        updates.priority = input.priority;
      }
      if (input.dueDate !== undefined) {
        const d = String(input.dueDate).trim();
        if (d === '' || /^\d{4}-\d{2}-\d{2}$/.test(d)) updates.dueDate = d;
      }
      if (typeof input.status === 'string' && ['pending', 'in_progress', 'completed', 'partially_stopped'].includes(input.status)) {
        updates.status = input.status;
      }

      let updatedTask: Record<string, unknown> = {};
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(taskRef);
        if (!snap.exists) throw new Error('TASK_NOT_FOUND');
        const existing = snap.data()!;
        if (!isSuperAdmin && existing.branch !== session.user.branch) throw new Error('TASK_FORBIDDEN');
        transaction.update(taskRef, updates);
        transaction.create(db.collection('task_history').doc(`${taskId}:edit:${randomUUID()}`), {
          taskId,
          actorUid: session.uid,
          action: 'admin_edit',
          updates,
          createdAt: now,
        });
        updatedTask = { id: taskId, ...existing, ...updates };
      });
      return NextResponse.json({ success: true, task: updatedTask });
    }

    // ── CASE B: Status transitions & Resumption ──
    const status = input.status as string;
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';

    const nextStatus = status as TaskStatus;
    let updated: Record<string, unknown> = {};

    await db.runTransaction(async transaction => {
      const taskSnapshot = await transaction.get(taskRef);
      if (!taskSnapshot.exists) throw new Error('TASK_NOT_FOUND');
      const task = taskSnapshot.data()!;
      const isAssigned = Array.isArray(task.assignedToUserIds) && task.assignedToUserIds.includes(session.user.id);
      const isManager = session.user.role === 'superadmin' || (session.user.role === 'admin' && task.branch === session.user.branch);
      if (!isAssigned && !isManager) throw new Error('TASK_FORBIDDEN');
      if (task.status === nextStatus) { updated = { id: taskId, ...task }; return; }

      // ALLOWED TRANSITIONS:
      // 1. pending -> in_progress
      // 2. in_progress -> completed OR partially_stopped
      // 3. partially_stopped -> in_progress (RESUMPTION) OR pending
      // 4. Super Admin can override transition any state
      const allowed =
        (task.status === 'pending' && nextStatus === 'in_progress') ||
        (task.status === 'in_progress' && (nextStatus === 'completed' || nextStatus === 'partially_stopped')) ||
        (task.status === 'partially_stopped' && (nextStatus === 'in_progress' || nextStatus === 'pending')) ||
        (session.user.role === 'superadmin');

      if (!allowed) throw new Error('TASK_CONFLICT');

      const isResuming = task.status === 'partially_stopped' && nextStatus === 'in_progress';
      const statusUpdates: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === 'in_progress' ? { startedAt: task.startedAt || now } : {}),
        ...(isResuming ? { resumedAt: now } : {}),
        ...(nextStatus === 'completed' ? { completedAt: now } : {}),
        ...(nextStatus === 'partially_stopped' ? { stoppedAt: now, stopReason: reason } : {}),
      };

      transaction.update(taskRef, statusUpdates);
      transaction.create(db.collection('task_history').doc(`${taskId}:${randomUUID()}`), {
        taskId,
        actorUid: session.uid,
        fromStatus: task.status,
        toStatus: nextStatus,
        ...(nextStatus === 'partially_stopped' ? { reason } : {}),
        ...(isResuming ? { resumptionNote: reason || 'Task resumed by user' } : {}),
        createdAt: now,
      });

      const projectionRef = db.collection('projection_jobs').doc(`task:${taskId}:${now}`);
      transaction.create(projectionRef, { id: projectionRef.id, type: 'task.upsert', entityId: taskId, branchId: task.branchId, state: 'pending', attempts: 0, createdAt: now });
      updated = { id: taskId, ...task, ...statusUpdates };
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'TASK_NOT_FOUND') return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    if (code === 'TASK_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (code === 'TASK_CONFLICT') return NextResponse.json({ error: 'Task status transition is not allowed.' }, { status: 409 });
    return NextResponse.json({ error: 'Task update could not be saved.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });

  // Strictly Super Admin and Admin can delete tasks
  const isSuperAdmin = session.user.role === 'superadmin';
  const isAdmin = session.user.role === 'admin';
  if (!isSuperAdmin && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Only administrators can delete tasks.' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const taskId = searchParams.get('taskId') || searchParams.get('id');
  if (!taskId) return NextResponse.json({ error: 'Missing taskId parameter.' }, { status: 400 });

  try {
    const db = getAdminFirestore();
    if (!db) return NextResponse.json({ error: 'Task storage is unavailable.' }, { status: 503 });

    const taskRef = db.collection('tasks').doc(taskId);
    const snap = await taskRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }

    const taskData = snap.data()!;
    if (!isSuperAdmin && taskData.branch !== session.user.branch) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete tasks outside your branch.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await db.runTransaction(async transaction => {
      transaction.delete(taskRef);
      transaction.create(db.collection('task_history').doc(`${taskId}:deleted:${randomUUID()}`), {
        taskId,
        actorUid: session.uid,
        action: 'deleted',
        deletedAt: now,
      });
    });

    return NextResponse.json({ success: true, message: 'Task permanently deleted.' });
  } catch (err) {
    console.error('[api/tasks] DELETE error:', err);
    return NextResponse.json({ error: 'Task could not be deleted.' }, { status: 500 });
  }
}
