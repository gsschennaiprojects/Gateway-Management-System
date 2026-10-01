'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Building2,
  AlertCircle,
  Clock,
  Sparkles,
  RotateCcw,
  Archive,
  Database,
  Layers,
  X,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';
import { getLiveDateInfo } from '@/lib/worklogs/worklog-session-utils';
import { useAuth } from '@/context/AuthContext';
import { BRANCHES, Branch } from '@/types/auth';

interface StaffAttendanceRecord {
  id: string;
  name: string;
  role: string;
  branch?: string;
  punchInTime?: string;
  punchOutTime?: string;
  attendance: Record<number, 'present' | 'absent' | 'holiday' | 'half_day' | 'late'>;
  lastUpdated?: string;
  updatedBy?: {
    id: string;
    name: string;
    role: string;
  };
}

export default function AttendanceMasterGridPage() {
  const { user: currentUser } = useAuth();
  const liveDate = useMemo(() => getLiveDateInfo(), []);

  // Selected month & year state (defaults to live system date)
  const [selectedYear, setSelectedYear] = useState<number>(liveDate.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(liveDate.month); // 1-12
  const [selectedBranch, setSelectedBranch] = useState<string>('All');

  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [isExecutingRollover, setIsExecutingRollover] = useState(false);
  const [rolloverNotice, setRolloverNotice] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: {
      archivedAttendanceCount?: number;
      archivedWorklogCount?: number;
      initializedStaffCount?: number;
      branchesUpdated?: string[];
      previousPeriod?: { monthName: string };
      currentPeriod?: { monthName: string };
    };
  } | null>(null);

  // Set default branch based on current user role
  useEffect(() => {
    if (currentUser && currentUser.role !== 'superadmin' && currentUser.branch) {
      setSelectedBranch(currentUser.branch);
    }
  }, [currentUser]);

  // Track if changes have been made since last load or save
  const currentSnapshot = useMemo(() => {
    return JSON.stringify(records.map(r => ({ id: r.id, att: r.attendance })));
  }, [records]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSnapshot || loading) return false;
    return currentSnapshot !== initialSnapshot;
  }, [currentSnapshot, initialSnapshot, loading]);

  // Warn if leaving page with unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Is viewing the current live month?
  const isCurrentLiveMonth = selectedYear === liveDate.year && selectedMonth === liveDate.month;
  const todayDay = isCurrentLiveMonth ? liveDate.day : null;

  // Month Display Title (e.g. "September 2026")
  const currentMonthTitle = useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedYear, selectedMonth]);

  // Dynamically compute working days for selected year and month (omitting Sundays per GSS policy)
  const workingDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const list: { day: number; weekdayShort: string; isSunday: boolean; dateStr: string }[] = [];
    const weekdayAbbrs = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(selectedYear, selectedMonth - 1, d);
      const dayOfWeek = dt.getDay();
      if (dayOfWeek !== 0) {
        // Omit Sundays
        const mm = String(selectedMonth).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        list.push({
          day: d,
          weekdayShort: weekdayAbbrs[dayOfWeek],
          isSunday: false,
          dateStr: `${selectedYear}-${mm}-${dd}`,
        });
      }
    }
    return list;
  }, [selectedYear, selectedMonth]);

  // Month Navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToLive = () => {
    setSelectedYear(liveDate.year);
    setSelectedMonth(liveDate.month);
  };

  // Fetch staff users and live attendance records from Firestore
  const loadAttendanceData = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
      });
      if (selectedBranch && selectedBranch !== 'All') {
        params.set('branch', selectedBranch);
      }

      const res = await fetch(`/api/admin/attendance?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Staff attendance could not be loaded from database.');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setRecords(data.records);
        const snap = JSON.stringify(data.records.map((r: StaffAttendanceRecord) => ({ id: r.id, att: r.attendance })));
        setInitialSnapshot(snap);
        if (data.lastUpdated) {
          setLastSavedTimestamp(data.lastUpdated);
        }
      } else {
        throw new Error(data.error || 'Failed to parse attendance records.');
      }
    } catch (err) {
      console.error('[AttendanceMaster] Error loading grid data:', err);
      setDataError(err instanceof Error ? err.message : 'Attendance data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedBranch]);

  useEffect(() => {
    void Promise.resolve().then(loadAttendanceData);
  }, [loadAttendanceData]);

  // Cycle status on cell click (unrecorded -> present -> late -> half_day -> absent -> holiday -> unrecorded)
  const cycleStatus = (recordId: string, day: number) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordId) return rec;
        const current = rec.attendance[day];
        const next: Record<string, 'present' | 'late' | 'half_day' | 'absent' | 'holiday' | undefined> = {
          unrecorded: 'present',
          present: 'late',
          late: 'half_day',
          half_day: 'absent',
          absent: 'holiday',
          holiday: undefined,
        };
        const nextStatus = next[current || 'unrecorded'];
        const updatedAttendance = { ...rec.attendance };
        if (nextStatus) {
          updatedAttendance[day] = nextStatus;
        } else {
          delete updatedAttendance[day];
        }
        return {
          ...rec,
          attendance: updatedAttendance,
        };
      })
    );
  };

  // Quick Action: Mark all active staff present for today
  const handleMarkAllPresentToday = () => {
    if (!todayDay) return;
    setRecords((prev) =>
      prev.map((rec) => ({
        ...rec,
        attendance: {
          ...rec.attendance,
          [todayDay]: 'present',
        },
      }))
    );
  };

  // Reset to last saved state from server
  const handleDiscardChanges = () => {
    void loadAttendanceData();
  };

  // Save changes and overwrite in Firestore
  const handleSave = async () => {
    setSaving(true);
    setDataError(null);
    try {
      const response = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth,
          records: records.map((r) => ({
            staffId: r.id,
            name: r.name,
            attendance: r.attendance,
          })),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Attendance changes could not be saved to Firestore.');
      }

      // Update snapshot to mark dirty state as clean
      const snap = JSON.stringify(records.map(r => ({ id: r.id, att: r.attendance })));
      setInitialSnapshot(snap);
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedTimestamp(result.updatedAt || new Date().toISOString());
      setSavedNotice(`Attendance successfully updated & overwritten in Firestore (${timeStr}). Dual-logged to Sheets.`);
      setTimeout(() => setSavedNotice(null), 5000);
    } catch (err) {
      console.error('[AttendanceMaster] Save error:', err);
      setDataError(err instanceof Error ? err.message : 'Attendance changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  // Perform Month Rollover & Firestore Archiving
  const handlePerformMonthRollover = async () => {
    setIsExecutingRollover(true);
    setRolloverNotice(null);
    try {
      const res = await fetch('/api/admin/rollover-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete month rollover and archiving.');
      }
      setRolloverNotice({
        type: 'success',
        message: data.result?.message || 'Previous month successfully archived to separate collections and new month initialized.',
        details: data.result,
      });
      // Refresh current attendance grid to reflect latest state
      await loadAttendanceData();
    } catch (err: unknown) {
      setRolloverNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Month rollover failed.',
      });
    } finally {
      setIsExecutingRollover(false);
    }
  };

  // Export Excel (.xlsx) with Live Date
  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      const headers = [
        'Staff Member',
        'Role',
        'Branch',
        ...workingDays.map((d) => `${d.day} (${d.weekdayShort})`),
        'Total Present',
        'Attendance Rate %',
      ];

      const rows = records.map((r) => {
        const daysPresent = workingDays.filter((d) => {
          const st = r.attendance[d.day] || '-';
          return st === 'present';
        }).length;

        const rate = workingDays.length > 0 ? Math.round((daysPresent / workingDays.length) * 100) : 0;

        return [
          r.name,
          r.role,
          r.branch || 'General',
          ...workingDays.map((d) => {
            const st = r.attendance[d.day] || '-';
            return st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'holiday' ? 'H' : '-';
          }),
          daysPresent,
          `${rate}%`,
        ];
      });

      exportToExcel({
        filename: `GSS_Staff_Attendance_Master_${currentMonthTitle.replace(/\s+/g, '_')}`,
        sheetName: 'Attendance Master',
        title: `Gateway Software Solutions — Staff Attendance Master Grid`,
        subtitle: `${currentMonthTitle} • ${workingDays.length} Working Days (Sundays Excluded) • Staff Count: ${records.length} • Overwritten to Firestore`,
        headers,
        rows,
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  // Export DOCX (.docx) with Live Date
  const handleExportDocx = async () => {
    setDownloadingFormat('docx');
    try {
      await exportToDocx({
        filename: `GSS_Staff_Attendance_Master_${currentMonthTitle.replace(/\s+/g, '_')}`,
        title: 'Staff Attendance Master Audit Record',
        subtitle: 'Monthly Staff Attendance Verification & Working Day Compliance',
        period: currentMonthTitle,
        branch: selectedBranch === 'All' ? 'All Branches' : selectedBranch,
        staffName: currentUser?.name || 'Administrator',
        staffRole: (currentUser?.role || 'admin').toUpperCase(),
        sections: [
          {
            heading: '1. Staff Attendance Rate Summary',
            description: `Audited attendance percentages across all staff members for ${currentMonthTitle}. Canonical source: Firestore.`,
            table: {
              headers: ['Staff Member', 'Role', 'Branch', 'Working Days', 'Days Present', 'Attendance %', 'Status'],
              rows: records.map((r) => {
                const daysPresent = workingDays.filter((d) => {
                  const st = r.attendance[d.day] || '-';
                  return st === 'present';
                }).length;
                const rate = workingDays.length > 0 ? Math.round((daysPresent / workingDays.length) * 100) : 0;
                return [
                  r.name,
                  r.role,
                  r.branch || 'Operations',
                  workingDays.length,
                  daysPresent,
                  `${rate}%`,
                  rate >= 90 ? 'Compliant' : 'Review',
                ];
              }),
              columnWidthsPercentage: [22, 18, 14, 12, 12, 11, 11],
            },
          },
          {
            heading: '2. Audit Certification',
            bullets: [
              'All working days omit Sundays per GSS corporate calendar policies.',
              'Overwritten and maintained directly in Cloud Firestore staff_attendance collection.',
              'Synchronized with Google Sheets 04_Staff_Attendance for payroll archival.',
              `Last Saved Timestamp: ${lastSavedTimestamp || 'Live Synced'}.`,
            ],
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6 animate-panel-entrance max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                  Staff Attendance Master Grid
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                  Live System Date: {liveDate.formattedDate}
                </span>
                {lastSavedTimestamp && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Last Saved: {new Date(lastSavedTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary,#444746)] mt-0.5">
                {currentMonthTitle} working calendar — Sundays omitted. Tap any cell to cycle status (P/A/H). Overwrites canonically to Cloud Firestore.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Primary Save Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {hasUnsavedChanges && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDiscardChanges}
              disabled={saving}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Discard Edits
            </Button>
          )}

          {isCurrentLiveMonth && todayDay && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllPresentToday}
              disabled={saving || loading}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
              className="text-xs hidden md:inline-flex"
            >
              Mark All Present Today
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print
          </Button>

          {isSuperAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setIsRolloverModalOpen(true); setRolloverNotice(null); }}
              leftIcon={<Archive className="w-3.5 h-3.5 text-blue-600" />}
              className="text-xs"
            >
              Month Archive & Rollover
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            disabled={downloadingFormat !== null}
            leftIcon={
              downloadingFormat === 'excel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )
            }
          >
            Excel
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportDocx}
            disabled={downloadingFormat !== null}
            leftIcon={
              downloadingFormat === 'docx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )
            }
          >
            DOCX
          </Button>

          {/* Canonical Overwrite Save Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            leftIcon={
              saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
            className={`font-semibold shadow-xs transition-all ${
              hasUnsavedChanges
                ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-600 hover:bg-emerald-700 text-white'
                : ''
            }`}
          >
            {saving ? 'Saving to Firestore...' : hasUnsavedChanges ? 'Save Changes (Unsaved)' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="p-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="font-medium">
              You have unsaved changes in the attendance matrix. Click <strong>Save Changes</strong> to overwrite and persist to Cloud Firestore.
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            {saving ? 'Saving...' : 'Save Now'}
          </Button>
        </div>
      )}

      {/* Success Notification */}
      {savedNotice && (
        <div className="p-3 px-4 rounded-xl bg-[var(--badge-success-bg,#E6F4EA)] border border-[var(--badge-success-border,#CEEAD6)] text-[var(--badge-success-text,#137333)] text-xs flex items-center gap-2 transition-all shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{savedNotice}</span>
        </div>
      )}

      {/* Error Notification */}
      {dataError && (
        <div role="alert" className="p-3 px-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{dataError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadAttendanceData} className="h-6 text-[11px]">
            Retry
          </Button>
        </div>
      )}

      {/* Month Navigation, Branch Filter & Grid Legend Bar */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-3.5 px-5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-xs">
        {/* Month Selector Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-[var(--border-card,#DADCE0)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] text-[var(--text-secondary,#5F6368)] transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-semibold text-xs text-[var(--text-primary,#1F1F1F)] px-2 min-w-[130px] text-center">
            {currentMonthTitle}
          </span>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-[var(--border-card,#DADCE0)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] text-[var(--text-secondary,#5F6368)] transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isCurrentLiveMonth && (
            <button
              type="button"
              onClick={handleResetToLive}
              className="ml-2 px-2.5 py-1 rounded-lg bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] hover:bg-[var(--brand-container-hover,#D2E3FC)] text-[11px] font-semibold transition cursor-pointer"
            >
              Back to Today
            </button>
          )}
        </div>

        {/* Branch Filter for Super Admin */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--text-muted,#747775)]" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-[var(--bg-canvas,#F8FAFD)] border border-[var(--border-card,#DADCE0)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A73E8)]"
            >
              <option value="All">All Branches (CHN, CBE, MDU, ERD)</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b} Branch
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Legend */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[var(--text-secondary,#444746)] font-medium">Status:</span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--badge-success-text,#137333)]" />
            <span>Present (P)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            <span>Late (L)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-orange-600" />
            <span>Half-Day (HD)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--badge-danger-bg,#FCE8E6)] text-[var(--badge-danger-text,#C5221F)] border border-[var(--badge-danger-border,#FAD2CF)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--badge-danger-text,#C5221F)]" />
            <span>Absent (A)</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] border border-[var(--border-card,#DADCE0)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--text-muted,#5F6368)]" />
            <span>Holiday (H)</span>
          </div>
        </div>

        {/* Today Indicator */}
        <div className="flex items-center gap-2 text-[var(--brand-on-container,#1A73E8)] bg-[var(--brand-container,#E8F0FE)] px-3 py-1 rounded-full font-semibold text-xs border border-[var(--border-subtle,#D2E3FC)] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[var(--brand-primary,#1A73E8)] animate-pulse" />
          <span>Today: {liveDate.formattedDate}</span>
        </div>
      </div>

      {/* Horizontally Scrollable Grid with Sticky Left Column */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] text-[11px] font-medium text-[var(--text-secondary,#444746)]">
                {/* Sticky Left Column: Staff Member */}
                <th className="py-3.5 px-4 sticky left-0 z-20 bg-[var(--bg-card-subtle,#F8FAFD)] min-w-[220px] border-r border-[var(--border-card,#DADCE0)] uppercase tracking-wider text-[var(--text-secondary,#444746)]">
                  Staff Member
                </th>
                {workingDays.map((w) => {
                  const isToday = isCurrentLiveMonth && w.day === todayDay;
                  return (
                    <th
                      key={w.day}
                      className={`py-2 px-1.5 text-center min-w-[44px] border-r border-[var(--border-subtle,#E8EAED)] ${
                        isToday
                          ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] font-bold border-b-2 border-b-[var(--brand-primary,#1A73E8)]'
                          : 'text-[var(--text-secondary,#444746)]'
                      }`}
                    >
                      {isToday && (
                        <span className="inline-block text-[8px] uppercase tracking-wider font-extrabold bg-[var(--brand-primary,#1A73E8)] text-white rounded px-1 py-0.2 mb-0.5 shadow-2xs">
                          TODAY
                        </span>
                      )}
                      <span className="block text-xs font-semibold">{w.day}</span>
                      <span className="block text-[10px] text-[var(--text-muted,#747775)]">
                        {w.weekdayShort}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,#E8EAED)] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={workingDays.length + 1} className="py-16 text-center text-[var(--text-secondary,#444746)]">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-[var(--brand-primary,#1A73E8)]" />
                    <p className="font-semibold text-sm text-[var(--text-primary,#1F1F1F)]">
                      Loading {currentMonthTitle} Attendance Grid from Firestore...
                    </p>
                    <p className="text-xs text-[var(--text-muted,#747775)] mt-1">
                      Querying live canonical database and biometric registers...
                    </p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={workingDays.length + 1} className="py-12 text-center text-[var(--text-secondary,#444746)]">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--text-muted,#747775)]" />
                    <p className="font-medium text-sm text-[var(--text-primary,#1F1F1F)]">No staff attendance records</p>
                    <p className="text-xs text-[var(--text-muted,#747775)] mt-1">
                      Staff members from this branch will appear here once approved.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[var(--bg-card-hover,#F8FAFD)] transition-colors">
                    {/* Sticky Employee Name Column */}
                    <td className="py-3 px-4 sticky left-0 z-10 bg-[var(--bg-card,#FFFFFF)] border-r border-[var(--border-card,#DADCE0)] font-medium text-[var(--text-primary,#1F1F1F)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] font-bold text-xs flex items-center justify-center shrink-0">
                          {rec.name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="font-semibold text-xs text-[var(--text-primary,#1F1F1F)] truncate">
                            {rec.name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted,#747775)] truncate">{rec.role}</p>
                        </div>
                      </div>
                    </td>

                    {workingDays.map((w) => {
                      const isToday = isCurrentLiveMonth && w.day === todayDay;
                      const status = rec.attendance[w.day];

                      const statusStyles = {
                        present:
                          'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border-[var(--badge-success-border,#CEEAD6)] hover:opacity-90',
                        late:
                          'bg-amber-100 text-amber-900 border-amber-300 hover:opacity-90 font-bold',
                        half_day:
                          'bg-orange-100 text-orange-900 border-orange-300 hover:opacity-90 font-bold',
                        absent:
                          'bg-[var(--badge-danger-bg,#FCE8E6)] text-[var(--badge-danger-text,#C5221F)] border-[var(--badge-danger-border,#FAD2CF)] hover:opacity-90',
                        holiday:
                          'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)]',
                      };

                      return (
                        <td
                          key={w.day}
                          className={`p-1 text-center border-r border-[var(--border-subtle,#E8EAED)] ${
                            isToday ? 'bg-[var(--brand-container,#E8F0FE)]/40 font-bold' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => cycleStatus(rec.id, w.day)}
                            className={`w-7 h-7 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center ${
                              status
                                ? statusStyles[status]
                                : 'bg-[var(--bg-canvas,#F8FAFD)] text-[var(--text-muted,#9AA0A6)] border-dashed border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)] hover:text-[var(--text-primary,#1F1F1F)]'
                            }`}
                            title={`${w.weekdayShort} ${w.day}: ${status ? status.toUpperCase() : 'UNRECORDED'} ${
                              isToday && rec.punchInTime ? `(Punched In: ${rec.punchInTime})` : ''
                            } (Click to toggle)`}
                          >
                            {status === 'present' ? 'P' : status === 'late' ? 'L' : status === 'half_day' ? 'HD' : status === 'absent' ? 'A' : status === 'holiday' ? 'H' : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Month Rollover & Firestore Archiving Modal */}
      {isRolloverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-5 animate-panel-entrance text-[var(--text-primary,#1F1F1F)]">
            <button
              type="button"
              onClick={() => setIsRolloverModalOpen(false)}
              className="absolute top-5 right-5 text-[var(--text-muted,#70757A)] hover:text-[var(--text-primary,#1F1F1F)] p-1 rounded-full hover:bg-[var(--bg-card-subtle,#F1F3F4)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary,#1F1F1F)]">
                  Monthly Rollover & Archive Console
                </h3>
                <p className="text-xs text-[var(--text-secondary,#5F6368)]">
                  Permanent monthly snapshotting to separate Firestore collections
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-subtle,#E8EAED)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary,#5F6368)]">Active Calendar Period:</span>
                  <span className="font-semibold text-[var(--brand-primary,#1A73E8)]">{currentMonthTitle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary,#5F6368)]">Target Attendance Archive:</span>
                  <span className="font-mono text-[11px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    monthly_attendance_archives
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary,#5F6368)]">Target Worklogs Archive:</span>
                  <span className="font-mono text-[11px] bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    monthly_worklog_archives
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs">
                <p className="font-semibold mb-1">Actions performed on rollover:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Computes complete attendance percentage, working hours & punch matrix for every employee.</li>
                  <li>Archives all completed worklogs and deliverables into separate Firestore archive collection.</li>
                  <li>Initializes fresh month grids in <strong>staff_attendance</strong> across all 4 branches.</li>
                  <li>Synchronizes <strong>branch_metrics</strong> and updates global <strong>systemConfig/monthly_state</strong>.</li>
                </ul>
              </div>
            </div>

            {rolloverNotice && (
              <div
                className={`p-3.5 rounded-2xl text-xs border flex items-start gap-2.5 ${
                  rolloverNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
                }`}
              >
                {rolloverNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{rolloverNotice.message}</p>
                  {rolloverNotice.details && (
                    <div className="mt-2 text-[11px] font-mono grid grid-cols-2 gap-1.5 pt-1.5 border-t border-emerald-200 dark:border-emerald-800">
                      <div>Archived Attendance: <strong>{rolloverNotice.details.archivedAttendanceCount}</strong></div>
                      <div>Archived Worklogs: <strong>{rolloverNotice.details.archivedWorklogCount}</strong></div>
                      <div>Staff Initialized: <strong>{rolloverNotice.details.initializedStaffCount}</strong></div>
                      <div>Branches: <strong>{rolloverNotice.details.branchesUpdated?.join(', ')}</strong></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRolloverModalOpen(false)}
                disabled={isExecutingRollover}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePerformMonthRollover}
                isLoading={isExecutingRollover}
                leftIcon={<Database className="w-4 h-4" />}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Run Archive & Rollover
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
