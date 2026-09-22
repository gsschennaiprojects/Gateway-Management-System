'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import {
  CreditCard,
  Crown,
  Building2,
  Receipt,
  Wallet,
  ShieldCheck,
  Clock,
  FileText,
  Info,
} from 'lucide-react';

export default function PaymentsPage() {
  const { user } = useAuth();

  if (!user) return null;

  const roleLabel: Record<string, string> = {
    superadmin: 'Super Administrator',
    admin: 'Administrator',
    hr: 'HR Manager',
    employee: 'Employee',
    intern: 'Intern',
  };

  const roleBadgeColor: Record<string, 'blue' | 'orange' | 'green' | 'purple' | 'amber'> = {
    superadmin: 'purple',
    admin: 'blue',
    hr: 'green',
    employee: 'orange',
    intern: 'amber',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-2">
        <h1 className="text-2xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
          Payments & subscriptions
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[600px]">
          Manage your GSS subscription, payment methods, and view transaction history.
        </p>
      </div>

      {/* ── Subscription Status ── */}
      <AccountCard
        title="Subscription status"
        description="Your current GSS Management System plan"
        icon={<Crown className="w-5 h-5" />}
      >
        {/* Active plan card */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-4 p-5 rounded-xl bg-[var(--brand-container)] border border-[var(--border-subtle)]">
            <div className="w-14 h-14 rounded-2xl bg-[var(--brand-primary)]/15 border border-[var(--border-subtle)] flex items-center justify-center">
              <Crown className="w-7 h-7 text-[var(--brand-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  GSS Management System
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]">
                  Active
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Enterprise Operations Platform — Gateway Software Solutions
              </p>
            </div>
          </div>
        </div>

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<ShieldCheck className="w-5 h-5" />}
          label="Access level"
          badge={{
            text: roleLabel[user.role] || user.role,
            color: roleBadgeColor[user.role] || 'neutral',
          }}
          description="Your role determines which features you can access"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Clock className="w-5 h-5" />}
          label="Valid until"
          value="No expiry"
          description="Your subscription is managed by your organization"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Building2 className="w-5 h-5" />}
          label="Organization"
          value="Gateway Software Solutions"
          description={`Branch: ${user.branch}`}
          action="none"
        />
      </AccountCard>

      {/* ── Payment Methods ── */}
      <AccountCard
        title="Payment methods"
        icon={<Wallet className="w-5 h-5" />}
      >
        <div className="px-5 py-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)] flex items-center justify-center mb-4">
            <CreditCard className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Managed by your organization
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-sm leading-relaxed">
            Payment methods and billing are managed centrally by Gateway Software
            Solutions. Contact your administrator for billing inquiries.
          </p>
          <button className="mt-4 px-5 py-2 rounded-full text-xs font-medium text-[var(--brand-primary)] bg-[var(--brand-container)] border border-[var(--border-subtle)] hover:opacity-90 transition-all cursor-pointer">
            Contact admin
          </button>
        </div>
      </AccountCard>

      {/* ── Transaction History ── */}
      <AccountCard
        title="Transaction history"
        description="Your personal transaction records"
        icon={<Receipt className="w-5 h-5" />}
      >
        <div className="px-5 py-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)] flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            No personal transactions
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-sm leading-relaxed">
            There are no personal transactions associated with your GSS account.
            All billing is managed at the organizational level.
          </p>
        </div>
      </AccountCard>

      {/* ── Info Footer ── */}
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)]">
        <Info className="w-5 h-5 text-[var(--brand-primary)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[var(--text-primary)] font-medium">Note:</span>{' '}
          For questions about billing, invoicing, or payment terms, please contact
          your branch administrator or email{' '}
          <span className="text-[var(--brand-primary)]">billing@gatewaysoftware.in</span>.
        </p>
      </div>
    </div>
  );
}
