import { GET } from './route';
import { getSession, setSessionCookie } from '@/lib/auth/session';
import { findUserById } from '@/lib/auth/user-store';

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
  setSessionCookie: jest.fn(),
}));

jest.mock('@/lib/auth/user-store', () => ({
  findUserById: jest.fn(),
}));

jest.mock('@/lib/firebase/firebase-admin', () => ({
  getFirestoreUserById: jest.fn(),
}));

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the verified pending profile for the pending experience', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'EMP-1', status: 'pending', role: 'employee' } });
    const response = await GET();
    expect(getSession).toHaveBeenCalledWith({ allowPending: true });
    expect(response.status).toBe(200);
  });

  it('does not fall back to stale cookie profile when current profile is missing', async () => {
    (getSession as jest.Mock).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ user: null });
  });

  it('detects live Super Admin approval from database and refreshes session cookie', async () => {
    // Cookie was issued when user was pending
    (getSession as jest.Mock).mockResolvedValue({
      user: { id: 'GSS_EMP_001', name: 'John Doe', status: 'pending', role: 'employee', branch: 'Coimbatore' },
    });

    // Database record now shows Super Admin approved them (active)
    (findUserById as jest.Mock).mockReturnValue({
      id: 'GSS_EMP_001',
      name: 'John Doe',
      status: 'active',
      role: 'employee',
      branch: 'Coimbatore',
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.status).toBe('active');
    expect(setSessionCookie).toHaveBeenCalledWith(expect.objectContaining({
      id: 'GSS_EMP_001',
      status: 'active',
    }));
  });
});
