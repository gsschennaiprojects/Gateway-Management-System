import { checkLoginRateLimit } from './login-rate-limit';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/firebase/firebase-admin', () => ({ getAdminFirestore: jest.fn() }));

describe('distributed login rate limit', () => {
  it('checks both identifier and client address counters in one transaction', async () => {
    const transaction = { get: jest.fn().mockResolvedValue({ exists: false }), set: jest.fn() };
    const db = { collection: jest.fn(() => ({ doc: jest.fn(id => ({ id })) })), runTransaction: jest.fn(async fn => fn(transaction)) };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
    await expect(checkLoginRateLimit('user@example.invalid', '192.0.2.1')).resolves.toBe(true);
    expect(transaction.get).toHaveBeenCalledTimes(2);
    expect(transaction.set).toHaveBeenCalledTimes(2);
  });

  it('denies another attempt when either counter has reached its threshold', async () => {
    const transaction = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ windowStartedAt: Date.now(), attempts: 10 }) }), set: jest.fn() };
    const db = { collection: jest.fn(() => ({ doc: jest.fn(id => ({ id })) })), runTransaction: jest.fn(async fn => fn(transaction)) };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
    await expect(checkLoginRateLimit('user@example.invalid', '192.0.2.1')).resolves.toBe(false);
    expect(transaction.set).not.toHaveBeenCalled();
  });
});
