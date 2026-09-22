'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { Clock, ShieldAlert, CheckCircle2, RotateCw, LogOut, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const { user, refreshSession, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const router = useRouter();

  const handleCheckStatus = async () => {
    setIsChecking(true);
    await refreshSession();
    setIsChecking(false);

    if (user && user.status === 'active') {
      router.push('/dashboard');
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
