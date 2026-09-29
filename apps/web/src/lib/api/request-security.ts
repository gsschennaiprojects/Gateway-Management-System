export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl && process.env.NODE_ENV === 'production') return false;
  try {
    const expectedOrigin = configuredUrl ? new URL(configuredUrl).origin : new URL(request.url).origin;
    return origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function hasOversizedBody(request: Request, maxBytes: number): boolean {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  return Number.isFinite(declaredLength) && declaredLength > maxBytes;
}
