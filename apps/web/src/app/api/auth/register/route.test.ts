import { POST } from './route';
import { NextRequest } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/firebase/firebase-admin', () => ({ getAdminAuth: jest.fn(), getAdminFirestore: jest.fn() }));

describe('POST /api/auth/register', () => {
  it('does not persist or return password hashes and stores profile keyed by Firebase UID', async () => {
    const userRef = { set: jest.fn().mockResolvedValue(undefined) };
    const indexRef = { set: jest.fn().mockResolvedValue(undefined) };
    const transaction = { get: jest.fn().mockResolvedValue({ exists: false }), create: jest.fn() };
    const db = { collection: jest.fn((name: string) => ({
      doc: jest.fn(() => name === 'users' ? userRef : indexRef),
    })), runTransaction: jest.fn(async (fn) => fn(transaction)) };
    const auth = { createUser: jest.fn().mockResolvedValue({ uid: 'firebase-uid' }), deleteUser: jest.fn().mockResolvedValue(undefined) };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
    (getAdminAuth as jest.Mock).mockReturnValue(auth);
    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Staff', email: 'staff@example.invalid', mobile: '9876543210', requestedRole: 'employee', branch: 'Chennai', specialization: 'Engineering', startMonthYear: '2026-09', password: 'secret123' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(auth.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'staff@example.invalid', password: 'secret123', disabled: false }));
    expect(db.runTransaction).toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toMatch(/passwordHash|secret123/);
  });

  it('allows registration with HR role and sets GSSHR prefix with 3 random digits', async () => {
    let createdUser: Record<string, unknown> = {};
    const transaction = {
      get: jest.fn().mockResolvedValue({ exists: false }),
      create: jest.fn((_ref, data) => {
        if (data.role) createdUser = data;
      }),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn((id: string) => ({ id })) })),
      runTransaction: jest.fn(async (fn) => fn(transaction)),
    };
    const auth = { createUser: jest.fn().mockResolvedValue({ uid: 'hr-uid' }) };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);
    (getAdminAuth as jest.Mock).mockReturnValue(auth);

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Srinithi S',
        email: 'gateway.srinithi@gmail.com',
        mobile: '9003580181',
        requestedRole: 'hr',
        branch: 'Chennai',
        specializations: ['HR operation', 'Gen AI'],
        startMonthYear: '2026-05',
        password: 'Password123#',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(createdUser.role).toBe('hr');
    expect(createdUser.employeeId).toMatch(/^GSSHR\d{3}$/);
    expect(createdUser.name).toBe('Srinithi S');
  });
});
