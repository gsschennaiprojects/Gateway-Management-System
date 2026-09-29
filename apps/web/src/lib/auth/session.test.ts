import { createSessionToken, parseSessionToken } from './session';
import { User } from '@/types/auth';

describe('session token integrity', () => {
  const user: User = {
    id: 'test-user',
    name: 'Test User',
    email: 'test@example.invalid',
    mobile: '0000000000',
    role: 'employee',
    status: 'active',
    branch: 'Coimbatore',
    createdAt: new Date(0).toISOString(),
  };

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-only-session-secret-with-32-bytes-minimum';
  });

  it('accepts a valid signed session', () => {
    const token = createSessionToken(user);
    expect(parseSessionToken(token)?.user.id).toBe(user.id);
  });

  it('rejects payload tampering', () => {
    const token = createSessionToken(user);
    const [payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    decoded.user.role = 'superadmin';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    expect(parseSessionToken(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = createSessionToken(user);
    process.env.SESSION_SECRET = 'a-different-session-secret-of-32-bytes';
    expect(parseSessionToken(token)).toBeNull();
  });
});
