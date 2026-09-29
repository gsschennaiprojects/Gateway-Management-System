import { GET } from './route';
import { getAdminFirestore } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/firebase/firebase-admin', () => ({ getAdminFirestore: jest.fn() }));

describe('GET /api/health', () => {
  it('returns liveness without unsupported capacity claims', async () => {
    const response = await GET(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ status: 'alive' }));
  });

  it('returns not ready when canonical Firestore is unavailable', async () => {
    (getAdminFirestore as jest.Mock).mockReturnValue(null);
    const response = await GET(new Request('http://localhost/api/health?ready=1'));
    expect(response.status).toBe(503);
  });
});
