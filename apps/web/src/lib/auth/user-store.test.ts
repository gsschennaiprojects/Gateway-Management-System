import { createUser, findUserByIdentifier } from './user-store';

describe('public user store protections', () => {
  it('does not provision an elevated role or active account from registration data', () => {
    const user = createUser({
      name: 'Registration Test',
      email: `registration-${Date.now()}@example.invalid`,
      mobile: `91${String(Date.now()).slice(-10)}`,
      requestedRole: 'superadmin',
      branch: 'Coimbatore',
      specialization: 'Testing',
      startMonthYear: '2026-09',
      password: 'test-password',
    });

    expect(user.role).toBe('employee');
    expect(user.status).toBe('pending');
  });

  it('does not seed a built-in Super Admin account in memory', () => {
    expect(findUserByIdentifier('gateway.managercbe@gmail.com')).toBeUndefined();
    expect(findUserByIdentifier('7397078885')).toBeUndefined();
  });
});
