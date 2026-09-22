'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountCard } from '@/components/account/AccountCard';
import { AccountInfoRow } from '@/components/account/AccountInfoRow';
import {
  Users,
  UserPlus,
  UserX,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Share2,
  AtSign,
  FileText,
  ClipboardList,
  MessageSquare,
  Globe,
  Lock,
} from 'lucide-react';

export default function PeopleSharingPage() {
  const { user } = useAuth();
  const [profileVisible, setProfileVisible] = useState(true);
  const [activitySharing, setActivitySharing] = useState(true);
  const [mentionNotifications, setMentionNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [reportNotifications, setReportNotifications] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-2">
        <h1 className="text-2xl font-serif font-semibold text-[var(--text-primary)] tracking-tight">
          People & sharing
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed max-w-[600px]">
          Control what others see about you and manage your sharing preferences
          across GSS Management System.
        </p>
      </div>

      {/* ── Contacts ── */}
      <AccountCard
        title="Contacts"
        description="People you interact with in the GSS system"
        icon={<Users className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<UserPlus className="w-5 h-5" />}
          label="Team members"
          description="People in your branch and across GSS offices"
          value="View all"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<UserX className="w-5 h-5" />}
          label="Blocked users"
          value="0"
          description="Users you've blocked from contacting you"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Profile Visibility ── */}
      <AccountCard
        title="Profile visibility"
        description="Choose who can see your information in GSS"
        icon={<Eye className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={profileVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          label="Profile visible to team"
          description="When enabled, other GSS users in your branch can see your name, role, and specialization"
          action="toggle"
          toggleValue={profileVisible}
          onToggle={setProfileVisible}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Globe className="w-5 h-5" />}
          label="Cross-branch visibility"
          description="Allow users in other branches to see your profile"
          action="toggle"
          toggleValue={false}
          onToggle={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Lock className="w-5 h-5" />}
          label="Email visibility"
          value={profileVisible ? 'Visible to team' : 'Hidden'}
          description="Control whether your email is shown to other team members"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Activity Sharing ── */}
      <AccountCard
        title="Activity sharing"
        description="Control what activity data is shared with your team and managers"
        icon={<Share2 className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<ClipboardList className="w-5 h-5" />}
          label="Share work activity with your team"
          description="Allow team leads and admins to see your worklogs and daily activity"
          action="toggle"
          toggleValue={activitySharing}
          onToggle={setActivitySharing}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<FileText className="w-5 h-5" />}
          label="Reports shared with admin"
          value="Monthly"
          description="Auto-generated reports are shared with your branch admin"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>

      {/* ── Notification Preferences ── */}
      <AccountCard
        title="Notification preferences"
        description="Manage what alerts and notifications you receive"
        icon={<Bell className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<AtSign className="w-5 h-5" />}
          label="Mentions & tags"
          description="Get notified when someone mentions you in tasks or comments"
          action="toggle"
          toggleValue={mentionNotifications}
          onToggle={setMentionNotifications}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<ClipboardList className="w-5 h-5" />}
          label="Task assignments"
          description="Notifications for new task assignments and deadline updates"
          action="toggle"
          toggleValue={taskNotifications}
          onToggle={setTaskNotifications}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<FileText className="w-5 h-5" />}
          label="Report generation"
          description="Notify when monthly reports are ready for review"
          action="toggle"
          toggleValue={reportNotifications}
          onToggle={setReportNotifications}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<MessageSquare className="w-5 h-5" />}
          label="Daily email digest"
          description="Receive a daily summary of your notifications via email"
          action="toggle"
          toggleValue={emailDigest}
          onToggle={setEmailDigest}
        />
      </AccountCard>

      {/* ── Your Shared Content ── */}
      <AccountCard
        title="Your shared content"
        description="Summary of your content visible to others"
        icon={<Share2 className="w-5 h-5" />}
      >
        <AccountInfoRow
          icon={<ClipboardList className="w-5 h-5" />}
          label="Worklogs shared with admin"
          value="All time"
          description="Your daily worklogs are shared with branch administrators"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<FileText className="w-5 h-5" />}
          label="Reports generated"
          value="View history"
          description="Monthly reports auto-generated from your activity"
          action="arrow"
          onClick={() => {}}
        />

        <div className="mx-5 h-px bg-[var(--border-subtle)]" />

        <AccountInfoRow
          icon={<Users className="w-5 h-5" />}
          label="Activity visible to team leads"
          description="Attendance status and task completion visible to your managers"
          value="Enabled"
          action="arrow"
          onClick={() => {}}
        />
      </AccountCard>
    </div>
  );
}
