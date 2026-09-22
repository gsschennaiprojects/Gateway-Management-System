'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { GoogleAppsLauncher } from '@/components/layout/GoogleAppsLauncher';
import { GoogleProfileMenu } from '@/components/layout/GoogleProfileMenu';
import { GoogleHeaderSearchBar } from '@/components/layout/GoogleHeaderSearchBar';
import { ThemeSelector } from '@/components/ui/ThemeSelector';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Loader2, HelpCircle, MapPin } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { isCollapsed } = useSidebar();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.status === 'pending') {
        router.replace('/pending');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas,#F8FAFD)] flex items-center justify-center text-[var(--text-primary,#1F1F1F)]">
        <div className="flex flex-col items-center gap-4 animate-panel-entrance">
          <div className="relative">
            <BrandLogo size="xl" showText={false} glowOnHover={false} />
            <Loader2 className="absolute -bottom-1 -right-1 w-5 h-5 animate-spin text-[var(--brand-primary,#1A73E8)]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-[var(--text-primary,#1F1F1F)] tracking-tight">
              GSS Management
            </p>
            <p className="text-[11px] font-medium text-[var(--text-muted,#5F6368)] mt-1 uppercase tracking-wider">
              Authenticating session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.status === 'pending') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas,#F8FAFD)] text-[var(--text-primary,#1F1F1F)] relative overflow-x-clip transition-colors duration-200">
      {/* Left Rail Sidebar — Fixed to viewport */}
      <Sidebar />

      {/* Main Canvas Area — Padded fluidly and responsively according to sidebar collapse state */}
      <div
        className={`relative z-10 flex flex-col min-h-screen pb-20 md:pb-0 ${
          isCollapsed ? 'md:pl-[76px]' : 'md:pl-[250px]'
        } transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
      >
        {/* Universal Google Workspace Top Header */}
        <header className="h-16 px-4 sm:px-6 md:px-8 border-b border-[var(--border-card,#DADCE0)] flex items-center justify-between bg-[var(--bg-card,#FFFFFF)]/95 backdrop-blur-md sticky top-0 z-20 shadow-xs gap-4 transition-colors duration-200">
          {/* Left: Mobile Logo & Workspace Info */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 md:hidden">
              <BrandLogo size="xs" showText={false} />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-[var(--text-primary,#1F1F1F)] capitalize flex items-center gap-1.5">
                <span>{user.role} Workspace</span>
              </span>
              {user.branch && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>{user.branch}</span>
                </span>
              )}
            </div>
          </div>

          {/* Center: Google Header Search Bar */}
          <div className="hidden md:flex flex-1 justify-center max-w-[580px] mx-2">
            <GoogleHeaderSearchBar />
          </div>

          {/* Right: Theme Selector, Help, Google Apps 9-Dot Launcher, Notification Bell, Google Profile Avatar */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Multi-Theme Selector (Light, Dark, Eye Protection) */}
            <ThemeSelector />

            {/* Help Button */}
            <button
              className="p-2 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors hidden sm:inline-flex cursor-pointer"
              title="Help & Support"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Google 9-dot Waffle App Launcher */}
            <GoogleAppsLauncher />

            {/* Notification Bell */}
            <NotificationBell />

            {/* Google Account Profile Button with Popover */}
            <div className="ml-1 sm:ml-2">
              <GoogleProfileMenu />
            </div>
          </div>
        </header>

        {/* Dynamic Page Content — Fluidly expands when sidebar is collapsed */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 w-full mx-auto transition-all duration-300">
          {children}
        </main>

        {/* Google Style Clean Footer */}
        <footer className="hidden md:flex items-center justify-between px-8 py-4 border-t border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#5F6368)] bg-[var(--bg-card,#FFFFFF)] transition-colors duration-200">
          <span>© 2026 Gateway Software Solutions • GSS Management System</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-[var(--brand-primary,#1A73E8)] font-medium">Coimbatore • Chennai • Madurai • Erode</span>
            <span className="w-1 h-1 rounded-full bg-[var(--border-card,#DADCE0)]" />
            <span>Role Guard Active</span>
            <span className="w-1 h-1 rounded-full bg-[var(--border-card,#DADCE0)]" />
            <span className="text-[var(--badge-success-text,#137333)] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-success-text,#137333)]" />
              System Healthy
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
