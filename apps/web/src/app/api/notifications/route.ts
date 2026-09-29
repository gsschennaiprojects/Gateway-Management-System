import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';
import {
  getFirestoreNotifications,
  markFirestoreNotificationAsRead,
  markAllFirestoreNotificationsAsRead,
} from '@/lib/firebase/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const notifications = await getFirestoreNotifications(session.user.id);
    return NextResponse.json({ notifications, unreadCount: notifications.filter(item => !item.isRead).length });
  } catch {
    return NextResponse.json({ error: 'Notifications are temporarily unavailable.' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  if (hasOversizedBody(request, 8192)) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const input = body as { notificationId?: unknown; action?: unknown };
    if (input.action === 'mark_all_read') {
      const success = await markAllFirestoreNotificationsAsRead(session.user.id);
      return success
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: 'Could not update notifications.' }, { status: 503 });
    }
    if (typeof input.notificationId !== 'string' || input.notificationId.length < 1 || input.notificationId.length > 150) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const success = await markFirestoreNotificationAsRead(input.notificationId, session.user.id);
    if (!success) return NextResponse.json({ error: 'Notification was not found or could not be updated.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not update notifications.' }, { status: 503 });
  }
}
