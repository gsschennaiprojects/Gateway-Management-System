import { GET } from './route';
import { getSession } from '@/lib/auth/session';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));

describe('GET /api/auth/me', () => {
  it('allows the verified pending profile for the pending experience', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'EMP-1', status: 'pending' } });
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
});
