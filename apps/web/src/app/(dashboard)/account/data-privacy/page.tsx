'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import {
  Lightbulb,
  History,
  ClipboardList,
  MapPin,
  Download,
  Trash2,
  Eye,
  AppWindow,
  CalendarCheck,
  FileText,
  Activity,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

export default function DataPrivacyPage() {
  const { user } = useAuth();
  const [workActivity, setWorkActivity] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState(true);
  const [locationHistory, setLocationHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-2">
        <h1 className="text-2xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
          Data & privacy
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[600px]">
          Data settings and controls to help you manage what data is saved in your GSS
          account, and how your information is used to personalize your experience.
        </p>
      </div>

      {/* ── Privacy Suggestions Banner ── */}
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-[var(--brand-container)] border border-[var(--border-subtle)] animate-fade-in-up">
        <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--brand-primary)]/15 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-[var(--brand-primary)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Privacy suggestions available
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            Review 3 privacy suggestions to enhance how your data is handled within GSS
            Management System.
          </p>
          <button className="mt-3 text-sm font-medium text-[var(--brand-primary)] hover:opacity-80 transition-colors cursor-pointer">
            Review suggestions
          </button>
        </div>
      </div>

      {/* ── History Settings ── */}
      <AccountCard
        title="History settings"
        description="Choose what activity data is saved in your GSS account"
        icon={<History className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<ClipboardList className="w-5 h-5" />}
          label="Work Activity"
          description="Your task submissions, worklogs, and daily activity are saved to help generate reports and track progress"
          action="toggle"
          toggleValue={workActivity}
          onToggle={setWorkActivity}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<CalendarCheck className="w-5 h-5" />}
          label="Attendance History"
          description="Login/logout records and attendance data are stored for compliance and monthly reporting"
          action="toggle"
          toggleValue={attendanceHistory}
          onToggle={setAttendanceHistory}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<MapPin className="w-5 h-5" />}
          label="Location History"
          description="Track which branch you signed in from. Currently not collected."
          action="toggle"
          toggleValue={locationHistory}
          onToggle={setLocationHistory}
        />
      </AccountCard>

      {/* ── Data from Apps & Services ── */}
      <AccountCard
        title="Data from apps & services you use"
        description="Content and information saved from GSS services"
        icon={<AppWindow className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Activity className="w-5 h-5" />}
          label="GSS Dashboard"
          description="Attendance gauges, student management, daily login/logout"
          value="Active"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<ClipboardList className="w-5 h-5" />}
          label="Task Management"
          description="Assigned tasks, delegations, and completion tracking"
          value="Active"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<FileText className="w-5 h-5" />}
          label="Monthly Reports"
          description="Auto-generated reports based on your activity data"
          value="Active"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Eye className="w-5 h-5" />}
          label="Leads & Inquiries"
          description="Lead pipeline and email campaign data"
          value={user.role === 'hr' || user.role === 'admin' || user.role === 'superadmin' ? 'Active' : 'No access'}
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Download or Delete Data ── */}
      <AccountCard
        title="Download or delete your data"
        description="You can download a copy of your data or request account deletion"
        icon={<Download className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<Download className="w-5 h-5" />}
          label="Download your data"
          description="Export a copy of your attendance records, worklogs, and reports"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Trash2 className="w-5 h-5" />}
          label="Delete your GSS account"
          description="Permanently delete your account and all associated data"
          action="arrow"
          danger
          onClick={() => setShowDeleteConfirm(true)}
        />
      </AccountCard>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-card)] shadow-2xl rounded-2xl p-6 animate-panel-entrance z-10 text-[var(--text-primary)]">
            <div className="flex items-start gap-4 mb-5">
              <div className="shrink-0 w-12 h-12 rounded-full bg-[var(--badge-danger-bg)] border border-[var(--badge-danger-border)] flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-[var(--badge-danger-text)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Delete your GSS account?
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  This will permanently delete <span className="text-[var(--text-primary)] font-medium">{user.name}&apos;s</span> account
                  and all associated data including attendance records, worklogs, and
                  reports. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-subtle)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--badge-danger-text)] hover:opacity-90 transition-all shadow-xs cursor-pointer"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Info Footer ── */}
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)]">
        <AlertTriangle className="w-5 h-5 text-[var(--badge-warning-text)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[var(--text-primary)] font-medium">Data retention note:</span>{' '}
          Some data such as attendance records may be retained for compliance purposes
          even after account deletion, as per organizational policy. Contact your
          administrator for details.
        </p>
      </div>
    </div>
  );
}
