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

  const notifications = getNotificationsForUser(session.user.id);
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
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      const success = markNotificationAsRead(notificationId);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
