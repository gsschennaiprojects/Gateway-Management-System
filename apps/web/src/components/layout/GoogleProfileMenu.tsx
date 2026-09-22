'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AccountAvatar } from '@/components/account/AccountAvatar';
import { LogOut, Settings, UserCheck, Shield, ChevronRight, MapPin } from 'lucide-react';

export function GoogleProfileMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 rounded-full hover:bg-[var(--bg-card-subtle,#F8FAFD)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-card,#DADCE0)]"
        title="GSS Account Profile"
        aria-expanded={isOpen}
      >
        <AccountAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
      </button>

      {/* Dropdown Panel — Pixel-perfect Google Workspace Account Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-3xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-2xl overflow-hidden z-50 animate-panel-entrance text-[var(--text-primary,#1F1F1F)]">
          {/* Header Card */}
          <div className="p-6 flex flex-col items-center text-center border-b border-[var(--border-card,#DADCE0)]">
            <div className="relative mb-3">
              <AccountAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[var(--badge-success-text,#137333)] border-2 border-[var(--bg-card,#FFFFFF)]" />
            </div>

            <h3 className="font-semibold text-base text-[var(--text-primary,#1F1F1F)]">
              {user.name}
            </h3>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5 font-mono">
              {user.email}
            </p>

            {/* Badges */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                {user.role}
              </span>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] border border-[var(--border-card,#DADCE0)] flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-[var(--brand-primary,#1A73E8)]" />
                <span>{user.branch}</span>
              </span>
            </div>

            {/* Google "Manage your Google Account" pill button */}
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="mt-4 px-6 py-2 rounded-full border border-[var(--border-card,#DADCE0)] hover:bg-[var(--bg-card-subtle,#F8FAFD)] text-sm font-medium text-[var(--brand-primary,#1A73E8)] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
              <span>Manage your GSS Account</span>
            </Link>
          </div>

          {/* Sign Out Button */}
          <div className="p-4 flex items-center justify-center bg-[var(--bg-card-subtle,#F8FAFD)]/40">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-[var(--border-card,#DADCE0)] hover:bg-[var(--badge-danger-bg,#FCE8E6)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:text-[var(--badge-danger-text,#D93025)] hover:border-[var(--badge-danger-border,#FAD2CF)] transition-colors cursor-pointer bg-[var(--bg-card,#FFFFFF)]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out of GSS Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
