import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, logAuditEvent } from '@/lib/audit/audit-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch') || undefined;
    const moduleFilter = searchParams.get('module') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const logId = await logAuditEvent({
      userId: body.userId,
      userName: body.userName,
      role: body.role,
      action: body.action,
      module: body.module || 'SYSTEM',
      recordId: body.recordId || 'N/A',
      branch: body.branch || 'Coimbatore',
      oldValue: body.oldValue,
      newValue: body.newValue,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      logId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to record audit event' },
      { status: 500 }
    );
  }
}
