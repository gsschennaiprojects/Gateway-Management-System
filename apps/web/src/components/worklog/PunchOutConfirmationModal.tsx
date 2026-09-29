'use client';

import React, { useEffect, useRef } from 'react';
import { LogOut, X, CheckCircle2, Clock, ListChecks, FileText } from 'lucide-react';
import { LiveDateInfo } from '@/lib/worklogs/worklog-session-utils';

interface PunchOutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saving?: boolean;
  liveDate: LiveDateInfo;
  loginTime: string;
  plannedTasks: string[];
  completedTasks: string[];
  incompleteReason?: string;
  estimatedHours?: string;
}

export function PunchOutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  saving = false,
  liveDate,
  loginTime,
  plannedTasks,
  completedTasks,
  incompleteReason,
  estimatedHours,
}: PunchOutConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timeout = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const validPlanned = plannedTasks.map((t) => t.trim()).filter(Boolean);
  const validCompleted = completedTasks.map((t) => t.trim()).filter(Boolean);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="punchout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-3xl shadow-2xl overflow-hidden animate-panel-entrance text-[var(--text-primary,#1F1F1F)]">
        {/* Top Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] flex items-center justify-center shrink-0 shadow-xs">
              <LogOut className="w-6 h-6 text-[var(--badge-danger-text,#D93025)]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] text-[10px] font-semibold uppercase tracking-wider mb-1">
                <span>Step 2 of 2: Confirm Daily Log Out</span>
              </div>
              <h2 id="punchout-modal-title" className="text-lg font-bold text-[var(--text-primary,#1F1F1F)]">
                Confirm Work Session Checkout
              </h2>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Review your worklog summary before final attendance recording.
              </p>
            </div>
          </div>

          {/* Metrics Summary Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted,#5F6368)]">
                <Clock className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                <span>Session Timestamps</span>
              </div>
              <p className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)]">
                In: {loginTime || '—'}
              </p>
              <p className="text-xs font-semibold text-[var(--badge-danger-text,#D93025)]">
                Out: {liveDate.currentTime}
              </p>
              {estimatedHours && (
                <p className="text-[11px] text-[var(--text-muted,#5F6368)] pt-1">
                  Est. Duration: <span className="font-semibold text-emerald-600">{estimatedHours}</span>
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted,#5F6368)]">
                <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
                <span>Task Verification</span>
              </div>
              <p className="text-xs font-medium text-[var(--text-primary,#1F1F1F)]">
                Planned: <span className="font-semibold">{validPlanned.length}</span>
              </p>
              <p className="text-xs font-medium text-emerald-600">
                Completed: <span className="font-semibold">{validCompleted.length}</span>
              </p>
              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)]">
                ✓ Validated
              </span>
            </div>
          </div>

          {/* Incomplete Task Note if applicable */}
          {validCompleted.length < validPlanned.length && incompleteReason && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Incomplete Task Reason Recorded:</span>
              </div>
              <p className="italic text-[11px] pl-5">{incompleteReason}</p>
            </div>
          )}

          {/* Database Notice */}
          <div className="p-3 rounded-xl bg-[var(--brand-container,#E8F0FE)]/60 border border-[var(--border-subtle,#D2E3FC)] text-xs text-[var(--brand-on-container,#1A73E8)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--brand-primary,#1A73E8)]" />
            <span className="text-[11px] leading-tight">
              Checkout time and completed tasks will be submitted to the worklog service.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-full border border-[var(--border-card,#DADCE0)] text-xs font-semibold text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--bg-card-subtle,#F1F3F4)] transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel (Keep Working)
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="px-5 py-2.5 rounded-full bg-[var(--badge-danger-text,#D93025)] hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Confirm & Punch Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
