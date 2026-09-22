'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ThemeSelector } from '@/components/ui/ThemeSelector';
import { HelpCircle, LayoutGrid, Menu } from 'lucide-react';
import { AccountAvatar } from './AccountAvatar';

interface AccountTopBarProps {
  onMenuToggle?: () => void;
  className?: string;
}

export function AccountTopBar({
  onMenuToggle,
  className = '',
}: AccountTopBarProps) {
  const { user } = useAuth();

  return (
    <header
      className={`sticky top-0 z-30 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between border-b border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)]/90 backdrop-blur-md shadow-xs text-[var(--text-primary,#1F1F1F)] transition-colors ${className}`}
    >
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Branding */}
        <Link
          href="/account"
          className="flex items-center gap-2 group transition-opacity hover:opacity-90"
        >
          <span className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
            <span>GSS</span>{' '}
            <span className="text-[var(--text-secondary,#5F6368)] font-normal">Account</span>
          </span>
        </Link>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Appearance Theme Selector */}
        <ThemeSelector />

        {/* Help */}
        <button
          className="p-2 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-all cursor-pointer"
          title="Help"
          aria-label="Help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* App grid — link back to dashboard */}
        <Link
          href="/dashboard"
          className="p-2 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-all cursor-pointer"
          title="Back to GSS Dashboard"
          aria-label="GSS Apps"
        >
          <LayoutGrid className="w-5 h-5" />
        </Link>

        {/* Profile avatar */}
        {user && (
          <div className="ml-1">
            <AccountAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              size="sm"
            />
          </div>
        )}
      </div>
    </header>
  );
}
