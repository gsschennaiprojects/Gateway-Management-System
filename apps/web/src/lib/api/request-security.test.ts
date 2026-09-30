import { getAppUrl, hasOversizedBody, isSameOriginRequest } from './request-security';

describe('request security helpers', () => {
  it('accepts only the configured origin', () => {
    process.env.APP_URL = 'https://gms.example';
    expect(isSameOriginRequest(new Request('https://gms.example/api', { headers: { origin: 'https://gms.example' } }))).toBe(true);
    expect(isSameOriginRequest(new Request('https://gms.example/api', { headers: { origin: 'https://attacker.example' } }))).toBe(false);
  });

  it('requires an explicit app origin in production', () => {
    const restoreEnv = jest.replaceProperty(process, 'env', {
      ...process.env,
      APP_URL: '',
      NEXT_PUBLIC_APP_URL: '',
      VERCEL: '',
      VERCEL_URL: '',
      VERCEL_PROJECT_PRODUCTION_URL: '',
      NEXT_PUBLIC_VERCEL_URL: '',
      NODE_ENV: 'production',
    });
    try {
      expect(isSameOriginRequest(new Request('https://gms.example/api', { headers: { origin: 'https://gms.example' } }))).toBe(false);
    } finally {
      restoreEnv.restore();
    }
  });

  it('dynamically accepts VERCEL_PROJECT_PRODUCTION_URL when configured', () => {
    const restoreEnv = jest.replaceProperty(process, 'env', {
      ...process.env,
      APP_URL: '',
      NEXT_PUBLIC_APP_URL: '',
      VERCEL_PROJECT_PRODUCTION_URL: 'gms.gatewayskill.in',
      NODE_ENV: 'production',
    });
    try {
      expect(isSameOriginRequest(new Request('https://gms.gatewayskill.in/api', { headers: { origin: 'https://gms.gatewayskill.in' } }))).toBe(true);
      expect(isSameOriginRequest(new Request('https://gms.gatewayskill.in/api', { headers: { origin: 'https://attacker.com' } }))).toBe(false);
    } finally {
      restoreEnv.restore();
    }
  });

  it('handles unexpanded template variables without crashing and falls back to VERCEL_URL', () => {
    const restoreEnv = jest.replaceProperty(process, 'env', {
      ...process.env,
      NEXT_PUBLIC_APP_URL: 'https://${VERCEL_PROJECT_PRODUCTION_URL}',
      VERCEL_URL: 'gms-deploy-123.vercel.app',
      VERCEL: '1',
      NODE_ENV: 'production',
    });
    try {
      expect(isSameOriginRequest(new Request('https://gms-deploy-123.vercel.app/api', { headers: { origin: 'https://gms-deploy-123.vercel.app' } }))).toBe(true);
      expect(isSameOriginRequest(new Request('https://gms-deploy-123.vercel.app/api', { headers: { origin: 'https://attacker.com' } }))).toBe(false);
    } finally {
      restoreEnv.restore();
    }
  });

  it('accepts *.vercel.app preview deployments in Vercel environment', () => {
    const restoreEnv = jest.replaceProperty(process, 'env', {
      ...process.env,
      VERCEL: '1',
      NODE_ENV: 'production',
    });
    try {
      expect(isSameOriginRequest(new Request('https://preview-1.vercel.app/api', { headers: { origin: 'https://preview-1.vercel.app' } }))).toBe(true);
      expect(isSameOriginRequest(new Request('https://preview-1.vercel.app/api', { headers: { origin: 'https://attacker.evil.com' } }))).toBe(false);
    } finally {
      restoreEnv.restore();
    }
  });

  it('accepts x-forwarded-host header on Vercel runtime', () => {
    const restoreEnv = jest.replaceProperty(process, 'env', {
      ...process.env,
      VERCEL: '1',
      NODE_ENV: 'production',
    });
    try {
      const req = new Request('https://internal.vercel.app/api', {
        headers: {
          origin: 'https://custom-domain.org',
          'x-forwarded-host': 'custom-domain.org',
          'x-forwarded-proto': 'https',
        },
      });
      expect(isSameOriginRequest(req)).toBe(true);
    } finally {
      restoreEnv.restore();
    }
  });

  it('rejects declared oversized request bodies', () => {
    expect(hasOversizedBody(new Request('http://localhost', { headers: { 'content-length': '1200' } }), 1000)).toBe(true);
    expect(hasOversizedBody(new Request('http://localhost'), 1000)).toBe(false);
  });

  describe('getAppUrl', () => {
    it('returns configured NEXT_PUBLIC_APP_URL when set', () => {
      const restoreEnv = jest.replaceProperty(process, 'env', { ...process.env, NEXT_PUBLIC_APP_URL: 'https://custom.app' });
      try {
        expect(getAppUrl()).toBe('https://custom.app');
      } finally {
        restoreEnv.restore();
      }
    });

    it('falls back to VERCEL_PROJECT_PRODUCTION_URL when NEXT_PUBLIC_APP_URL is unexpanded template', () => {
      const restoreEnv = jest.replaceProperty(process, 'env', {
        ...process.env,
        NEXT_PUBLIC_APP_URL: 'https://${VERCEL_PROJECT_PRODUCTION_URL}',
        VERCEL_PROJECT_PRODUCTION_URL: 'gms.gatewayskill.in',
      });
      try {
        expect(getAppUrl()).toBe('https://gms.gatewayskill.in');
      } finally {
        restoreEnv.restore();
      }
    });
  });
});

