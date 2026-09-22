'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AccountAvatar } from '@/components/account/AccountAvatar';
import { AccountSearchBar } from '@/components/account/AccountSearchBar';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import { SecurityCheckupBanner } from '@/components/account/SecurityCheckupBanner';
import {
  Lock,
  Eye,
  Shield,
  Fingerprint,
  HardDrive,
  Bell,
  Info,
} from 'lucide-react';

export default function AccountHomePage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleChipClick = (chip: { label: string; href: string }) => {
    router.push(chip.href);
  };

  return (
    <div className="space-y-8">
      {/* ── Hero Section ── */}
      <div className="flex flex-col items-center text-center pt-4 pb-2">
        {/* Avatar */}
        <AccountAvatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          size="xl"
          editable
          onEditClick={() => router.push('/account/personal-info')}
        />

        {/* Name & Email */}
        <h1 className="mt-5 text-2xl sm:text-3xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
          {user.name}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary,#5F6368)]">{user.email}</p>

        {/* Search */}
        <div className="mt-6 w-full">
          <AccountSearchBar onChipClick={handleChipClick} />
        </div>
      </div>

      {/* ── Security Checkup Banner ── */}
      <SecurityCheckupBanner
        status="safe"
        onAction={() => router.push('/account/security')}
      />

      {/* ── Privacy & Personalization Card ── */}
      <AccountCard
        title="Privacy & Personalization"
        description="See the data in your GSS Account and choose what activity is saved to personalize your experience"
        icon={<Eye className="w-5 h-5" />}
        footerLink={{
          label: 'Manage your data & privacy',
          onClick: () => router.push('/account/data-privacy'),
        }}
      >
        <AccountInfoRow
          icon={<Lock className="w-5 h-5" />}
          label="Work Activity"
          value="Saved"
          description="Your tasks, worklogs, and attendance records"
          action="arrow"
          onClick={() => router.push('/account/data-privacy')}
        />
        <div className="mx-5 h-px bg-[var(--border-subtle)]" />
        <AccountInfoRow
          icon={<Bell className="w-5 h-5" />}
          label="Notification preferences"
          value="All enabled"
          description="Manage what alerts you receive"
          action="arrow"
          onClick={() => router.push('/account/people-sharing')}
        />
      </AccountCard>

      {/* ── Quick Settings Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Security Card */}
        <AccountCard
          title="Security"
          icon={<Shield className="w-5 h-5" />}
          footerLink={{
            label: 'See security recommendations',
            onClick: () => router.push('/account/security'),
          }}
        >
          <AccountInfoRow
            icon={<Fingerprint className="w-5 h-5" />}
            label="Password"
            value="Set"
            action="arrow"
            onClick={() => router.push('/account/security')}
          />
          <div className="mx-5 h-px bg-[var(--border-subtle)]" />
          <AccountInfoRow
            icon={<HardDrive className="w-5 h-5" />}
            label="Your devices"
            value="1 device"
            action="arrow"
            onClick={() => router.push('/account/security')}
          />
        </AccountCard>

        {/* Personal Info Card */}
        <AccountCard
          title="Personal Info"
          icon={<Info className="w-5 h-5" />}
          footerLink={{
            label: 'View personal info',
            onClick: () => router.push('/account/personal-info'),
          }}
        >
          <AccountInfoRow
            label="Name"
            value={user.name}
            action="arrow"
            onClick={() => router.push('/account/personal-info')}
          />
          <div className="mx-5 h-px bg-[var(--border-subtle)]" />
          <AccountInfoRow
            label="Email"
            value={user.email}
            action="arrow"
            onClick={() => router.push('/account/personal-info')}
          />
        </AccountCard>
      </div>

      {/* ── Footer Note ── */}
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)]">
        <div className="w-8 h-8 rounded-full bg-[var(--brand-container)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-[var(--brand-primary)]">G</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Only you can see your settings. You might also want to review your settings for{' '}
          <span className="text-[var(--text-primary)] font-medium">Dashboard</span>,{' '}
          <span className="text-[var(--text-primary)] font-medium">Reports</span>, or whichever GSS services you
          use most. Gateway Software Solutions keeps your data private, safe, and secure.
        </p>
      </div>
    </div>
  );
}
