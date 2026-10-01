'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { Clock, RotateCw, LogOut, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const { user, refreshSession, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const router = useRouter();

  // Redirect immediately if already active
  useEffect(() => {
    if (user && user.status === 'active') {
      const target = user.role === 'superadmin' ? '/admin/users' : user.role === 'admin' ? '/admin/directory' : user.role === 'hr' ? '/leads' : '/dashboard';
      router.replace(target);
    }
  }, [user, router]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setFeedback(null);
    try {
      const freshUser = await refreshSession();

      if (freshUser && freshUser.status === 'active') {
        setFeedback({ type: 'success', message: 'Account approved by Super Admin! Opening workspace...' });
        const target = freshUser.role === 'superadmin'
          ? '/admin/users'
          : freshUser.role === 'admin'
            ? '/admin/directory'
            : freshUser.role === 'hr'
              ? '/leads'
              : '/dashboard';

        setTimeout(() => {
          router.replace(target);
        }, 500);
        return;
      }

      if (freshUser && (freshUser.status === 'rejected' || (freshUser.status as string) === 'disabled')) {
        setFeedback({ type: 'error', message: 'Your application was rejected or disabled. Please contact the Super Administrator.' });
      } else {
        setFeedback({ type: 'info', message: 'Application is still under review by Super Admin. Please check back shortly.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Could not connect to verify status. Please check your internet connection and retry.' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] animate-panel-entrance py-6">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-8 sm:p-10 shadow-xs text-center text-[var(--text-primary)]">
        <div className="w-16 h-16 rounded-full bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] border border-[var(--badge-warning-border)] flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8" />
        </div>

        <div className="inline-block mb-3">
          <StatusChip status="warning" label="Pending Approval" size="md" />
        </div>

        <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
          Account Under Review
        </h1>

        <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
          Your account has been registered with GSS Management Workspace and is awaiting administrator verification.
        </p>

        {user && (
          <div className="my-6 p-4 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-card)] text-left space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)]">Applicant:</span>
              <span className="font-semibold text-[var(--text-primary)]">{user.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)]">Email:</span>
              <span className="text-[var(--text-primary)]">{user.email}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)]">Mobile:</span>
              <span className="text-[var(--text-primary)]">{user.mobile}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)]">Branch:</span>
              <span className="font-semibold text-[var(--brand-primary)]">{user.branch} Branch</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-secondary)]">Requested Role:</span>
              <span className="uppercase text-[var(--badge-warning-text)] font-semibold">{user.role}</span>
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`my-4 p-3 rounded-xl text-xs flex items-center gap-2.5 text-left border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : feedback.type === 'error'
                  ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                  : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={handleCheckStatus}
            isLoading={isChecking}
            leftIcon={<RotateCw className="w-4 h-4" />}
          >
            Check Activation Status
          </Button>

          <Button
            variant="ghost"
            className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            onClick={logout}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
