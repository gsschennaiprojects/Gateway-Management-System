'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Mail, Lock, AlertCircle, Sun, Moon, Eye, Info } from 'lucide-react';

function LoginForm() {
  const { login, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [identifier, setIdentifier] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    emailParam ? `An account with this Gmail address already exists. Please enter your password to sign in.` : null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setIdentifier(emailParam);
      setInfoMessage(`An account with this Gmail address already exists. Please enter your password to sign in.`);
    }
  }, [emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!identifier.trim()) {
      setError('Please enter your Gmail address or 10-digit mobile number.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const result = await login({ identifier, password });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  return (
    <div className="w-full max-w-[460px] animate-panel-entrance">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-8 sm:p-10 shadow-xs text-[var(--text-primary)]">
        {/* Header: Logo on left, Mode button on right */}
        <div className="flex items-center justify-between mb-6">
          <BrandLogo size="md" />

          <button
            type="button"
            onClick={toggleTheme}
            title={`Current mode: ${theme}. Click to switch theme.`}
            aria-label="Toggle theme mode"
            className="w-10 h-10 rounded-full bg-[var(--brand-container)] hover:opacity-85 text-[var(--brand-primary)] flex items-center justify-center transition-all cursor-pointer shadow-xs border border-[var(--border-card)] focus:outline-hidden focus:ring-2 focus:ring-[var(--brand-primary)] shrink-0"
          >
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-blue-400" />
            ) : theme === 'eye-care' ? (
              <Eye className="w-5 h-5 text-amber-500" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
          </button>
        </div>

        {/* Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl font-normal text-[var(--text-primary)] tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            to continue to <strong className="font-semibold text-[var(--text-primary)]">GSS Management</strong>
          </p>
        </div>

        {infoMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-500">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-[var(--badge-danger-bg)] border border-[var(--badge-danger-border)] flex items-start gap-2.5 text-xs text-[var(--badge-danger-text)]">
            <AlertCircle className="w-4 h-4 text-[var(--badge-danger-text)] shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Input
              label="Email or Mobile"
              placeholder="e.g. name@gss.com or 9876543210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="username"
              required
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Use your corporate Gmail address or registered mobile number
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password-input"
                className="text-xs font-medium text-[var(--text-secondary)]"
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => alert('Password reset link has been dispatched to your corporate administrator.')}
                className="text-xs text-[var(--brand-primary)] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <Input
              id="password-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              showPasswordToggle
              autoComplete="current-password"
              required
            />
          </div>

          {/* Authentic Google Sign-In Action Row */}
          <div className="pt-3 flex items-center justify-between">
            <Link
              href="/register"
              className="text-xs text-[var(--brand-primary)] font-medium hover:underline"
            >
              Create account
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting || authLoading}
            >
              Next
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[460px] animate-pulse bg-[var(--bg-card)] rounded-3xl p-8 h-[400px]" />
    }>
      <LoginForm />
    </Suspense>
  );
}
