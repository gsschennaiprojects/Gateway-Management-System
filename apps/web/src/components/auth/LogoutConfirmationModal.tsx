'use client';

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountAvatar } from '@/components/account/AccountAvatar';
import { LogOut, ShieldAlert, X, AlertTriangle, MapPin, Loader2 } from 'lucide-react';

export function LogoutConfirmationModal() {
  const { user, isLogoutModalOpen, cancelLogout, confirmLogout, isLoggingOut } = useAuth();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isLogoutModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoggingOut) {
        cancelLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus cancel button for safe keyboard navigation
    const timeout = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isLogoutModalOpen, isLoggingOut, cancelLogout]);

  if (!isLogoutModalOpen || !user) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        // Close if backdrop clicked
        if (e.target === e.currentTarget && !isLoggingOut) {
          cancelLogout();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-3xl shadow-2xl overflow-hidden animate-panel-entrance text-[var(--text-primary,#1F1F1F)]">
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-500 to-red-600" />

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={cancelLogout}
          disabled={isLoggingOut}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header with Step Badge */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] flex items-center justify-center shrink-0 shadow-xs">
              <LogOut className="w-6 h-6 text-[var(--badge-danger-text,#D93025)]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] text-[10px] font-semibold uppercase tracking-wider mb-1">
                <span>Step 2 of 2: Confirmation</span>
              </div>
              <h2 id="logout-modal-title" className="text-lg font-bold text-[var(--text-primary,#1F1F1F)]">
                Confirm Sign Out
              </h2>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Please verify that you want to end your current session.
              </p>
            </div>
          </div>

          {/* User ID Card */}
          <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] flex items-center gap-3.5">
            <AccountAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] truncate">
                  {user.name}
                </p>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--border-subtle,#E8EAED)] text-[var(--text-secondary,#444746)] font-semibold shrink-0">
                  {user.id}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] truncate font-mono mt-0.5">
                {user.email}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-muted,#5F6368)]">
                <span className="capitalize font-medium text-[var(--brand-primary,#1A73E8)]">{user.role}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-[var(--brand-primary,#1A73E8)]" />
                  {user.branch}
                </span>
              </div>
            </div>
          </div>

          {/* Warning Message Box */}
          <div className="p-3.5 rounded-xl bg-[var(--badge-warning-bg,#FEF7E0)] border border-[var(--badge-warning-border,#FEEFC3)] text-[var(--badge-warning-text,#B06000)] text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">Your session will be securely closed</p>
              <p className="text-[11px] opacity-90 leading-relaxed">
                You will be returned to the login screen. You will need your Gmail address or Mobile number and password to sign back in.
              </p>
            </div>
          </div>

          {/* Two Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={cancelLogout}
              disabled={isLoggingOut}
              className="px-4 py-2.5 rounded-full border border-[var(--border-card,#DADCE0)] text-xs font-semibold text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--bg-card-subtle,#F1F3F4)] transition-all cursor-pointer disabled:opacity-50"
            >
              Stay Signed In
            </button>
            <button
              type="button"
              onClick={() => confirmLogout()}
              disabled={isLoggingOut}
              className="px-5 py-2.5 rounded-full bg-[var(--badge-danger-text,#D93025)] hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Yes, Sign Out</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
