'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  UserCircle,
  ShieldCheck,
  Lock,
  Users,
  CreditCard,
  Info,
  X,
} from 'lucide-react';

export interface AccountNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  {
    label: 'Home',
    href: '/account',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'Personal info',
    href: '/account/personal-info',
    icon: <UserCircle className="w-5 h-5" />,
  },
  {
    label: 'Security',
    href: '/account/security',
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  {
    label: 'Data & privacy',
    href: '/account/data-privacy',
    icon: <Lock className="w-5 h-5" />,
  },
  {
    label: 'People & sharing',
    href: '/account/people-sharing',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Payments & subscriptions',
    href: '/account/payments',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: 'About',
    href: '/account/about',
    icon: <Info className="w-5 h-5" />,
  },
];

interface AccountSidebarProps {
  className?: string;
  onClose?: () => void;
  isMobileDrawer?: boolean;
}

export function AccountSidebar({
  className = '',
  onClose,
  isMobileDrawer = false,
}: AccountSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/account') return pathname === '/account';
    return pathname.startsWith(href);
  };

  const navContent = (
    <nav className="space-y-1 p-2">
      {ACCOUNT_NAV_ITEMS.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={isMobileDrawer ? onClose : undefined}
            className={`flex items-center gap-3.5 px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 relative group cursor-pointer ${
              active
                ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] font-semibold'
                : 'text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
            }`}
          >
            <span
              className={`transition-colors duration-200 shrink-0 ${
                active
                  ? 'text-[var(--brand-primary,#1A73E8)]'
                  : 'text-[var(--text-secondary,#5F6368)] group-hover:text-[var(--text-primary,#1F1F1F)]'
              }`}
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  // Desktop sidebar
  if (!isMobileDrawer) {
    return (
      <aside
        className={`hidden lg:flex flex-col w-[260px] shrink-0 bg-[var(--bg-card,#FFFFFF)] rounded-3xl border border-[var(--border-card,#DADCE0)] p-2 shadow-xs max-h-[calc(100vh-6rem)] overflow-y-auto ${className}`}
      >
        {navContent}
      </aside>
    );
  }

  // Mobile drawer
  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-xs bg-[var(--bg-card,#FFFFFF)] border-r border-[var(--border-card,#DADCE0)] h-full flex flex-col z-10 shadow-2xl animate-drawer-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-card,#DADCE0)]">
          <span className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">
            GSS Account
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto">
          {navContent}
        </div>
      </div>
    </div>
  );
}
