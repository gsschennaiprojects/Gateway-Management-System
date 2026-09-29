import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore, getFirestoreTasks, getFirestoreUsers } from '@/lib/firebase/firebase-admin';
import type { TaskPriority, TaskStatus } from '@/types/task';

export const dynamic = 'force-dynamic';

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && process.env.NODE_ENV === 'production') return false;
  return !!origin && origin === (appUrl ? new URL(appUrl).origin : new URL(request.url).origin);
}

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
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (!['admin', 'superadmin'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 20_000) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
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
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 10_000) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const { taskId, status, reason: rawReason } = body as { taskId?: unknown; status?: unknown; reason?: unknown };
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (typeof taskId !== 'string' || taskId.length > 150 || !['pending', 'in_progress', 'completed', 'partially_stopped'].includes(String(status))) return NextResponse.json({ error: 'Invalid task transition.' }, { status: 400 });
    if (status === 'partially_stopped' && (reason.length < 10 || reason.length > 1000)) return NextResponse.json({ error: 'Provide a reason of at least 10 characters for a partially stopped task.' }, { status: 400 });
    const db = getAdminFirestore();
    if (!db) return NextResponse.json({ error: 'Task storage is unavailable.' }, { status: 503 });
    const taskRef = db.collection('tasks').doc(taskId);
    const now = new Date().toISOString();
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
      const allowed = task.status === 'pending' && nextStatus === 'in_progress' || task.status === 'in_progress' && (nextStatus === 'completed' || nextStatus === 'partially_stopped');
      if (!allowed) throw new Error('TASK_CONFLICT');
      transaction.update(taskRef, { status: nextStatus, updatedAt: now, ...(nextStatus === 'in_progress' ? { startedAt: now } : {}), ...(nextStatus === 'completed' ? { completedAt: now } : {}), ...(nextStatus === 'partially_stopped' ? { stoppedAt: now, stopReason: reason } : {}) });
      transaction.create(db.collection('task_history').doc(`${taskId}:${randomUUID()}`), { taskId, actorUid: session.uid, fromStatus: task.status, toStatus: nextStatus, ...(nextStatus === 'partially_stopped' ? { reason } : {}), createdAt: now });
      const projectionRef = db.collection('projection_jobs').doc(`task:${taskId}:${now}`);
      transaction.create(projectionRef, { id: projectionRef.id, type: 'task.upsert', entityId: taskId, branchId: task.branchId, state: 'pending', attempts: 0, createdAt: now });
      updated = { id: taskId, ...task, status: nextStatus, updatedAt: now };
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
