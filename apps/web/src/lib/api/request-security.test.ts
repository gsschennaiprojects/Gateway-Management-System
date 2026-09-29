import { hasOversizedBody, isSameOriginRequest } from './request-security';

describe('request security helpers', () => {
  it('accepts only the configured origin', () => {
    process.env.APP_URL = 'https://gms.example';
    expect(isSameOriginRequest(new Request('https://gms.example/api', { headers: { origin: 'https://gms.example' } }))).toBe(true);
    expect(isSameOriginRequest(new Request('https://gms.example/api', { headers: { origin: 'https://attacker.example' } }))).toBe(false);
  });

  it('requires an explicit app origin in production', () => {
    const restoreEnv = jest.replaceProperty(process, 'env', { ...process.env, APP_URL: '', NEXT_PUBLIC_APP_URL: '', NODE_ENV: 'production' });
    try {
      expect(isSameOriginRequest(new Request('https://gms.example/api', { headers: { origin: 'https://gms.example' } }))).toBe(false);
    } finally {
      restoreEnv.restore();
    }
  });

  it('rejects declared oversized request bodies', () => {
    expect(hasOversizedBody(new Request('http://localhost', { headers: { 'content-length': '1200' } }), 1000)).toBe(true);
    expect(hasOversizedBody(new Request('http://localhost'), 1000)).toBe(false);
  });
});
