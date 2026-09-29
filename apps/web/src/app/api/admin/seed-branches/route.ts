/**
 * POST /api/admin/seed-branches
 * Seeds the 4 branch documents into Firestore.
 * Only callable by SUPER_ADMIN users.
 */

import { NextResponse } from 'next/server';
import { BRANCH_SEED_DATA } from '@/lib/seed-branches';
import { getSession } from '@/lib/auth/session';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';
import { isSameOriginRequest } from '@/lib/api/request-security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  try {
    // Check session — basic auth guard
    const authSession = await getSession();
    if (!authSession?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is superadmin
    const role = authSession.user.role?.toLowerCase();
    if (role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 });
    }

    // Seed all branches
    const db = getAdminFirestore();
    if (!db) return NextResponse.json({ error: 'Branch storage is unavailable.' }, { status: 503 });
    const results: string[] = [];
    for (const branch of BRANCH_SEED_DATA) {
      const safeBranch = { ...branch, spreadsheetId: '' };
      await db.collection('branches').doc(branch.branchId).set({
        ...safeBranch, updatedAt: new Date().toISOString(),
      }, { merge: true });
      results.push(`${branch.branchCode}: ${branch.branchName}`);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} branches successfully.`,
      branches: results,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: `Seed failed: ${err.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
