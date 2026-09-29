import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAuditLogs, logAuditEvent } from '@/lib/audit/audit-service';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const requestedBranch = searchParams.get('branch') || undefined;
    const branch = session.user.role === 'superadmin' ? requestedBranch : session.user.branch;
    const moduleFilter = searchParams.get('module') || undefined;
    const limitParam = searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;

    const logs = await getAuditLogs({
      branch,
      module: moduleFilter,
      limit,
    });

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit logs';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isSameOriginRequest(req)) return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
  if (hasOversizedBody(req, 16_384)) return NextResponse.json({ success: false, error: 'Request is too large.' }, { status: 413 });
  if (!['superadmin', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (typeof body.action !== 'string' || !body.action.trim()) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }
    if (session.user.role !== 'superadmin' && body.branch && body.branch !== session.user.branch) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const logId = await logAuditEvent({
      userId: session.user.id,
      userName: session.user.name,
      role: session.user.role,
      action: body.action.trim().slice(0, 80),
      module: typeof body.module === 'string' ? body.module.trim().slice(0, 80) : 'SYSTEM',
      recordId: typeof body.recordId === 'string' ? body.recordId.trim().slice(0, 150) : 'N/A',
      branch: session.user.role === 'superadmin' && typeof body.branch === 'string'
        ? body.branch.slice(0, 80)
        : session.user.branch,
      oldValue: typeof body.oldValue === 'string' ? body.oldValue.slice(0, 500) : undefined,
      newValue: typeof body.newValue === 'string' ? body.newValue.slice(0, 500) : undefined,
    });

    return NextResponse.json({
      success: true,
      logId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record audit event';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
