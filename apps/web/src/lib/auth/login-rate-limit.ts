import { createHash } from 'crypto';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function documentId(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Distributed Firestore throttle shared across server instances. Fails open on DB transient errors. */
export async function checkLoginRateLimit(identifier: string, clientAddress: string): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return true;

  try {
    const now = Date.now();
    const refs = [
      db.collection('login_rate_limits').doc(documentId(`identifier:${identifier.trim().toLowerCase()}`)),
      db.collection('login_rate_limits').doc(documentId(`address:${clientAddress || 'unknown'}`)),
    ];
    return await db.runTransaction(async transaction => {
      const snapshots = [];
      for (const ref of refs) snapshots.push(await transaction.get(ref));
      const states = snapshots.map(snapshot => {
        const data = snapshot.exists ? snapshot.data()! : {};
        const started = typeof data.windowStartedAt === 'number' ? data.windowStartedAt : now;
        const attempts = started + WINDOW_MS <= now ? 0 : typeof data.attempts === 'number' ? data.attempts : 0;
        return { started: attempts === 0 ? now : started, attempts };
      });
      if (states.some(state => state.attempts >= MAX_ATTEMPTS)) return false;
      refs.forEach((ref, index) => transaction.set(ref, {
        windowStartedAt: states[index].started,
        attempts: states[index].attempts + 1,
        expiresAt: new Date(states[index].started + WINDOW_MS),
        updatedAt: now,
      }));
      return true;
    });
  } catch (err) {
    console.warn('[RateLimit] Login throttling check non-blocking warning:', err);
    return true;
  }
}
