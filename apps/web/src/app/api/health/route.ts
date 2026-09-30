import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url, 'http://localhost');
    const readiness = url.searchParams.get('ready') === '1';
    if (!readiness) {
      return NextResponse.json({ status: 'alive', timestamp: new Date().toISOString() }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    try {
      const db = getAdminFirestore();
      if (!db) throw new Error('Firestore unavailable');
      await db.collection('systemConfig').doc('__readiness_probe__').get();
      return NextResponse.json({ status: 'ready', dependencies: { firestore: 'available' } }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    } catch {
      return NextResponse.json({ status: 'not_ready', dependencies: { firestore: 'unavailable' } }, {
        status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: 'error', message }, {
      status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
