'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import { AccountAvatar } from '@/components/account/AccountAvatar';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  GraduationCap,
  CalendarDays,
  Globe,
  Clock,
  Camera,
  Pencil,
  X,
  Check,
} from 'lucide-react';

export default function PersonalInfoPage() {
  const { user } = useAuth();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  if (!user) return null;

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValues((prev) => ({ ...prev, [field]: currentValue }));
  };

  const cancelEdit = () => setEditingField(null);
  const saveEdit = () => setEditingField(null);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    return dateStr;
  };

  const roleColorMap: Record<string, 'blue' | 'orange' | 'green' | 'purple' | 'amber'> = {
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
          Personal info
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[600px]">
          Info about you and your preferences across GSS services. Some info may be visible to other people using GSS Management System.
        </p>
      </div>

      {/* ── Profile Photo Section ── */}
      <AccountCard
        title="Your profile photo"
        description="A profile photo helps personalize your GSS account"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-4">
            <AccountAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              size="lg"
              editable
            />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Visible to other GSS users
              </p>
            </div>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[var(--brand-primary)] bg-[var(--brand-container)] border border-[var(--border-subtle)] hover:opacity-90 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Change</span>
          </button>
        </div>
      </AccountCard>

      {/* ── Basic Info ── */}
      <AccountCard
        title="Basic info"
        description="Some info may be visible to other people using GSS services"
        icon={<User className="w-5 h-5" />}
      >
        {/* Name */}
        {editingField === 'name' ? (
          <div className="px-5 py-4">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={editValues.name || ''}
              onChange={(e) => setEditValues((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full max-w-sm h-10 px-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)] transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            label="Name"
            value={user.name}
            action="arrow"
            onClick={() => startEdit('name', user.name)}
          />
        )}

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Birthday (placeholder) */}
        <AccountInfoRow
          label="Birthday"
          value="Not set"
          description="To keep your account secure, only you can see your birthday"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Gender (placeholder) */}
        <AccountInfoRow
          label="Gender"
          value="Not specified"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Contact Info ── */}
      <AccountCard
        title="Contact info"
        icon={<Mail className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Mail className="w-5 h-5" />}
          label="Email"
          value={user.email}
          description="This is your primary GSS account email"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Phone className="w-5 h-5" />}
          label="Phone"
          value={user.mobile || 'Not set'}
          description="Used for account recovery and notifications"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Mail className="w-5 h-5" />}
          label="Recovery email"
          value="Not set"
          description="Helps you get back into your account if you lose access"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Work Info (GSS-specific) ── */}
      <AccountCard
        title="Work info"
        description="Your organizational details within Gateway Software Solutions"
        icon={<Briefcase className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Briefcase className="w-5 h-5" />}
          label="Role"
          badge={{
            text: user.role,
            color: roleColorMap[user.role] || 'neutral',
          }}
          description="Your organizational role is managed by your administrator"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<MapPin className="w-5 h-5" />}
          label="Branch"
          value={user.branch}
          description="Your assigned office location"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<GraduationCap className="w-5 h-5" />}
          label="Specialization"
          value={user.specialization || user.specializations?.join(', ') || 'Not set'}
          description="Your area of expertise"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<CalendarDays className="w-5 h-5" />}
          label="Start date"
          value={formatDate(user.startDate || user.startMonthYear)}
          description="When you joined GSS"
          action="none"
        />

        {user.endDate && (
          <>
            <div className="mx-5 h-px bg-[var(--border-subtle)]" />
            <AccountInfoRow
              icon={<CalendarDays className="w-5 h-5" />}
              label="End date"
              value={formatDate(user.endDate)}
              description="Course or internship completion date"
              action="none"
            />
          </>
        )}
      </AccountCard>

      {/* ── Profile Preferences ── */}
      <AccountCard
        title="Preferences"
        description="Customize your GSS experience"
        icon={<Globe className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Globe className="w-5 h-5" />}
          label="Language"
          value="English (United States)"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Clock className="w-5 h-5" />}
          label="Timezone"
          value="Asia/Kolkata (IST, UTC+5:30)"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>
    </div>
  );
}
