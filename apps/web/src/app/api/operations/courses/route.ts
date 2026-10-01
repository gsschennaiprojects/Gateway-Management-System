import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { isSameOriginRequest, hasOversizedBody } from '@/lib/api/request-security';
import {
  getFirestoreCourses,
  upsertFirestoreCourse,
} from '@/lib/operations/operations-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain') || undefined;
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const courses = await getFirestoreCourses({ domain, activeOnly });
    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: 'Courses are temporarily unavailable.' }, { status: 503 });
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
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
    const durationWeeks = typeof body.durationWeeks === 'number' ? body.durationWeeks : 12;
    const description = typeof body.description === 'string' ? body.description.trim() : undefined;
    const syllabusTopics = Array.isArray(body.syllabusTopics) ? (body.syllabusTopics as string[]) : [];

    if (!name || !code || !domain) {
      return NextResponse.json({ error: 'Course name, code, and domain are required.' }, { status: 400 });
    }

    const course = await upsertFirestoreCourse({
      id: typeof body.id === 'string' ? body.id : undefined,
      courseId: code,
      name,
      code,
      domain,
      durationWeeks,
      description,
      syllabusTopics,
      isActive: body.isActive !== false,
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create or update course.' }, { status: 500 });
  }
}
