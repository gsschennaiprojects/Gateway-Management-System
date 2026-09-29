import { hashPassword, verifyPassword } from './password';

describe('password storage', () => {
  it('hashes passwords with a random salt and verifies the result', () => {
    const first = hashPassword('correct horse battery staple');
    const second = hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
    expect(verifyPassword('correct horse battery staple', first)).toEqual({ valid: true, needsUpgrade: false });
    expect(verifyPassword('wrong password', first).valid).toBe(false);
  });

  it('marks legacy plaintext credentials for upgrade after successful verification', () => {
    expect(verifyPassword('legacy-password', 'legacy-password')).toEqual({ valid: true, needsUpgrade: true });
    expect(verifyPassword('wrong-password', 'legacy-password')).toEqual({ valid: false, needsUpgrade: false });
  });
});
