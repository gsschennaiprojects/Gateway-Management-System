/**
 * Resolves the primary base URL of the application.
 * Automatically adapts across client-side browser, Vercel deployments,
 * custom domains, and local development.
 */
export function getAppUrl(): string {
  // 1. Client-side browser runtime (always matches active domain)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // 2. Explicitly configured production / environment URLs
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured && !configured.includes('${') && !configured.startsWith('$')) {
    return configured.replace(/\/+$/, '');
  }

  // 3. Vercel System Environment Variables (automatically provided by Vercel)
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionHost && !vercelProductionHost.includes('${')) {
    return `https://${vercelProductionHost}`.replace(/\/+$/, '');
  }

  const vercelHost = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercelHost && !vercelHost.includes('${')) {
    return `https://${vercelHost}`.replace(/\/+$/, '');
  }

  // 4. Fallback for production or local development
  if (process.env.NODE_ENV === 'production') {
    return 'https://gms.gatewayskill.in';
  }

  return 'http://localhost:3000';
}

/**
 * Validates whether an incoming HTTP request originates from an allowed origin.
 * Automatically adapts across:
 * - Configured APP_URL and NEXT_PUBLIC_APP_URL
 * - Vercel system environment variables (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, NEXT_PUBLIC_VERCEL_URL)
 * - Vercel preview domains (*.vercel.app)
 * - Request URL origin and x-forwarded-host
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  const allowedOrigins = new Set<string>();

  // 1. Explicitly configured URLs
  const configuredList = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const item of configuredList) {
    if (item && !item.includes('${') && !item.startsWith('$')) {
      try {
        allowedOrigins.add(new URL(item).origin);
      } catch {
        // ignore invalid URL format
      }
    }
  }

  // 2. Vercel System Environment Variables (automatically provided by Vercel)
  const vercelHosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ];

  for (const host of vercelHosts) {
    if (host && !host.includes('${') && !host.startsWith('$')) {
      const formatted = host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`;
      try {
        allowedOrigins.add(new URL(formatted).origin);
      } catch {
        // ignore invalid host
      }
    }
  }

  // 3. Fallback for non-production environments (test / development)
  if (allowedOrigins.size === 0) {
    if (process.env.NODE_ENV === 'production') {
      // In standalone production with no configured target, reject
      return false;
    }
    try {
      allowedOrigins.add(new URL(request.url).origin);
    } catch {
      return false;
    }
  }

  // Exact match against allowed origins set
  if (allowedOrigins.has(origin)) {
    return true;
  }

  // 4. Dynamic Vercel / Reverse Proxy origin resolution
  const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL) || Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  if (isVercelRuntime) {
    try {
      // Allow matching against request.url origin
      const reqOrigin = new URL(request.url).origin;
      if (origin === reqOrigin) return true;

      // Allow matching against forwarded host (Vercel Edge Proxy)
      const fwdHost = request.headers.get('x-forwarded-host');
      const fwdProto = request.headers.get('x-forwarded-proto') || 'https';
      if (fwdHost) {
        const primaryHost = fwdHost.split(',')[0].trim();
        if (origin === `${fwdProto}://${primaryHost}`) {
          return true;
        }
      }

      // Allow official Vercel preview and deployment domains (*.vercel.app)
      const originUrl = new URL(origin);
      if (originUrl.hostname.endsWith('.vercel.app')) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export function hasOversizedBody(request: Request, maxBytes: number): boolean {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  return Number.isFinite(declaredLength) && declaredLength > maxBytes;
}

