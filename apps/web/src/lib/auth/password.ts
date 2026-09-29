import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const HASH_PREFIX = 'scrypt$';
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${HASH_PREFIX}${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, storedValue: string): { valid: boolean; needsUpgrade: boolean } {
  if (storedValue.startsWith(HASH_PREFIX)) {
    const [, saltValue, hashValue, extra] = storedValue.split('$');
    if (!saltValue || !hashValue || extra !== undefined) return { valid: false, needsUpgrade: false };
    try {
      const salt = Buffer.from(saltValue, 'base64url');
      const expected = Buffer.from(hashValue, 'base64url');
      const actual = scryptSync(password, salt, expected.length);
      return {
        valid: expected.length === actual.length && timingSafeEqual(actual, expected),
        needsUpgrade: false,
      };
    } catch {
      return { valid: false, needsUpgrade: false };
    }
  }

  // Existing records store plaintext. Accept only on a successful login so the
  // record can be upgraded in place without a bulk production-data migration.
  const provided = Buffer.from(password, 'utf8');
  const legacy = Buffer.from(storedValue, 'utf8');
  const valid = provided.length === legacy.length && timingSafeEqual(provided, legacy);
  return { valid, needsUpgrade: valid };
}
