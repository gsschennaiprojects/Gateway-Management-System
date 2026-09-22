'use client';

import React, { useEffect } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console or error reporting service (e.g. Sentry / Cloud Logging)
    console.error('[GSS Application Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col justify-between p-6">
      <header className="w-full max-w-5xl mx-auto py-4">
        <BrandLogo size="md" />
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[500px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-8 sm:p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] border border-[var(--badge-danger-border)] flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--badge-danger-text)]">
            Application Error
          </span>

          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-2 mb-3">
            Something unexpected occurred
          </h1>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
            An error prevented this component from rendering properly. Our team has been notified of this event.
          </p>

          {error.message && (
            <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)] text-left font-mono text-xs text-[var(--text-secondary)] mb-6 overflow-x-auto">
              {error.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => reset()}
              className="w-full sm:w-auto justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full justify-center gap-2">
                <Home className="w-4 h-4" />
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-5xl mx-auto py-4 text-center text-xs text-[var(--text-secondary)]">
        &copy; {new Date().getFullYear()} Gateway Software Solutions. System Error Recovery.
      </footer>
    </div>
  );
}
