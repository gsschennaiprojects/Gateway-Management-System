'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';
import { TaskPointInput } from '@/components/worklog/TaskPointInput';
import { useDailySession } from '@/lib/worklogs/useDailySession';
import {
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
  Sparkles,
  Zap,
  Timer,
  Check,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';

interface WorklogEntry {
  logId: string;
  date: string;
  loginTime: string;
  logoutTime: string;
  tasksCompleted: string;
  tasksPending: string;
  incompleteReason: string;
  totalHours: string;
  verifiedBy: string;
}

export default function WorklogPage() {
  const { user } = useAuth();
  const [historyWorklogs, setHistoryWorklogs] = useState<WorklogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Unified Daily Worklog & Punch Session Hook
  const {
    liveDate,
    loginTime,
    setLoginTime,
    logoutTime,
    setLogoutTime,
    isPunchedIn,
    isPunchedOut,
    plannedTasks,
    setPlannedTasks,
    completedTasks,
    setCompletedTasks,
    incompleteReason,
    setIncompleteReason,
    totalHours,
    workingCalc,
    elapsedTime,
    punchIn,
    punchOut,
    saveSession,
    saving,
    error,
    success,
  } = useDailySession();

  const staffId = user?.id || '';
  const branchCode = user?.branch ? BRANCH_NAME_TO_CODE[user.branch] : null;

  const fetchHistoryWorklogs = useCallback(async () => {
    if (!staffId || !branchCode) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/sheets?type=worklog&staffId=${staffId}&branchCode=${branchCode}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setHistoryWorklogs(data.data);
      }
    } catch (err) {
      console.warn('[WorklogPage] History fetch warning:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [staffId, branchCode]);

  useEffect(() => {
    fetchHistoryWorklogs();
  }, [fetchHistoryWorklogs]);

  const handleSaveAndRefresh = async () => {
    await saveSession();
    fetchHistoryWorklogs();
  };

  const handleExportExcel = () => {
    exportToExcel({
      filename: `GSS_Worklog_${user?.name?.replace(/\s+/g, '_') || 'Staff'}_${liveDate.shortDay}_${liveDate.formattedDate.replace(/\s+/g, '_')}`,
      sheetName: 'Daily Worklogs',
      title: 'Gateway Software Solutions — Staff Daily Worklog History',
      subtitle: `Staff: ${user?.name} (${user?.role}) • Branch: ${user?.branch} • Total Logs: ${historyWorklogs.length}`,
      metadata: {
        'Staff Member': user?.name || 'Staff Member',
        'Staff ID': staffId,
        'Branch': user?.branch || 'Coimbatore',
        'Role': user?.role?.toUpperCase() || 'EMPLOYEE',
      },
      headers: ['Log ID', 'Date', 'Login Time', 'Logout Time', 'Total Hours', 'Tasks Completed', 'Tasks Pending', 'Incomplete Reason'],
      rows: historyWorklogs.map((w) => [
        w.logId,
        w.date,
        w.loginTime,
        w.logoutTime,
        w.totalHours,
        w.tasksCompleted,
        w.tasksPending,
        w.incompleteReason || 'None',
      ]),
    });
  };

  const handleExportDocx = async () => {
    await exportToDocx({
      filename: `GSS_Worklog_${user?.name?.replace(/\s+/g, '_') || 'Staff'}_${liveDate.shortDay}_${liveDate.formattedDate.replace(/\s+/g, '_')}`,
      title: 'Staff Daily Worklog & Task Execution Audit',
      subtitle: 'Official Work Activity & Verified Hours Log',
      period: liveDate.monthName,
      staffName: user?.name || 'Staff Member',
      staffRole: user?.role?.toUpperCase() || 'EMPLOYEE',
      branch: user?.branch || 'Coimbatore',
      sections: [
        {
          heading: '1. Logged Work Hours & Task History',
          description: 'Detailed daily work hours and task completion details.',
          table: {
            headers: ['Date', 'Login / Logout', 'Hours', 'Tasks Completed', 'Pending Tasks'],
            rows: historyWorklogs.map((w) => [
              w.date,
              `${w.loginTime} – ${w.logoutTime}`,
              w.totalHours || '8.5 hrs',
              w.tasksCompleted || 'None',
              w.tasksPending || 'None',
            ]),
            columnWidthsPercentage: [15, 25, 15, 25, 20],
          },
        },
      ],
    });
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-panel-entrance">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-container,#E8F0FE)] border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-center shadow-2xs">
            <ClipboardList className="w-6 h-6 text-[var(--brand-primary,#1A73E8)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Daily Worklog &amp; Attendance Dispatch
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-success-text,#137333)] animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
              Point-by-point daily progress tracking connected with Google Sheets &amp; live attendance
            </p>
          </div>
        </div>

        {/* Live Date Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-primary,#1F1F1F)] font-medium shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
          <span>{liveDate.dayOfWeek}, {liveDate.formattedDate}</span>
          <span className="text-[var(--text-muted,#747775)]">•</span>
          <span className="text-[var(--text-secondary,#5F6368)] font-mono">{liveDate.currentTime}</span>
        </div>
      </div>

      {/* Today's Entry Card */}
      <div className="rounded-3xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-sm p-6 sm:p-8 space-y-6 transition-all duration-200">
        {/* Card Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[var(--border-card,#DADCE0)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-container,#E8F0FE)] flex items-center justify-center text-[var(--brand-primary,#1A73E8)] font-bold text-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">
                Today — {liveDate.dayOfWeek}, {liveDate.formattedDate}
              </span>
              <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
                Branch: {user.branch} • Session Auto-Tied to Staff Attendance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] font-semibold border border-[var(--border-subtle,#D2E3FC)]">
              {user.name}
            </span>
          </div>
        </div>

        {/* Interactive Punch In & Punch Out Action Controls */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-canvas,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#5F6368)] flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
                Live Attendance &amp; Working Hours Dispatch
              </h3>
              <p className="text-[11px] text-[var(--text-muted,#747775)] mt-0.5">
                One-tap punch captures recognized system time and computes exact work duration
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Punch In Action Button */}
              {!loginTime ? (
                <button
                  type="button"
                  onClick={() => punchIn()}
                  className="px-4 py-2 rounded-full bg-[var(--brand-primary,#1A73E8)] hover:bg-[var(--brand-primary-hover,#1557B0)] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In (Punch In at {liveDate.currentTime})</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)] text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Punched In: {loginTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => punchIn()}
                    className="text-[10px] text-[var(--brand-primary,#1A73E8)] hover:underline cursor-pointer"
                    title="Update to current live time"
                  >
                    (Reset to Now)
                  </button>
                </div>
              )}

              {/* Punch Out Action Button */}
              {loginTime && !logoutTime ? (
                <button
                  type="button"
                  onClick={() => punchOut()}
                  className="px-4 py-2 rounded-full bg-[var(--badge-danger-text,#D93025)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out (Punch Out at {liveDate.currentTime})</span>
                </button>
              ) : logoutTime ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] border border-[var(--border-subtle,#E8EAED)] text-xs font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    Punched Out: {logoutTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => punchOut()}
                    className="text-[10px] text-[var(--brand-primary,#1A73E8)] hover:underline cursor-pointer"
                    title="Update to current live time"
                  >
                    (Reset to Now)
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Time Inputs & Manual Override Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1.5 flex items-center justify-between">
                <span>
                  <LogIn className="w-3.5 h-3.5 inline mr-1 text-[var(--brand-primary,#1A73E8)]" /> Login Time
                </span>
                <button
                  type="button"
                  onClick={() => setLoginTime(liveDate.currentTime)}
                  className="text-[10px] text-[var(--brand-primary,#1A73E8)] hover:underline cursor-pointer"
                >
                  Set to Live ({liveDate.currentTime})
                </button>
              </label>
              <input
                type="text"
                placeholder="09:00 AM"
                value={loginTime}
                onChange={(e) => setLoginTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)]/20 focus:border-[var(--brand-primary,#1A73E8)] transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1.5 flex items-center justify-between">
                <span>
                  <LogOut className="w-3.5 h-3.5 inline mr-1 text-[var(--badge-danger-text,#D93025)]" /> Logout Time
                </span>
                <button
                  type="button"
                  onClick={() => setLogoutTime(liveDate.currentTime)}
                  className="text-[10px] text-[var(--brand-primary,#1A73E8)] hover:underline cursor-pointer"
                >
                  Set to Live ({liveDate.currentTime})
                </button>
              </label>
              <input
                type="text"
                placeholder="06:00 PM"
                value={logoutTime}
                onChange={(e) => setLogoutTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)]/20 focus:border-[var(--brand-primary,#1A73E8)] transition-all"
              />
            </div>
          </div>

          {/* Dynamic Total Working Time Banner */}
          {workingCalc ? (
            <div className="p-3.5 rounded-xl bg-[var(--brand-container,#E8F0FE)]/60 border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-between flex-wrap gap-2">
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
            <div className="p-3.5 rounded-xl bg-[var(--badge-success-bg,#E6F4EA)]/60 border border-[var(--badge-success-border,#CEEAD6)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-semibold text-[var(--badge-success-text,#137333)]">
                  Active Session Elapsed: {elapsedTime.formatted}
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">
                Punch out at checkout to record final verified hours
              </span>
            </div>
          ) : null}
        </div>

        {/* Task Inputs — Point by Point Format */}
        <div className="space-y-6">
          {/* Tasks Completed (Point-by-Point) */}
          <TaskPointInput
            label="Tasks Completed (Deliverables)"
            sublabel="Enter deliverables point-by-point. Will be saved to Google Sheets as clean semicolon-separated values."
            points={completedTasks}
            onChange={setCompletedTasks}
            placeholder="e.g. Conducted technical interview with candidates; Completed bug fixes on student portal..."
            icon="completed"
          />

          {/* Tasks Pending / Planned (Point-by-Point) */}
          <TaskPointInput
            label="Tasks Pending / Planned"
            sublabel="Enter pending tasks point-by-point."
            points={plannedTasks}
            onChange={setPlannedTasks}
            placeholder="e.g. Prepare curriculum draft for React course; Review attendance logs..."
            icon="pending"
          />

          {/* Reason for Incomplete Tasks (Shown if pending tasks exist) */}
          {plannedTasks.length > 0 && (
            <div className="p-4 rounded-2xl bg-[var(--badge-warning-bg,#FEF7E0)]/40 border border-[var(--badge-warning-border,#FEEFC3)] space-y-1.5">
              <label className="text-xs font-semibold text-[var(--badge-warning-text,#B06000)] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Reason for Incomplete / Pending Deliverables
              </label>
              <input
                type="text"
                placeholder="Why are these tasks pending? (e.g. Awaiting client review, scheduled for tomorrow)"
                value={incompleteReason}
                onChange={(e) => setIncompleteReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)]/20 focus:border-[var(--brand-primary,#1A73E8)]"
              />
            </div>
          )}
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-[var(--badge-danger-text,#D93025)] bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs text-[var(--badge-success-text,#137333)] bg-[var(--badge-success-bg,#E6F4EA)] border border-[var(--badge-success-border,#CEEAD6)] rounded-xl px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <div className="text-[11px] text-[var(--text-muted,#747775)] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
            <span>Auto-appends semicolon-separated tasks to 03_Daily_Worklogs &amp; WL_{staffId}</span>
          </div>

          <button
            type="button"
            onClick={handleSaveAndRefresh}
            disabled={saving || !loginTime}
            className="w-full sm:w-auto px-7 py-3 rounded-full bg-[var(--brand-primary,#1A73E8)] hover:bg-[var(--brand-primary-hover,#1557B0)] text-white text-xs font-semibold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Synchronizing with Sheets...' : 'Save & Append to Sheets'}</span>
          </button>
        </div>
      </div>

      {/* Recent Worklogs Table */}
      <div className="rounded-3xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-sm overflow-hidden transition-all duration-200">
        <div className="px-6 sm:px-8 py-5 border-b border-[var(--border-card,#DADCE0)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">
              Recent Verified Worklogs ({historyWorklogs.length})
            </h2>
            <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">
              Historical records from branch master sheet &amp; personal operational subsheet
            </p>
          </div>

          {historyWorklogs.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-card,#DADCE0)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print / PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-card,#DADCE0)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportDocx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-card,#DADCE0)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Export Word</span>
              </button>
            </div>
          )}
        </div>

        {loadingHistory ? (
          <div className="p-12 text-center text-xs text-[var(--text-muted,#747775)] flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-primary,#1A73E8)]" />
            <span>Loading verified branch worklogs...</span>
          </div>
        ) : historyWorklogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-muted,#747775)]">
            No previous worklogs recorded yet. Complete and save your session above to record your first entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-canvas,#F8FAFD)] text-[11px] font-semibold uppercase text-[var(--text-secondary,#5F6368)] border-b border-[var(--border-card,#DADCE0)]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Login</th>
                  <th className="py-3 px-4">Logout</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Tasks Completed</th>
                  <th className="py-3 px-4">Tasks Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle,#E8EAED)]">
                {historyWorklogs.map((w, idx) => (
                  <tr key={idx} className="hover:bg-[var(--bg-canvas,#F8FAFD)] transition-colors">
                    <td className="py-3 px-4 font-medium text-[var(--text-primary,#1F1F1F)] whitespace-nowrap">
                      {w.date}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary,#5F6368)] whitespace-nowrap">{w.loginTime}</td>
                    <td className="py-3 px-4 text-[var(--text-secondary,#5F6368)] whitespace-nowrap">{w.logoutTime}</td>
                    <td className="py-3 px-4 font-semibold text-[var(--brand-primary,#1A73E8)] whitespace-nowrap">
                      {w.totalHours ? `${w.totalHours} hrs` : '—'}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-primary,#1F1F1F)] max-w-[240px]">
                      {w.tasksCompleted ? (
                        <div className="flex flex-wrap gap-1">
                          {w.tasksCompleted.split(';').map((pt, pidx) => (
                            <span
                              key={pidx}
                              className="inline-block px-2 py-0.5 rounded-md bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] text-[10px]"
                            >
                              {pt.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary,#5F6368)] max-w-[200px]">
                      {w.tasksPending ? (
                        <div className="flex flex-wrap gap-1">
                          {w.tasksPending.split(';').map((pt, pidx) => (
                            <span
                              key={pidx}
                              className="inline-block px-2 py-0.5 rounded-md bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] text-[10px]"
                            >
                              {pt.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
