'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountSidebar } from '@/components/account/AccountSidebar';
import { Menu } from 'lucide-react';

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="w-full max-w-[1240px] mx-auto animate-panel-entrance">
      {/* Mobile Account Section Switcher Button */}
      <div className="lg:hidden mb-4 flex items-center justify-between p-3 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Account Settings</span>
        </div>
        <button
          onClick={() => setMobileNavOpen(true)}
          className="px-3 py-1.5 rounded-full bg-[var(--nav-hover-bg,#F1F3F4)] text-xs font-medium text-[var(--brand-primary,#1A73E8)] flex items-center gap-1.5 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span>Sections</span>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <AccountSidebar
          isMobileDrawer
          onClose={() => setMobileNavOpen(false)}
        />
      )}

      {/* Desktop Layout: Sub-navigation Rail + Canvas */}
      <div className="flex flex-col lg:flex-row gap-8 items-start relative">
        {/* Left Sub-navigation Rail - Stays fixed/sticky on desktop */}
        <div className="hidden lg:block w-[260px] shrink-0 sticky top-20 self-start z-10">
          <AccountSidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 max-w-[920px] w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
