import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import {
  getFirestoreAnnouncements,
  createFirestoreAnnouncement,
  markAnnouncementAsRead,
} from '@/lib/operations/operations-service';
import type { AnnouncementPriority } from '@/types/operations';
import type { Branch, UserRole } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const announcements = await getFirestoreAnnouncements({
      branch: session.user.branch,
      role: session.user.role,
      activeOnly,
    });

    return NextResponse.json({ announcements });
  } catch {
    return NextResponse.json({ error: 'Announcements are temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (hasOversizedBody(request, 15_000)) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const priority = (body.priority as AnnouncementPriority) || 'normal';
    const targetBranch = (session.user.role === 'superadmin' && body.targetBranch
      ? body.targetBranch
      : session.user.branch) as 'all' | Branch;
    const targetRoles = (body.targetRoles as UserRole[] | 'all') || 'all';
    const pinned = Boolean(body.pinned);
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : undefined;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 });
    }

    const announcement = await createFirestoreAnnouncement({
      title,
      content,
      priority,
      targetBranch,
      targetRoles,
      pinned,
      expiresAt,
      author: {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
      },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create announcement.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const announcementId = typeof body.announcementId === 'string' ? body.announcementId.trim() : '';

    if (!announcementId) {
      return NextResponse.json({ error: 'Announcement ID is required.' }, { status: 400 });
    }

    await markAnnouncementAsRead(announcementId, session.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to mark announcement as read.' }, { status: 500 });
  }
}
