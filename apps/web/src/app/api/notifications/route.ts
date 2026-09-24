import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '@/lib/tasks/task-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Authoritative Firestore Fetch
  let fsNotifications: any[] = [];
  try {
    const { getFirestoreNotifications } = await import('@/lib/firebase/firebase-admin');
    fsNotifications = await getFirestoreNotifications(session.user.id);
  } catch (err) {
    console.warn('[Notifications/GET] Firestore fetch note:', err);
  }

  // 2. In-memory notifications fallback / merge
  const inMem = getNotificationsForUser(session.user.id);

  // 3. Deduplicate by notification ID
  const map = new Map<string, any>();
  for (const n of inMem) {
    map.set(n.id, n);
  }
  for (const fn of fsNotifications) {
    map.set(fn.id, fn);
  }

  const notifications = Array.from(map.values()).sort(
    (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { notificationId, action } = body;

    if (action === 'mark_all_read') {
      markAllNotificationsAsRead(session.user.id);
      try {
        const { markAllFirestoreNotificationsAsRead } = await import('@/lib/firebase/firebase-admin');
        await markAllFirestoreNotificationsAsRead(session.user.id);
      } catch (fsErr) {
        console.warn('[Notifications/PATCH] Firestore mark all read note:', fsErr);
      }
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      const success = markNotificationAsRead(notificationId);
      try {
        const { markFirestoreNotificationAsRead } = await import('@/lib/firebase/firebase-admin');
        await markFirestoreNotificationAsRead(notificationId);
      } catch (fsErr) {
        console.warn('[Notifications/PATCH] Firestore mark read note:', fsErr);
      }
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
