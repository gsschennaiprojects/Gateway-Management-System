'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AccountAvatar } from '@/components/account/AccountAvatar';
import { LogOut, X, AlertTriangle, MapPin, Loader2, CheckCircle2, Clock, ListChecks, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseTasks, getLiveDateInfo } from '@/lib/worklogs/worklog-session-utils';

interface ActiveSessionData {
  id: string;
  date: string;
  loginTime: string;
  plannedTasks: string[];
  isSpanningDays?: boolean;
  daysElapsed?: number;
  sessionStartDate?: string;
}

export function LogoutConfirmationModal() {
  const { user, isLogoutModalOpen, cancelLogout, confirmLogout, isLoggingOut } = useAuth();
  const router = useRouter();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [punchingOut, setPunchingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check for active work session when modal opens
  useEffect(() => {
    if (!isLogoutModalOpen || !user) {
      setActiveSession(null);
      setCompletedTasks([]);
      setIncompleteReason('');
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    setCheckingSession(true);
    fetch(`/api/worklogs?today=true&targetUserId=${encodeURIComponent(user.id)}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data.todayLog && data.todayLog.loginTime && !data.todayLog.logoutTime) {
          const planned = parseTasks(data.todayLog.plannedTasks);
          setActiveSession({
            id: data.todayLog.id,
            date: data.todayLog.date,
            loginTime: data.todayLog.loginTime,
            plannedTasks: planned,
            isSpanningDays: !!data.todayLog.isSpanningDays,
            daysElapsed: data.todayLog.daysElapsed || 1,
            sessionStartDate: data.todayLog.sessionStartDate || data.todayLog.date,
          });
          // Default completed tasks to planned tasks for smooth completion
          setCompletedTasks(planned);
        } else {
          setActiveSession(null);
        }
      })
      .catch(err => {
        console.warn('[LogoutModal] Session check note:', err);
      })
      .finally(() => {
        if (isMounted) setCheckingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isLogoutModalOpen, user]);

  // Close on Escape key press
  useEffect(() => {
    if (!isLogoutModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoggingOut && !punchingOut) {
        cancelLogout();
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
  }, [isLogoutModalOpen, isLoggingOut, punchingOut, cancelLogout]);

  if (!isLogoutModalOpen || !user) return null;

  const validPlanned = activeSession ? activeSession.plannedTasks : [];
  const validCompleted = completedTasks.map(t => t.trim()).filter(Boolean);
  const requiresReason = validPlanned.length > 0 && validCompleted.length < validPlanned.length;

  const handlePunchOutAndLogout = async () => {
    if (!activeSession) {
      await confirmLogout();
      return;
    }

    if (validCompleted.length === 0) {
      setErrorMsg('At least one completed task must be entered before logging out.');
      return;
    }

    if (requiresReason && incompleteReason.trim().length < 10) {
      setErrorMsg('Please provide a reason of at least 10 characters for incomplete tasks.');
      return;
    }

    setPunchingOut(true);
    setErrorMsg(null);

    try {
      const live = getLiveDateInfo();
      const res = await fetch('/api/worklogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'punchOut',
          logId: activeSession.id,
          sessionStartDate: activeSession.sessionStartDate || activeSession.date,
          loginTime: activeSession.loginTime,
          logoutTime: live.currentTime,
          date: live.isoDate,
          plannedTasks: validPlanned,
          completedTasks: validCompleted,
          incompleteReason: incompleteReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to record completed tasks.');
        setPunchingOut(false);
        return;
      }

      await confirmLogout();
    } catch (e) {
      console.error('[LogoutModal] Punch-out error:', e);
      setErrorMsg('Network error while completing work session.');
      setPunchingOut(false);
    }
  };

  const isWorking = isLoggingOut || punchingOut;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isWorking) {
          cancelLogout();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-3xl shadow-2xl overflow-hidden animate-panel-entrance text-[var(--text-primary,#1F1F1F)] max-h-[90vh] overflow-y-auto">
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />

        {/* Modal Close Button */}
        <button
          type="button"
          onClick={cancelLogout}
          disabled={isWorking}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Header with Step Badge */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] flex items-center justify-center shrink-0 shadow-xs">
              <LogOut className="w-6 h-6 text-[var(--badge-danger-text,#D93025)]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] text-[10px] font-semibold uppercase tracking-wider mb-1">
                <span>Sign Out &amp; Work Session Check</span>
              </div>
              <h2 id="logout-modal-title" className="text-lg font-bold text-[var(--text-primary,#1F1F1F)]">
                Confirm Sign Out
              </h2>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Review your work session state before signing out.
              </p>
            </div>
          </div>

          {/* User ID Card */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] flex items-center gap-3">
            <AccountAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] truncate">
                  {user.name}
                </p>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--border-subtle,#E8EAED)] text-[var(--text-secondary,#444746)] font-semibold shrink-0">
                  {user.id}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted,#5F6368)]">
                <span className="capitalize font-medium text-[var(--brand-primary,#1A73E8)]">{user.role}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-[var(--brand-primary,#1A73E8)]" />
                  {user.branch}
                </span>
              </div>
            </div>
          </div>

          {/* Active Work Session Prompt & Task Checklist */}
          {checkingSession ? (
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] flex items-center justify-center gap-2 text-xs text-[var(--text-secondary,#5F6368)]">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-primary,#1A73E8)]" />
              <span>Checking active work session...</span>
            </div>
          ) : activeSession ? (
            <div className="space-y-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[var(--text-primary,#1F1F1F)]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Active Work Session {activeSession.isSpanningDays ? `(Day ${activeSession.daysElapsed})` : ''}
                  </span>
                </div>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  Started {activeSession.sessionStartDate} at {activeSession.loginTime}
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary,#5F6368)] leading-relaxed">
                Your session and attendance continue across days until you logout with completed tasks. To finish your shift, verify your completed tasks below:
              </p>

              {/* Tasks Checklist */}
              {validPlanned.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
                      Tasks Completed ({validCompleted.length}/{validPlanned.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompletedTasks([...validPlanned])}
                      className="text-[11px] text-[var(--brand-primary,#1A73E8)] hover:underline cursor-pointer"
                    >
                      (Mark all completed)
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {validPlanned.map((task, idx) => {
                      const isChecked = completedTasks.includes(task);
                      return (
                        <label
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-subtle,#E8EAED)] text-xs cursor-pointer hover:border-[var(--brand-primary,#1A73E8)] transition-all"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCompletedTasks(prev => [...prev, task]);
                              } else {
                                setCompletedTasks(prev => prev.filter(t => t !== task));
                              }
                            }}
                            className="rounded text-[var(--brand-primary,#1A73E8)] focus:ring-0 cursor-pointer"
                          />
                          <span className={`flex-1 truncate ${isChecked ? 'line-through opacity-70' : 'font-medium'}`}>
                            {task}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Incomplete Task Reason */}
              {requiresReason && (
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Reason for Incomplete Tasks (Required ≥10 chars):
                  </label>
                  <textarea
                    rows={2}
                    value={incompleteReason}
                    onChange={(e) => setIncompleteReason(e.target.value)}
                    placeholder="Explain why planned tasks could not be completed..."
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-[var(--bg-card,#FFFFFF)] focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                  {errorMsg}
                </div>
              )}
            </div>
          ) : (
            /* Warning Message Box when no active work session */
            <div className="p-3.5 rounded-xl bg-[var(--badge-warning-bg,#FEF7E0)] border border-[var(--badge-warning-border,#FEEFC3)] text-[var(--badge-warning-text,#B06000)] text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Your session will be securely closed</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  You will be returned to the login screen. You will need your credentials to sign back in.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={cancelLogout}
              disabled={isWorking}
              className="w-full sm:w-auto px-4 py-2.5 rounded-full border border-[var(--border-card,#DADCE0)] text-xs font-semibold text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--bg-card-subtle,#F1F3F4)] transition-all cursor-pointer disabled:opacity-50"
            >
              Stay Signed In
            </button>

            {activeSession ? (
              <>
                <button
                  type="button"
                  onClick={() => confirmLogout()}
                  disabled={isWorking}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-full border border-amber-300 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100/50 transition-all cursor-pointer disabled:opacity-50"
                  title="Session will continue running across days until you punch out with completed tasks"
                >
                  Sign Out (Keep Session Active)
                </button>
                <button
                  type="button"
                  onClick={handlePunchOutAndLogout}
                  disabled={isWorking}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {punchingOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Tasks &amp; Signing Out...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Punch Out &amp; Sign Out</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => confirmLogout()}
                disabled={isWorking}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[var(--badge-danger-text,#D93025)] hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Yes, Sign Out</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
