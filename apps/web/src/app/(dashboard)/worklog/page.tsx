'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BRANCH_NAME_TO_CODE, BRANCH_SPREADSHEET_MAP } from '@/lib/seed-branches';
import { formatSheetDate, generateWorklogId } from '@/lib/sheets/sheets-config';
import {
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Save,
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
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
  const [worklogs, setWorklogs] = useState<WorklogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Today's worklog form
  const today = formatSheetDate(new Date());
  const [loginTime, setLoginTime] = useState('');
  const [logoutTime, setLogoutTime] = useState('');
  const [tasksCompleted, setTasksCompleted] = useState('');
  const [tasksPending, setTasksPending] = useState('');
  const [incompleteReason, setIncompleteReason] = useState('');

  const staffId = user?.id || '';
  const branchCode = user?.branch ? BRANCH_NAME_TO_CODE[user.branch] : null;

  const fetchWorklogs = useCallback(async () => {
    if (!staffId || !branchCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sheets?type=worklog&staffId=${staffId}&branchCode=${branchCode}`);
      const data = await res.json();
      if (data.success) {
        setWorklogs(data.data || []);
        // Pre-fill today's entry if it exists
        const todayEntry = data.data?.find((w: WorklogEntry) => w.date === today);
        if (todayEntry) {
          setLoginTime(todayEntry.loginTime || '');
          setLogoutTime(todayEntry.logoutTime || '');
          setTasksCompleted(todayEntry.tasksCompleted || '');
          setTasksPending(todayEntry.tasksPending || '');
          setIncompleteReason(todayEntry.incompleteReason || '');
        }
      } else {
        setError(data.error || 'Failed to fetch worklogs');
      }
    } catch (err) {
      setError('Network error while fetching worklogs');
    } finally {
      setLoading(false);
    }
  }, [staffId, branchCode, today]);

  useEffect(() => {
    fetchWorklogs();
  }, [fetchWorklogs]);

  const handleSave = async () => {
    if (!staffId || !branchCode) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const logId = generateWorklogId(staffId, today);
      const totalHours = loginTime && logoutTime
        ? calculateHours(loginTime, logoutTime)
        : '';

      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'worklog',
          staffId,
          branchCode,
          data: {
            logId,
            date: today,
            loginTime,
            logoutTime,
            tasksCompleted,
            tasksPending,
            incompleteReason,
            totalHours: totalHours.toString(),
            verifiedBy: '',
          },
        }),
      });

      const result = await res.json();
      if (result.success) {
        setSuccess('Worklog saved successfully!');
        fetchWorklogs();
      } else {
        setError(result.error || 'Failed to save worklog');
      }
    } catch (err) {
      setError('Network error while saving worklog');
    } finally {
      setSaving(false);
    }
  };

  function calculateHours(login: string, logout: string): string {
    try {
      const parseTime = (t: string) => {
        const [time, period] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period?.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period?.toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      const diff = parseTime(logout) - parseTime(login);
      if (diff <= 0) return '0';
      return (diff / 60).toFixed(1);
    } catch {
      return '';
    }
  }

  const handleExportExcel = () => {
    exportToExcel({
      filename: `GSS_Worklog_${user?.name?.replace(/\s+/g, '_') || 'Staff'}_Sep_2026`,
      sheetName: 'Daily Worklogs',
      title: 'Gateway Software Solutions — Staff Daily Worklog History',
      subtitle: `Staff: ${user?.name} (${user?.role}) • Branch: ${user?.branch} • Total Logs: ${worklogs.length}`,
      metadata: {
        'Staff Member': user?.name || 'Staff Member',
        'Staff ID': staffId,
        'Branch': user?.branch || 'Coimbatore',
        'Role': user?.role?.toUpperCase() || 'EMPLOYEE',
      },
      headers: ['Log ID', 'Date', 'Login Time', 'Logout Time', 'Total Hours', 'Tasks Completed', 'Tasks Pending', 'Incomplete Reason'],
      rows: worklogs.map((w) => [
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
      filename: `GSS_Worklog_${user?.name?.replace(/\s+/g, '_') || 'Staff'}_Sep_2026`,
      title: 'Staff Daily Worklog & Task Execution Audit',
      subtitle: 'Official Work Activity & Verified Hours Log',
      period: 'September 2026',
      staffName: user?.name || 'Staff Member',
      staffRole: user?.role?.toUpperCase() || 'EMPLOYEE',
      branch: user?.branch || 'Coimbatore',
      sections: [
        {
          heading: '1. Logged Work Hours & Task History',
          description: 'Detailed daily work hours and task completion details.',
          table: {
            headers: ['Date', 'Login / Logout', 'Hours', 'Tasks Completed', 'Pending Tasks'],
            rows: worklogs.map((w) => [
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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--brand-container,#E8F0FE)] flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-[var(--brand-primary,#1A73E8)]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary,#1F1F1F)]">Daily Worklog</h1>
          <p className="text-xs text-[var(--text-muted,#5F6368)]">Track your daily work hours and task progress</p>
        </div>
      </div>

      {/* Today's Entry Card */}
      <div className="rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
            <span className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Today — {today}</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] font-medium">
            {user.name}
          </span>
        </div>

        {/* Time Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1 block">
              <LogIn className="w-3.5 h-3.5 inline mr-1" /> Login Time
            </label>
            <input
              type="text"
              placeholder="09:00 AM"
              value={loginTime}
              onChange={(e) => setLoginTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-card,#DADCE0)] bg-[var(--bg-canvas,#F8FAFD)] text-sm text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)] focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1 block">
              <LogOut className="w-3.5 h-3.5 inline mr-1" /> Logout Time
            </label>
            <input
              type="text"
              placeholder="06:00 PM"
              value={logoutTime}
              onChange={(e) => setLogoutTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-card,#DADCE0)] bg-[var(--bg-canvas,#F8FAFD)] text-sm text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)] focus:border-transparent"
            />
          </div>
        </div>

        {/* Task Inputs */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1 block">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-[var(--badge-success-text,#137333)]" /> Tasks Completed
          </label>
          <textarea
            placeholder="Task 1; Task 2; Task 3 (semicolon separated)"
            value={tasksCompleted}
            onChange={(e) => setTasksCompleted(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-card,#DADCE0)] bg-[var(--bg-canvas,#F8FAFD)] text-sm text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)] focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1 block">
            <Clock className="w-3.5 h-3.5 inline mr-1 text-[var(--badge-warning-text,#B06000)]" /> Tasks Pending
          </label>
          <textarea
            placeholder="Pending tasks (semicolon separated)"
            value={tasksPending}
            onChange={(e) => setTasksPending(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-card,#DADCE0)] bg-[var(--bg-canvas,#F8FAFD)] text-sm text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)] focus:border-transparent resize-none"
          />
        </div>

        {tasksPending && (
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary,#5F6368)] mb-1 block">
              <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-[var(--badge-danger-text,#D93025)]" /> Reason for Incomplete
            </label>
            <input
              type="text"
              placeholder="Why are these tasks pending?"
              value={incompleteReason}
              onChange={(e) => setIncompleteReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-card,#DADCE0)] bg-[var(--bg-canvas,#F8FAFD)] text-sm text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1A73E8)] focus:border-transparent"
            />
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-[var(--badge-danger-text,#D93025)] bg-[var(--badge-danger-bg,#FCE8E6)] border border-[var(--badge-danger-border,#FAD2CF)] rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs text-[var(--badge-success-text,#137333)] bg-[var(--badge-success-bg,#E6F4EA)] border border-[var(--badge-success-border,#CEEAD6)] rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || !loginTime}
          className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[var(--brand-primary,#1A73E8)] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Worklog'}
        </button>
      </div>

      {/* Recent Worklogs Table */}
      <div className="rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-card,#DADCE0)] flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">Recent Worklogs ({worklogs.length})</h2>
          {worklogs.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-card,#DADCE0)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print / PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-card,#DADCE0)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportDocx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-card,#DADCE0)] text-xs font-medium text-[var(--text-secondary,#444746)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                <span>Download DOCX</span>
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-primary,#1A73E8)]" />
          </div>
        ) : worklogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted,#5F6368)]">
            <ClipboardList className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">No worklogs yet. Start by logging today&apos;s work above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-card-subtle,#F8FAFD)] text-[var(--text-secondary,#5F6368)]">
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Login</th>
                  <th className="px-4 py-3 text-left font-semibold">Logout</th>
                  <th className="px-4 py-3 text-left font-semibold">Hours</th>
                  <th className="px-4 py-3 text-left font-semibold">Completed</th>
                  <th className="px-4 py-3 text-left font-semibold">Pending</th>
                  <th className="px-4 py-3 text-left font-semibold">Verified</th>
                </tr>
              </thead>
              <tbody>
                {worklogs.map((log, idx) => (
                  <tr key={log.logId || idx} className="border-t border-[var(--border-card,#DADCE0)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary,#1F1F1F)]">{log.date}</td>
                    <td className="px-4 py-3 text-[var(--badge-success-text,#137333)]">{log.loginTime || '—'}</td>
                    <td className="px-4 py-3">{log.logoutTime || '—'}</td>
                    <td className="px-4 py-3 font-medium">{log.totalHours || '—'}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={log.tasksCompleted}>{log.tasksCompleted || '—'}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate text-[var(--badge-warning-text,#B06000)]" title={log.tasksPending}>{log.tasksPending || '—'}</td>
                    <td className="px-4 py-3">
                      {log.verifiedBy ? (
                        <span className="inline-flex items-center gap-1 text-[var(--badge-success-text,#137333)]">
                          <CheckCircle2 className="w-3 h-3" />
                          {log.verifiedBy}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted,#5F6368)]">Pending</span>
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
