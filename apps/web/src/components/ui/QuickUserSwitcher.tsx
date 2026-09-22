'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { INITIAL_USERS } from '@/lib/auth/mock-users';
import { ChevronDown, Check, Sparkles, MapPin } from 'lucide-react';

export function QuickUserSwitcher() {
  const { user, quickLogin, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSwitch = async (email: string) => {
    await quickLogin(email);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] hover:bg-[var(--bg-card-hover,#E8EAED)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#444746)] hover:text-[var(--text-primary,#1F1F1F)] transition-all cursor-pointer"
        title="Switch demo persona for testing"
      >
        <Sparkles className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
        <span className="font-medium text-[var(--brand-primary,#1A73E8)]">Persona:</span>
        <span className="font-medium text-[var(--text-primary,#1F1F1F)] max-w-[120px] sm:max-w-none truncate">
          {user ? `${user.name.split(' ')[0]} (${user.role} • ${user.branch})` : 'Select Persona'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted,#5F6368)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-2xl p-2.5 z-50 animate-panel-entrance">
          <div className="px-3 py-2 border-b border-[var(--border-card,#DADCE0)] mb-1.5">
            <p className="text-[11px] font-semibold text-[var(--text-primary,#1F1F1F)] uppercase tracking-wider">
              Instant Demo Personas
            </p>
            <p className="text-[10px] text-[var(--text-muted,#5F6368)]">
              Switch roles & branches to test RBAC & branch isolation
            </p>
          </div>

          <div className="space-y-1 max-h-[380px] overflow-y-auto">
            {INITIAL_USERS.map((demoUser) => {
              const isCurrent = user?.email === demoUser.email;
              const roleBadgeColor = {
                superadmin: 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] border-[var(--border-subtle,#D2E3FC)]',
                admin: 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border-[var(--border-subtle,#D2E3FC)]',
                hr: 'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border-[var(--badge-success-border,#CEEAD6)]',
                employee: 'bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border-[var(--badge-warning-border,#FEEFC3)]',
                intern: 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] border-[var(--border-card,#DADCE0)]',
              }[demoUser.role] || 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] border-[var(--border-card,#DADCE0)]';

              return (
                <button
                  key={demoUser.id}
                  onClick={() => handleSwitch(demoUser.email)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#001D35)] font-medium'
                      : 'hover:bg-[var(--nav-hover-bg,#F8FAFD)] text-[var(--text-primary,#1F1F1F)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-card-subtle,#E8EAED)] flex items-center justify-center text-xs font-semibold text-[var(--text-primary,#1F1F1F)] shrink-0">
                      {demoUser.name.charAt(0)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-medium text-[var(--text-primary,#1F1F1F)] truncate">
                          {demoUser.name}
                        </span>
                        {demoUser.status === 'pending' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)] shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted,#5F6368)]">
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-[var(--brand-primary,#1A73E8)]" />
                          {demoUser.branch}
                        </span>
                        {demoUser.specialization && (
                          <>
                            <span>•</span>
                            <span className="truncate">{demoUser.specialization}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span
                      className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded-full border ${roleBadgeColor}`}
                    >
                      {demoUser.role}
                    </span>
                    {isCurrent && (
                      <Check className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)] shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
