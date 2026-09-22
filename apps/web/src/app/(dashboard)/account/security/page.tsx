'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import { SecurityCheckupBanner } from '@/components/account/SecurityCheckupBanner';
import {
  Key,
  Fingerprint,
  Smartphone,
  Monitor,
  Shield,
  Clock,
  MapPin,
  LogIn,
  ShieldCheck,
  Mail,
  Phone,
  AlertTriangle,
  Laptop,
  Globe,
} from 'lucide-react';

interface DeviceEntry {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  location: string;
  lastActive: string;
  isCurrent: boolean;
  browser: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  location: string;
  timestamp: string;
  device: string;
  icon: React.ReactNode;
}

export default function SecurityPage() {
  const { user } = useAuth();

  const activeDevices: DeviceEntry[] = [
    {
      id: 'dev_current',
      name: 'Current Workstation',
      type: 'desktop',
      location: user?.branch ? `${user.branch}, India` : 'Coimbatore, India',
      lastActive: 'Active now',
      isCurrent: true,
      browser: 'Web Browser Session',
    }
  ];

  const recentActivity: ActivityEntry[] = [
    {
      id: 'act_1',
      action: 'Authenticated session active',
      location: user?.branch ? `${user.branch}, India` : 'Coimbatore, India',
      timestamp: 'Current active session',
      device: 'Secure Web Client',
      icon: <LogIn className="w-4 h-4" />,
    }
  ];
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  if (!user) return null;

  const deviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Monitor className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-2">
        <h1 className="text-2xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
          Security
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[600px]">
          Settings and recommendations to help you keep your GSS account secure.
        </p>
      </div>

      {/* ── Security Checkup Banner ── */}
      <SecurityCheckupBanner
        status={twoFactorEnabled ? 'safe' : 'warning'}
        title={
          twoFactorEnabled
            ? 'Your account is protected'
            : 'Security recommendations available'
        }
        description={
          twoFactorEnabled
            ? 'Security checkup found no issues with your account. All protections are active.'
            : 'Enable two-factor authentication to add an extra layer of security to your account.'
        }
        actionLabel="Security checkup"
      />

      {/* ── How You Sign In ── */}
      <AccountCard
        title="How you sign in to GSS"
        description="Manage your password and sign-in options"
        icon={<Key className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Fingerprint className="w-5 h-5" />}
          label="Password"
          value="Last changed: Never"
          description="Strengthen your account by updating your password regularly"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<ShieldCheck className="w-5 h-5" />}
          label="Two-factor authentication"
          description={
            twoFactorEnabled
              ? 'An extra layer of security is active on your account'
              : 'Add an extra layer of security to your account'
          }
          action="toggle"
          toggleValue={twoFactorEnabled}
          onToggle={setTwoFactorEnabled}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Mail className="w-5 h-5" />}
          label="Recovery email"
          value="Not set"
          description="Used to verify your identity if you lose access"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Phone className="w-5 h-5" />}
          label="Recovery phone"
          value={user.mobile || 'Not set'}
          description="Used for account recovery and verification"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Your Devices ── */}
      <AccountCard
        title="Your devices"
        description="Devices where you're currently signed in to your GSS account"
        icon={<Monitor className="w-5 h-5" />}
        footerLink={{
          label: 'Sign out of all other sessions',
          onClick: () => {},
        }}
      >
        {activeDevices.map((device, i) => (
          <React.Fragment key={device.id}>
            {i > 0 && <div className="mx-5 h-px bg-[var(--border-subtle)]" />}
            <AccountInfoRow
              icon={deviceIcon(device.type)}
              label={device.name}
              description={`${device.browser} · ${device.location}`}
              action="custom"
              customAction={
                <div className="flex items-center gap-2">
                  {device.isCurrent && (
                    <span className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--badge-success-text)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-success-text)] shadow-xs animate-pulse" />
                      This device
                    </span>
                  )}
                  {!device.isCurrent && (
                    <span className="text-xs text-[var(--text-secondary)] font-mono">
                      {device.lastActive}
                    </span>
                  )}
                </div>
              }
              onClick={() => {}}
            />
          </React.Fragment>
        ))}
      </AccountCard>

      {/* ── Recent Security Activity ── */}
      <AccountCard
        title="Recent security activity"
        description="Review recent sign-ins and security events"
        icon={<Clock className="w-5 h-5" />}
        footerLink={{
          label: 'View all security activity',
          onClick: () => {},
        }}
      >
        {recentActivity.map((activity, i) => (
          <React.Fragment key={activity.id}>
            {i > 0 && <div className="mx-5 h-px bg-[var(--border-subtle)]" />}
            <AccountInfoRow
              icon={activity.icon}
              label={activity.action}
              description={`${activity.device} · ${activity.timestamp}`}
              action="custom"
              customAction={
                <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] font-mono">
                  <MapPin className="w-3 h-3" />
                  {activity.location}
                </span>
              }
            />
          </React.Fragment>
        ))}
      </AccountCard>

      {/* ── Security Tips ── */}
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)]">
        <AlertTriangle className="w-5 h-5 text-[var(--badge-warning-text)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[var(--text-primary)] font-medium">Security tip:</span>{' '}
          If you notice any unfamiliar activity on your account, change your password
          immediately and contact your GSS administrator. Never share your credentials
          with anyone.
        </p>
      </div>
    </div>
  );
}
