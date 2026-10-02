'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import { AccountAvatar } from '@/components/account/AccountAvatar';
import {
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  GraduationCap,
  CalendarDays,
  Globe,
  Clock,
  Camera,
  X,
  Check,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function PersonalInfoPage() {
  const { user, refreshSession } = useAuth();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!user) return null;

  const isElevatedRole = ['superadmin', 'admin', 'hr'].includes(user.role);

  const startEdit = (field: string, currentValue: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingField(field);
    setEditValues((prev) => ({ ...prev, [field]: currentValue }));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setErrorMessage(null);
  };

  const handleSave = async (field: string) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, unknown> = {};

      if (field === 'name') payload.name = editValues.name;
      if (field === 'gender') payload.gender = editValues.gender;
      if (field === 'dob') payload.dob = editValues.dob;
      if (field === 'doj') {
        payload.doj = editValues.doj;
        payload.dateOfJoining = editValues.doj;
      }
      if (field === 'mobile') payload.mobile = editValues.mobile;
      if (field === 'recoveryEmail') payload.recoveryEmail = editValues.recoveryEmail;

      if (field === 'shiftTiming') {
        payload.entryTime = editValues.entryTime || user.entryTime || '09:30 AM';
        payload.exitTime = editValues.exitTime || user.exitTime || '06:30 PM';
        payload.shiftTiming = {
          entryTime: editValues.entryTime || user.entryTime || '09:30 AM',
          exitTime: editValues.exitTime || user.exitTime || '06:30 PM',
        };
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to update profile.');
        return;
      }

      await refreshSession();
      setSuccessMessage('Profile detail successfully updated.');
      setEditingField(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage('Network error while saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      }
    } catch {}
    return dateStr;
  };

  const roleColorMap: Record<string, 'blue' | 'orange' | 'green' | 'purple' | 'amber'> = {
    superadmin: 'purple',
    admin: 'blue',
    hr: 'green',
    employee: 'orange',
    intern: 'amber',
  };

  const currentGender = user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not specified';
  const currentDob = user.dob ? formatDisplayDate(user.dob) : 'Not set';
  const currentDoj = user.doj || user.dateOfJoining ? formatDisplayDate(user.doj || user.dateOfJoining) : user.startDate ? formatDisplayDate(user.startDate) : 'Not set';
  const currentShift = `${user.entryTime || user.shiftTiming?.entryTime || '09:30 AM'} – ${user.exitTime || user.shiftTiming?.exitTime || '06:30 PM'}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-panel-entrance">
      {/* Page Header */}
      <div className="pb-2">
        <h1 className="text-2xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
          Personal info
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[650px]">
          Maintain your personal details, corporate contact info, and official GSS schedule. Click on any field to fill or update it directly.
        </p>

        {successMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-fade-in-up">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-medium animate-fade-in-up">
            <X className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ── Profile Photo Section ── */}
      <AccountCard
        title="Your profile photo"
        description="A profile photo helps personalize your GSS account across internal portals"
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
                Staff ID: <span className="font-mono font-medium text-[var(--brand-primary)]">{user.employeeId || user.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => alert('Photo avatar uploading will sync with cloud storage in the next update.')}
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
        description="Personal details verified across Gateway Software Solutions HR directory"
        icon={<UserIcon className="w-5 h-5" />}
      >
        {/* Name */}
        {editingField === 'name' ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Full Legal Name
            </label>
            <input
              type="text"
              value={editValues.name ?? user.name}
              onChange={(e) => setEditValues((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full max-w-sm h-10 px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={isSaving}
                onClick={() => handleSave('name')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
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

        {/* Date of Birth (DOB) */}
        {editingField === 'dob' ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Date of Birth (DOB)
            </label>
            <input
              type="date"
              value={editValues.dob ?? user.dob ?? ''}
              onChange={(e) => setEditValues((prev) => ({ ...prev, dob: e.target.value }))}
              className="w-full max-w-sm h-10 px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all"
              autoFocus
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
              Used strictly for confidential HR compliance and anniversary records.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={isSaving}
                onClick={() => handleSave('dob')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            label="Birthday"
            value={currentDob}
            description="To keep your account verified, your date of birth is maintained in HR records"
            action="arrow"
            onClick={() => startEdit('dob', user.dob || '')}
          />
        )}

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Gender */}
        {editingField === 'gender' ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Gender
            </label>
            <div className="flex items-center gap-3 max-w-sm">
              {(['male', 'female', 'other'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setEditValues((prev) => ({ ...prev, gender: g }))}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    (editValues.gender ?? user.gender ?? 'male') === g
                      ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-xs'
                      : 'bg-[var(--bg-card)] border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={isSaving}
                onClick={() => handleSave('gender')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            label="Gender"
            value={currentGender}
            action="arrow"
            onClick={() => startEdit('gender', user.gender || 'male')}
          />
        )}
      </AccountCard>

      {/* ── Contact Info ── */}
      <AccountCard
        title="Contact info"
        description="Official email and mobile number used for work alerts and notifications"
        icon={<Mail className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Mail className="w-5 h-5" />}
          label="Corporate Email"
          value={user.email}
          description="Primary account identifier (managed by IT Administration)"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Mobile */}
        {editingField === 'mobile' ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Mobile Contact Number
            </label>
            <div className="relative max-w-sm">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--text-muted)]">
                +91
              </span>
              <input
                type="tel"
                value={(editValues.mobile ?? user.mobile ?? '').replace(/^\+91/, '')}
                onChange={(e) => setEditValues((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                placeholder="10-digit mobile number"
                className="w-full h-10 pl-12 pr-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={isSaving}
                onClick={() => handleSave('mobile')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            icon={<Phone className="w-5 h-5" />}
            label="Phone"
            value={user.mobile || 'Not set'}
            description="Used for security verification and emergency communications"
            action="arrow"
            onClick={() => startEdit('mobile', user.mobile || '')}
          />
        )}

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Recovery Email */}
        {editingField === 'recoveryEmail' ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Alternate / Recovery Email
            </label>
            <input
              type="email"
              value={editValues.recoveryEmail ?? ''}
              onChange={(e) => setEditValues((prev) => ({ ...prev, recoveryEmail: e.target.value }))}
              placeholder="e.g. personal@gmail.com"
              className="w-full max-w-sm h-10 px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={isSaving}
                onClick={() => handleSave('recoveryEmail')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            icon={<Mail className="w-5 h-5" />}
            label="Recovery email"
            value="Not set"
            description="Helps you restore credentials if you lose access to corporate email"
            action="arrow"
            onClick={() => startEdit('recoveryEmail', '')}
          />
        )}
      </AccountCard>

      {/* ── Work Info (GSS-specific) ── */}
      <AccountCard
        title="Work info & Shift Timing"
        description="Your organizational details and official shift schedule within Gateway Software Solutions"
        icon={<Briefcase className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Briefcase className="w-5 h-5" />}
          label="Role"
          badge={{
            text: user.role,
            color: roleColorMap[user.role] || 'neutral',
          }}
          description="Your organizational permissions tier is configured by HR & Super Admin"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<MapPin className="w-5 h-5" />}
          label="Branch"
          value={`${user.branch} Branch`}
          description="Your assigned physical campus and attendance jurisdiction"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<GraduationCap className="w-5 h-5" />}
          label="Specialization"
          value={user.majorSpecialization || user.specialization || user.specializations?.join(', ') || 'Operations'}
          description="Your primary technology stack and student mentorship domain"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Date of Joining (DOJ) */}
        {editingField === 'doj' ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Official Date of Joining (DOJ)
            </label>
            <input
              type="date"
              value={editValues.doj ?? user.doj ?? user.dateOfJoining ?? user.startDate ?? ''}
              onChange={(e) => setEditValues((prev) => ({ ...prev, doj: e.target.value }))}
              className="w-full max-w-sm h-10 px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={isSaving}
                onClick={() => handleSave('doj')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            icon={<CalendarDays className="w-5 h-5" />}
            label="Date of Joining"
            value={currentDoj}
            description="When your official service tenure commenced at GSS"
            action="arrow"
            onClick={() => startEdit('doj', user.doj || user.dateOfJoining || user.startDate || '')}
          />
        )}

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        {/* Shift Timing (Entry Timing & Exit Timing) */}
        {editingField === 'shiftTiming' && isElevatedRole ? (
          <div className="px-5 py-4 bg-[var(--bg-card-subtle)] border-y border-[var(--border-card)]">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Configured Shift Timing (Entry & Exit)
              </label>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand-container)] text-[var(--brand-primary)] border border-[var(--border-subtle)]">
                Admin / HR Privilege
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div>
                <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                  Expected Entry Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09:30 AM"
                  value={editValues.entryTime ?? user.entryTime ?? '09:30 AM'}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, entryTime: e.target.value }))}
                  className="w-full h-10 px-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                  Expected Exit Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 06:30 PM"
                  value={editValues.exitTime ?? user.exitTime ?? '06:30 PM'}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, exitTime: e.target.value }))}
                  className="w-full h-10 px-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none transition-all font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-[var(--text-muted)]">Quick presets:</span>
              <button
                type="button"
                onClick={() => setEditValues((prev) => ({ ...prev, entryTime: '09:30 AM', exitTime: '06:30 PM' }))}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--brand-primary)] text-[var(--text-secondary)]"
              >
                09:30 AM – 06:30 PM (Standard)
              </button>
              <button
                type="button"
                onClick={() => setEditValues((prev) => ({ ...prev, entryTime: '09:00 AM', exitTime: '06:00 PM' }))}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--brand-primary)] text-[var(--text-secondary)]"
              >
                09:00 AM – 06:00 PM
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3.5">
              <button
                disabled={isSaving}
                onClick={() => handleSave('shiftTiming')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--brand-primary)] text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Shift Timing
              </button>
              <button
                disabled={isSaving}
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <AccountInfoRow
            icon={<Clock className="w-5 h-5" />}
            label="Shift Timing"
            value={currentShift}
            description={
              isElevatedRole
                ? 'Official office hours (Entry & Exit). Click to modify as Admin/HR.'
                : 'Official office hours (Configured by Branch Admin & HR operations)'
            }
            badge={!isElevatedRole ? { text: 'Admin / HR Maintained', color: 'neutral' } : undefined}
            action={isElevatedRole ? 'arrow' : 'none'}
            onClick={() => {
              if (isElevatedRole) {
                startEdit('shiftTiming', currentShift);
                setEditValues((prev) => ({
                  ...prev,
                  entryTime: user.entryTime || user.shiftTiming?.entryTime || '09:30 AM',
                  exitTime: user.exitTime || user.shiftTiming?.exitTime || '06:30 PM',
                }));
              }
            }}
          />
        )}
      </AccountCard>

      {/* ── Profile Preferences ── */}
      <AccountCard
        title="Preferences"
        description="Regional and platform display settings"
        icon={<Globe className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Globe className="w-5 h-5" />}
          label="Language"
          value="English (India)"
          action="none"
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Clock className="w-5 h-5" />}
          label="Timezone"
          value="Asia/Kolkata (IST, UTC+5:30)"
          action="none"
        />
      </AccountCard>
    </div>
  );
}
