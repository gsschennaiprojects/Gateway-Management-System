import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Home, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col justify-between p-6">
      {/* Brand Header */}
      <header className="w-full max-w-5xl mx-auto py-4">
        <BrandLogo size="md" />
      </header>

      {/* Center 404 Card */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[480px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-8 sm:p-10 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[var(--brand-container)] text-[var(--brand-primary)] flex items-center justify-center mx-auto mb-5">
            <Compass className="w-7 h-7 animate-pulse" />
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary)]">
            Error 404 • Page Not Found
          </span>

          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-2 mb-3">
            Looking for something?
          </h1>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-8">
            The operational page, report, or resource you requested is either unavailable or has moved to a new route.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="primary" className="w-full justify-center gap-2">
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto py-4 text-center text-xs text-[var(--text-secondary)]">
        &copy; {new Date().getFullYear()} Gateway Software Solutions. All rights reserved.
      </footer>
    </div>
  );
}
