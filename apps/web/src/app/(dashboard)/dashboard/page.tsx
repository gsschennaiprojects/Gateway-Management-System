'use client';

import React, { useState, useEffect } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AttendanceGauge } from '@/components/ui/AttendanceGauge';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { SmartAlertsBanner } from '@/components/dashboard/SmartAlertsBanner';
import { AssignedTask, TaskStatus } from '@/types/task';
import Link from 'next/link';
import {
  LogIn,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  GraduationCap,
  Briefcase,
  CalendarCheck,
  Check,
  X,
  Coffee,
  CheckSquare,
  Users,
  ArrowRight,
  Calendar,
  Timer,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { formatStudentDate } from '@/types/student';
import { TaskPointInput } from '@/components/worklog/TaskPointInput';
import { useDailySession } from '@/lib/worklogs/useDailySession';

interface Student {
  id: string;
  name: string;
  college: string;
  domain: string;
  feeStatus: 'paid' | 'partial' | 'pending';
  startDate: string;
  endDate: string;
  duration: string;
  projectCompleted: boolean;
  todayStatus: 'present' | 'absent' | 'holiday';
  yesterdayTaskDone: boolean;
}

const INITIAL_STUDENTS: Student[] = [];

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);

  useEffect(() => {
    fetch('/api/tasks')
      .then((res) => res.json())
      .then((data) => setAssignedTasks(data.tasks || []))
      .catch(console.error);
  }, [user]);

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus })
      });
      if (res.ok) {
        setAssignedTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Daily Punch In / Out and Task Dispatch (Unified with /worklog)
  const {
    liveDate,
    loginTime,
    logoutTime,
    isPunchedIn,
    isPunchedOut,
    plannedTasks,
    setPlannedTasks,
    completedTasks,
    setCompletedTasks,
    totalHours,
    workingCalc,
    elapsedTime,
    punchIn,
    punchOut,
    incompleteReason,
    setIncompleteReason,
    error,
    success,
  } = useDailySession();

  // Student Attendance List State
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);

  const toggleStudentStatus = (studentId: string) => {
    setStudents(
      students.map((s) => {
        if (s.id !== studentId) return s;
        const nextStatus: Record<string, 'present' | 'absent' | 'holiday'> = {
          present: 'absent',
          absent: 'holiday',
          holiday: 'present',
        };
        return { ...s, todayStatus: nextStatus[s.todayStatus] };
      })
    );
  };

  const toggleYesterdayTask = (studentId: string) => {
    setStudents(
      students.map((s) => (s.id === studentId ? { ...s, yesterdayTaskDone: !s.yesterdayTaskDone } : s))
    );
  };

  return (
    <div className="space-y-8 animate-panel-entrance">
      {/* Page Header Greeting in Google Account Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] p-6 rounded-3xl shadow-xs transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-center text-xl font-bold shrink-0">
            {user?.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Welcome, {user?.name.split(' ')[0]}
              </h1>
              <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] font-semibold">
                {user?.role}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-[var(--text-secondary,#5F6368)]">
              <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary,#1F1F1F)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary,#1A73E8)]" />
                {user?.branch} Branch
              </span>
              {user?.specialization && (
                <>
                  <span className="text-[var(--border-card,#DADCE0)]">•</span>
                  <span className="text-[var(--brand-primary,#1A73E8)] font-medium flex items-center gap-1">
                    <span>Major Domain:</span>
                    <span className="font-semibold">{user.majorSpecialization || (user.specializations && user.specializations[0]) || user.specialization}</span>
                  </span>
                  {((user.additionalSpecializations && user.additionalSpecializations.length > 0) ||
                    (user.specializations && user.specializations.length > 1)) && (
                    <span className="text-[var(--text-muted,#747775)] text-[11px]">
                      (+{(user.additionalSpecializations?.length || (user.specializations ? user.specializations.length - 1 : 0))} add&apos;l in profile)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-secondary,#5F6368)] bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
            <span>Today: {liveDate.dayOfWeek}, {liveDate.formattedDate}</span>
            <span className="text-[var(--text-muted,#747775)]">•</span>
            <span className="font-mono text-[var(--text-secondary,#5F6368)]">{liveDate.currentTime}</span>
          </span>
        </div>
      </div>

      {/* Smart Proactive Operational Alerts Banner */}
      <SmartAlertsBanner />

      {/* Hero Attendance Gauge Section */}
      <div className="w-full">
        <AttendanceGauge
          percentage={94.2}
          presentDays={22}
          absentDays={1}
          holidayDays={3}
          workingDaysTotal={26}
          monthName={liveDate.monthName}
        />
      </div>

      {/* Assigned Deliverables from Leadership */}
      <GlassPanel className="p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-[var(--border-card,#DADCE0)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)]">
                Assigned Tasks & Delegations
              </h2>
              <p className="text-xs text-[var(--text-secondary,#5F6368)]">
                Deliverables assigned to you or your team by Super Admin and Branch Admins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/tasks"
              className="text-xs text-[var(--brand-primary,#1A73E8)] hover:underline flex items-center gap-1 font-medium"
            >
              <span>Task Center ({assignedTasks.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {assignedTasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-muted,#5F6368)] rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-dashed border-[var(--border-card,#DADCE0)]">
            No pending tasks assigned to you right now. All current deliverables completed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {assignedTasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] hover:border-[var(--border-focus,#BDC1C6)] hover:shadow-xs transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  {task.targetType === 'group' && task.targetGroup ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)] font-semibold">
                      <Users className="w-3 h-3" />
                      <span>Team: {task.targetGroup.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] font-semibold">
                      <span>Personal Task</span>
                    </span>
                  )}

                  <StatusChip
                    status={
                      task.status === 'completed'
                        ? 'success'
                        : task.status === 'in_progress'
                        ? 'neutral'
                        : 'warning'
                    }
                    label={task.status.replace('_', ' ')}
                    size="sm"
                  />
                </div>

                <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] leading-snug">
                  {task.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary,#5F6368)] line-clamp-2">
                  {task.description}
                </p>

                <div className="pt-2 border-t border-[var(--border-subtle,#F1F3F4)] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--text-muted,#747775)]">
                    Due: {task.dueDate} • By {task.assignedBy.name}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {task.status !== 'completed' ? (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className="px-2.5 py-1 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] hover:opacity-90 text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Done</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--badge-success-text,#137333)] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Daily Login/Logout Card — Fully Unified with /worklog */}
      <GlassPanel className="p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-card,#DADCE0)]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)] flex items-center justify-center shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)]">
                  Daily Session &amp; Task Dispatch
                </h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                  {liveDate.dayOfWeek}, {liveDate.formattedDate}
                </span>
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full cursor-default"
                  title="Live bidirectional session sync active with /worklog"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Log planned agenda at check-in and mark deliverables point-by-point at checkout.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!loginTime ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="primary"
                  onClick={() => punchIn()}
                  leftIcon={<LogIn className="w-4 h-4" />}
                >
                  Log In (Punch In at {liveDate.currentTime})
                </Button>
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                  plannedTasks.map(t => t.trim()).filter(Boolean).length === 0
                    ? 'bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border-[var(--badge-warning-border,#FEEFC3)]'
                    : 'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border-[var(--badge-success-border,#CEEAD6)]'
                }`}>
                  {plannedTasks.map(t => t.trim()).filter(Boolean).length === 0
                    ? '⚠ ≥1 Planned Task Required'
                    : `✓ ${plannedTasks.map(t => t.trim()).filter(Boolean).length} Planned Ready`}
                </span>
              </div>
            ) : !logoutTime ? (
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Punched In: {loginTime}
                </span>
                {elapsedTime && (
                  <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Active: {elapsedTime.shortFormatted}
                  </span>
                )}
                <Button
                  variant="danger"
                  onClick={() => punchOut()}
                  leftIcon={<LogOut className="w-4 h-4" />}
                >
                  Log Out (Punch Out at {liveDate.currentTime})
                </Button>
                {(() => {
                  const planCount = plannedTasks.map(t => t.trim()).filter(Boolean).length;
                  const compCount = completedTasks.map(t => t.trim()).filter(Boolean).length;
                  if (compCount === 0) {
                    return (
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)]">
                        ⚠ ≥1 Completed Task Required
                      </span>
                    );
                  }
                  if (compCount < planCount) {
                    return (
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        ⚠ Reason Required ({compCount}/{planCount})
                      </span>
                    );
                  }
                  return (
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)]">
                      ✓ Ready to Logout ({compCount}/{planCount})
                    </span>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-3.5 py-1.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] font-medium border border-[var(--border-subtle,#E8EAED)] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600" />
                  Session Concluded ({loginTime} – {logoutTime})
                </span>
                {workingCalc && (
                  <span className="text-xs px-3 py-1.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] font-semibold border border-[var(--border-subtle,#D2E3FC)]">
                    Total: {workingCalc.formatted} ({workingCalc.decimalHours} hrs)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Total Working Time Banner if concluded or calculated */}
        {workingCalc ? (
          <div className="mb-6 p-4 rounded-2xl bg-[var(--brand-container,#E8F0FE)]/60 border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
              <span className="text-xs font-semibold text-[var(--brand-primary,#1A73E8)]">
                Total Working Time: {workingCalc.formatted} ({workingCalc.decimalHours} hrs)
              </span>
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
              workingCalc.isFullDay
                ? 'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)]'
                : 'bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)]'
            }`}>
              {workingCalc.isFullDay ? '✓ Standard Full Day Met (≥ 8.5h)' : `Short Day (${(8.5 - workingCalc.decimalHours).toFixed(2)}h under target)`}
            </span>
          </div>
        ) : elapsedTime ? (
          <div className="mb-6 p-4 rounded-2xl bg-[var(--badge-success-bg,#E6F4EA)]/60 border border-[var(--badge-success-border,#CEEAD6)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-[var(--badge-success-text,#137333)]">
                Active Session Elapsed: {elapsedTime.formatted}
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              Punch out when leaving office to finalize verified work duration
            </span>
          </div>
        ) : null}

        {/* Stacked Task Lists using Point-by-Point Task Builder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TaskPointInput
            label="1. Planned Tasks (Required for Login)"
            sublabel="Log your planned agenda before check-in. Saved to database."
            points={plannedTasks}
            onChange={setPlannedTasks}
            placeholder="Enter planned task (or paste list)..."
            icon="pending"
            disabled={isPunchedOut}
          />

          <TaskPointInput
            label="2. Completed Deliverables (Required for Logout)"
            sublabel="Mark deliverables point-by-point before checkout."
            points={completedTasks}
            onChange={setCompletedTasks}
            placeholder="Enter completed deliverable..."
            icon="completed"
            disabled={!loginTime || isPunchedOut}
          />
        </div>

        {/* Reason for Incomplete Tasks on Dashboard */}
        {plannedTasks.map(t => t.trim()).filter(Boolean).length > 0 && (
          <div className={`mt-6 p-4 rounded-2xl border space-y-1.5 transition-all ${
            completedTasks.map(t => t.trim()).filter(Boolean).length < plannedTasks.map(t => t.trim()).filter(Boolean).length
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-[var(--bg-card-subtle,#F8FAFD)] border-[var(--border-subtle,#E8EAED)]'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                Reason for Incomplete / Pending Deliverables
              </label>
              {completedTasks.map(t => t.trim()).filter(Boolean).length < plannedTasks.map(t => t.trim()).filter(Boolean).length ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  * Required before Logout (Completed &lt; Planned)
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Optional (All planned tasks marked completed)
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Why are remaining tasks incomplete? (e.g. Awaiting client review, scheduled for tomorrow)"
              value={incompleteReason}
              onChange={(e) => setIncompleteReason(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 ${
                completedTasks.map(t => t.trim()).filter(Boolean).length < plannedTasks.map(t => t.trim()).filter(Boolean).length && !incompleteReason.trim()
                  ? 'border-amber-400 focus:ring-amber-400/30'
                  : 'border-[var(--border-card,#DADCE0)] focus:ring-[var(--brand-primary,#1A73E8)]/20'
              }`}
            />
          </div>
        )}

        {/* Dashboard Status Alerts */}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--badge-danger-text,#D93025)] bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--badge-success-text,#137333)] bg-[var(--badge-success-bg,#E6F4EA)] border border-[var(--badge-success-border,#CEEAD6)] rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{success}</span>
          </div>
        )}
      </GlassPanel>

      {/* My Students Table in Google Workspace Style */}
      <GlassPanel className="p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#1E8E3E)] border border-[var(--badge-success-border,#CEEAD6)] flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)]">
                My Assigned Students & Interns
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
              Tap attendance status to cycle: <span className="text-[var(--badge-success-text,#1E8E3E)] font-medium">Present</span> → <span className="text-[var(--badge-danger-text,#D93025)] font-medium">Absent</span> → <span className="text-[var(--text-secondary,#5F6368)] font-medium">Holiday</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-xs text-[var(--text-secondary,#5F6368)] bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] px-3.5 py-1.5 rounded-full">
              Total Assigned: <span className="font-semibold text-[var(--text-primary,#1F1F1F)]">{students.length}</span>
            </div>
            <Link
              href="/students"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--brand-primary,#1A73E8)] text-white hover:bg-[var(--brand-primary-hover,#1557B0)] transition-all shadow-xs"
            >
              <span>Manage in Student Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 px-6 border border-[var(--border-card,#DADCE0)] rounded-2xl">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] text-[11px] font-semibold uppercase text-[var(--text-secondary,#5F6368)]">
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">College</th>
                <th className="py-3.5 px-4">Domain</th>
                <th className="py-3.5 px-4">Start Date</th>
                <th className="py-3.5 px-4">End Date</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Fee Status</th>
                <th className="py-3.5 px-4 text-center">Project</th>
                <th className="py-3.5 px-4 text-center">
                  Today&apos;s Mark ({liveDate.shortDay}, {liveDate.formattedDate})
                </th>
                <th className="py-3.5 px-4 text-center">Yesterday's Task</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,#F1F3F4)] text-sm bg-[var(--bg-card,#FFFFFF)]">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--text-secondary,#5F6368)]">
                    <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--text-muted,#747775)]" />
                    <p className="font-medium text-sm text-[var(--text-primary,#1F1F1F)]">No assigned students yet</p>
                    <p className="text-xs text-[var(--text-muted,#747775)] mt-1">Students assigned to your mentorship will appear here.</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                <tr key={student.id} className="hover:bg-[var(--bg-card-hover,#F8FAFD)] transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[var(--text-primary,#1F1F1F)]">
                    {student.name}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--text-secondary,#5F6368)]">
                    {student.college}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--text-primary,#1F1F1F)]">
                    {student.domain}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-[var(--text-primary,#1F1F1F)] whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-[11px]">
                      <Calendar className="w-3 h-3 text-[var(--brand-primary,#1A73E8)]" />
                      <span>{formatStudentDate(student.startDate)}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-[var(--text-primary,#1F1F1F)] whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-[11px]">
                      <Calendar className="w-3 h-3 text-[var(--text-muted,#747775)]" />
                      <span>{formatStudentDate(student.endDate)}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[var(--text-secondary,#5F6368)] font-medium">
                    {student.duration}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusChip
                      status={
                        student.feeStatus === 'paid'
                          ? 'success'
                          : student.feeStatus === 'partial'
                          ? 'warning'
                          : 'danger'
                      }
                      label={student.feeStatus}
                      size="sm"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {student.projectCompleted ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#1E8E3E)]">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-muted,#747775)]">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => toggleStudentStatus(student.id)}
                      className="transition-transform active:scale-95 cursor-pointer"
                      title="Click to cycle status"
                    >
                      <StatusChip
                        status={
                          student.todayStatus === 'present'
                            ? 'success'
                            : student.todayStatus === 'absent'
                            ? 'danger'
                            : 'neutral'
                        }
                        label={student.todayStatus}
                        size="sm"
                      />
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => toggleYesterdayTask(student.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                        student.yesterdayTaskDone
                          ? 'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)]'
                          : 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] border border-[var(--border-card,#DADCE0)] hover:text-[var(--text-primary,#1F1F1F)]'
                      }`}
                    >
                      {student.yesterdayTaskDone ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Done</span>
                        </>
                      ) : (
                        <span>Pending</span>
                      )}
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
