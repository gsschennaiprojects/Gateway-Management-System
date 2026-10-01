/**
 * GSS Enterprise Custom User ID Generator
 *
 * FORMAT:
 * "GSS[Role][Random three digit number(which not exists)]"
 *
 * EXAMPLES:
 * - Super Admin: GSSSA204
 * - Branch Admin: GSSADM582
 * - HR: GSSHR109
 * - Employee: GSSEMP348
 * - Intern: GSSINT315
 */

import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

export type UserRoleType = 'superadmin' | 'admin' | 'hr' | 'employee' | 'intern' | string;

/**
 * Maps role name to standard GSS role code.
 */
export function getRoleCode(role?: string): 'SA' | 'ADM' | 'HR' | 'EMP' | 'INT' {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'super_admin' || r === 'sa') return 'SA';
  if (r === 'admin' || r === 'branch_admin' || r === 'adm') return 'ADM';
  if (r === 'hr') return 'HR';
  if (r === 'intern' || r === 'int') return 'INT';
  return 'EMP';
}

/**
 * Generates a random three digit number (100 - 999).
 */
export function generateRandomThreeDigitNumber(): number {
  return Math.floor(100 + Math.random() * 900);
}

/**
 * Synchronously generates a unique ID of format `GSS[Role][3-digits]`
 * that is not present in the given set of existing IDs.
 */
export function generateCustomUserId(role: string, existingIds: Set<string> | string[]): string {
  const roleCode = getRoleCode(role);
  const used = existingIds instanceof Set ? existingIds : new Set(existingIds);

  // Attempt random non-colliding selection (up to 1,000 attempts)
  for (let attempt = 0; attempt < 1000; attempt++) {
    const num = generateRandomThreeDigitNumber();
    const candidate = `GSS${roleCode}${num}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  // Fallback exhaustive sequential scan across 100-999 if random hits collision
  for (let num = 100; num <= 999; num++) {
    const candidate = `GSS${roleCode}${num}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`All 900 ID slots for role prefix GSS${roleCode} are currently in use.`);
}

/**
 * Asynchronously generates a unique ID by querying Firestore and the in-memory user store
 * to guarantee no collision with existing users.
 */
export async function generateUniqueCustomUserId(role: string): Promise<string> {
  const existing = new Set<string>();

  // 1. Query Firestore users collection
  try {
    const db = getAdminFirestore();
    if (db && typeof db.collection === 'function') {
      const col = db.collection('users');
      if (col && typeof col.get === 'function') {
        const snap = await col.get();
        if (snap && Array.isArray(snap.docs)) {
          for (const doc of snap.docs) {
            existing.add(doc.id);
            const data = doc.data ? doc.data() : {};
            if (data?.employeeId) existing.add(String(data.employeeId));
            if (data?.uid) existing.add(String(data.uid));
          }
        }
      }
    }
  } catch (err) {
    console.warn('[UserIdGenerator] Firestore lookup warning:', err);
  }

  // 2. Query in-memory user store
  try {
    const { getAllUsers } = await import('@/lib/auth/user-store');
    for (const u of getAllUsers()) {
      if (u.id) existing.add(u.id);
      if (u.employeeId) existing.add(u.employeeId);
    }
  } catch {
    // Ignore fallback errors
  }

  return generateCustomUserId(role, existing);
}
