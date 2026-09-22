'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import {
  Info,
  MapPin,
  Code2,
  FileText,
  Shield,
  Heart,
  ExternalLink,
  Package,
  Globe,
  Building2,
  Mail,
  Phone,
  X,
  CheckCircle2,
} from 'lucide-react';

export default function AboutPage() {
  const router = useRouter();
  const [showLicenses, setShowLicenses] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-2">
        <h1 className="text-2xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
          About
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[600px]">
          Information about your GSS Management System and Gateway Software Solutions.
        </p>
      </div>

      {/* ── Product Info Card ── */}
      <AccountCard noPadding>
        <div className="px-5 py-6 flex flex-col items-center text-center">
          <BrandLogo size="lg" showText={false} />
          <h2 className="mt-4 text-xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
            <span>Gateway</span>{' '}
            <span className="text-[var(--text-secondary)]">Software</span>{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-primary)] to-[#FD7602]">
              Solutions
            </span>
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Enterprise Operations Platform
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--brand-container)] text-[var(--brand-primary)] border border-[var(--border-subtle)]">
              v1.0.0
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] border border-[var(--badge-success-border)]">
              Stable
            </span>
          </div>
        </div>
      </AccountCard>

      {/* ── System Information ── */}
      <AccountCard
        title="System information"
        icon={<Package className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Code2 className="w-5 h-5" />}
          label="Version"
          value="1.0.0"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Package className="w-5 h-5" />}
          label="Platform"
          value="Next.js 16 + React 19"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Shield className="w-5 h-5" />}
          label="Security"
          value="TLS 1.3 Encrypted"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Globe className="w-5 h-5" />}
          label="Environment"
          value="Production"
          action="none"
        />
      </AccountCard>

      {/* ── Gateway Software Solutions ── */}
      <AccountCard
        title="Gateway Software Solutions"
        description="Building software. Training talent. Solving problems."
        icon={<Building2 className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Globe className="w-5 h-5" />}
          label="Website"
          value="gatewaysoftware.in"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Mail className="w-5 h-5" />}
          label="Contact"
          value="gss.managementsystem@gmail.com"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Phone className="w-5 h-5" />}
          label="Support"
          value="Contact your branch admin"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Branch Locations ── */}
      <AccountCard
        title="Branch locations"
        icon={<MapPin className="w-5 h-5" />}
      >
        {['Coimbatore', 'Chennai', 'Madurai', 'Erode'].map((branch, i) => (
          <React.Fragment key={branch}>
            {i > 0 && <div className="mx-5 h-px bg-[var(--border-subtle)]" />}
            <AccountInfoRow
              icon={<MapPin className="w-5 h-5" />}
              label={branch}
              value="Active"
              description={`Gateway Software Solutions — ${branch} Branch`}
              action="none"
            />
          </React.Fragment>
        ))}
      </AccountCard>

      {/* ── Legal ── */}
      <AccountCard
        title="Legal & Governance"
        icon={<FileText className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<FileText className="w-5 h-5" />}
          label="Terms of Service"
          action="arrow"
          onClick={() => router.push('/terms')}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Shield className="w-5 h-5" />}
          label="Privacy Policy"
          action="arrow"
          onClick={() => router.push('/privacy')}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<FileText className="w-5 h-5" />}
          label="Open source licenses"
          action="arrow"
          onClick={() => setShowLicenses(true)}
        />
      </AccountCard>

      {/* ── Open Source Licenses Modal ── */}
      {showLicenses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-panel-entrance">
          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 px-6 border-b border-[var(--border-card,#DADCE0)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Open Source Software Notices</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLicenses(false)}
                className="p-1.5 rounded-full hover:bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-muted,#747775)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <p className="text-[var(--text-secondary,#5F6368)]">
                The GSS Management System incorporates open-source libraries under permissive licenses:
              </p>
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)]">
                  <p className="font-bold text-[var(--text-primary,#1F1F1F)]">Next.js & React (MIT License)</p>
                  <p className="text-[var(--text-muted,#747775)] mt-1">Copyright © 2026 Vercel, Inc. and Meta Platforms, Inc.</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)]">
                  <p className="font-bold text-[var(--text-primary,#1F1F1F)]">Tailwind CSS (MIT License)</p>
                  <p className="text-[var(--text-muted,#747775)] mt-1">Copyright © Tailwind Labs, Inc.</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)]">
                  <p className="font-bold text-[var(--text-primary,#1F1F1F)]">Lucide Icons (ISC License)</p>
                  <p className="text-[var(--text-muted,#747775)] mt-1">Copyright © Lucide Contributors</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)]">
                  <p className="font-bold text-[var(--text-primary,#1F1F1F)]">SheetJS & docx (Apache 2.0 / MIT)</p>
                  <p className="text-[var(--text-muted,#747775)] mt-1">Document formatting and spreadsheet generation components.</p>
                </div>
              </div>
            </div>

            <div className="p-4 px-6 border-t border-[var(--border-card,#DADCE0)] flex justify-end bg-[var(--bg-card-subtle,#F8FAFD)]">
              <button
                type="button"
                onClick={() => setShowLicenses(false)}
                className="px-4 py-2 rounded-xl bg-[var(--brand-primary,#1A73E8)] text-white text-xs font-medium hover:opacity-90 transition cursor-pointer"
              >
                Close Notices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex flex-col items-center py-6 text-center">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Built with{' '}
          <Heart className="w-3 h-3 inline-block text-[var(--badge-danger-text)] fill-[var(--badge-danger-text)] mx-0.5" />{' '}
          by Gateway Software Solutions
        </p>
        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1.5">
          © {new Date().getFullYear()} Gateway Software Solutions. All rights reserved.
        </p>
      </div>
    </div>
  );
}
