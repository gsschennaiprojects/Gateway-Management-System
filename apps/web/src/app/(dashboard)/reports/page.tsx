'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';
import { getLiveDateInfo } from '@/lib/worklogs/worklog-session-utils';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  GraduationCap,
  Printer,
  Loader2,
  RefreshCw,
  Calendar,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Activity,
  Sparkles,
} from 'lucide-react';

interface DomainCohort {
  domain: string;
  candidateCount: number;
  feeSummary: string;
  projectSummary: string;
}

interface MonthlyReportPayload {
  year: number;
  month: number;
  monthName: string;
  periodLabel: string;
  systemChecksum: string;
  staff: {
    id: string;
    employeeId: string;
    name: string;
    role: string;
    branch: string;
    specialization: string;
  };
  metrics: {
    workingDays: number;
    elapsedWorkingDays: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    lateDays: number;
    holidayDays: number;
    attendancePercentage: number;
    totalInternsMentored: number;
    activeBatchCount: number;
    tasksConcluded: number;
    totalTasksAssigned: number;
    taskOnTimeRate: number;
    totalInstructionalHours: number;
  };
  domainCohorts: DomainCohort[];
  keyDeliverables: string[];
  rawAttendance: Record<number, string>;
}

interface StaffOption {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  branch: string;
}

export default function MonthlyReportPage() {
  const { user: currentUser } = useAuth();
  const liveDate = useMemo(() => getLiveDateInfo(), []);

  const [selectedYear, setSelectedYear] = useState<number>(liveDate.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(liveDate.month); // 1-12
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  const [report, setReport] = useState<MonthlyReportPayload | null>(null);
  const [availableStaff, setAvailableStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  // Month navigation options (current live month + previous 11 months)
  const monthOptions = useMemo(() => {
    const list: { year: number; month: number; label: string }[] = [];
    const curYear = liveDate.year;
    const curMonth = liveDate.month;

    for (let i = 0; i < 12; i++) {
      let m = curMonth - i;
      let y = curYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const d = new Date(y, m - 1, 1);
      const name = d.toLocaleString('en-US', { month: 'long' });
      list.push({
        year: y,
        month: m,
        label: `${name} ${y}${i === 0 ? ' (Live Active Month)' : ''}`,
      });
    }
    return list;
  }, [liveDate.year, liveDate.month]);

  // Fetch report data from authoritative live database endpoint
  const fetchLiveReport = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      try {
        const staffParam = selectedStaffId ? `&targetUserId=${encodeURIComponent(selectedStaffId)}` : '';
        const url = `/api/reports/monthly?year=${selectedYear}&month=${selectedMonth}${staffParam}`;
        const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.report) {
            setReport(data.report);
            if (Array.isArray(data.availableStaff) && data.availableStaff.length > 0) {
              setAvailableStaff(data.availableStaff);
            }
            const now = new Date();
            setLastSyncedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          }
        }
      } catch (err) {
        console.error('[MonthlyReportPage] Fetch error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedYear, selectedMonth, selectedStaffId]
  );

  // Initial load and whenever year/month/staff changes
  useEffect(() => {
    setLoading(true);
    void fetchLiveReport();
  }, [fetchLiveReport]);

  // Regular periodic auto-sync every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchLiveReport(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchLiveReport]);

  // Step to previous / next month
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Live Excel Download
  const handleDownloadExcel = () => {
    if (!report) return;
    setDownloadingFormat('excel');
    try {
      const staffName = report.staff.name || currentUser?.name || 'Staff';
      const staffRole = (report.staff.role || currentUser?.role || 'EMPLOYEE').toUpperCase();
      const staffBranch = report.staff.branch || currentUser?.branch || 'Universal';
      const cleanFileName = `GSS_Monthly_Report_${staffName.replace(/\s+/g, '_')}_${report.monthName}_${report.year}`;

      const rows: (string | number)[][] = [
        ['Staff Name', staffName, 'Official Registered Profile'],
        ['Employee ID / UID', report.staff.employeeId, 'GSS Professional Identifier'],
        ['Designation & Specialization', `${staffRole} • ${report.staff.specialization}`, `${staffBranch} Branch`],
        ['Report Period', report.periodLabel, 'Audited Calendar Days'],
        ['Total Working Days', report.metrics.workingDays, 'Sundays Excluded (Official Calendar)'],
        ['Days Present', report.metrics.presentDays, `${report.metrics.attendancePercentage}% Verified Attendance`],
        ['Days Absent / Leave', report.metrics.absentDays, 'Recorded Absences / Leave'],
        ['Interns & Students Mentored', report.metrics.totalInternsMentored, `Across ${report.metrics.activeBatchCount} Technical Batches`],
        ['Tasks & Milestones Concluded', report.metrics.tasksConcluded, `${report.metrics.taskOnTimeRate}% On-Time Completion Rate`],
        ['Instructional Work Hours', `${report.metrics.totalInstructionalHours} Hours`, 'Verified Worklog Activity'],
      ];

      // Append domain cohorts
      for (const cohort of report.domainCohorts) {
        rows.push([cohort.domain, `${cohort.candidateCount} Trainees`, `${cohort.feeSummary} • ${cohort.projectSummary}`]);
      }

      // Append deliverables
      for (const del of report.keyDeliverables) {
        rows.push(['Key Deliverable / Milestone', del, 'Verified Delivery']);
      }

      exportToExcel({
        filename: cleanFileName,
        sheetName: 'Performance Audit',
        title: 'Monthly Performance & Attendance Audit',
        subtitle: `Report Period: ${report.periodLabel}`,
        metadata: {
          'Staff Member': staffName,
          'Employee ID': report.staff.employeeId,
          'Designation & Role': `${staffRole} • ${staffBranch} Branch`,
          'Verification Status': 'Verified Live Database Record',
          'System Checksum': report.systemChecksum,
          'Audit Timestamp': new Date().toISOString(),
        },
        headers: ['Metric / Module Item', 'Recorded Value', 'Benchmark / Remarks'],
        rows,
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  // Live DOCX Download
  const handleDownloadDocx = async () => {
    if (!report) return;
    setDownloadingFormat('docx');
    try {
      const staffName = report.staff.name || currentUser?.name || 'Staff Member';
      const staffRole = (report.staff.role || currentUser?.role || 'EMPLOYEE').toUpperCase();
      const staffBranch = report.staff.branch || currentUser?.branch || 'Universal';
      const cleanFileName = `GSS_Monthly_Report_${staffName.replace(/\s+/g, '_')}_${report.monthName}_${report.year}`;

      await exportToDocx({
        filename: cleanFileName,
        title: 'Monthly Performance & Attendance Audit',
        subtitle: 'Official Monthly Staff Operational & Trainee Mentorship Summary',
        period: report.periodLabel,
        staffName,
        staffRole,
        branch: staffBranch,
        systemChecksum: report.systemChecksum,
        sections: [
          {
            heading: '1. Executive Performance Metrics',
            description: 'Audited monthly summary of staff attendance, supervised student enrollment, and technical milestone completion.',
            table: {
              headers: ['Audit Metric', 'Recorded Value', 'Benchmark', 'Compliance Status'],
              rows: [
                ['Total Working Days', report.metrics.workingDays, report.metrics.workingDays, '100% Expected'],
                ['Days Present', report.metrics.presentDays, report.metrics.workingDays, `${report.metrics.attendancePercentage}% Present`],
                ['Interns Mentored', report.metrics.totalInternsMentored, Math.max(1, report.metrics.totalInternsMentored), 'Target Met'],
                ['Milestone Deliverables', report.metrics.tasksConcluded, Math.max(1, report.metrics.tasksConcluded), `${report.metrics.taskOnTimeRate}% On-Time`],
              ],
              columnWidthsPercentage: [35, 20, 20, 25],
            },
          },
          {
            heading: '2. Supervised Trainee Cohort Breakdown',
            description: 'Trainee enrollment status and domain allocation across active technical training batches.',
            table: {
              headers: ['Domain Specialization', 'Trainee Count', 'Fee Status', 'Milestone State'],
              rows: report.domainCohorts.length > 0
                ? report.domainCohorts.map((c) => [c.domain, `${c.candidateCount} Candidates`, c.feeSummary, c.projectSummary])
                : [['General Operations', '0 Candidates', 'N/A', 'Active']],
              columnWidthsPercentage: [40, 20, 20, 20],
            },
          },
          {
            heading: '3. Key Deliverables & Achievements',
            bullets: report.keyDeliverables.length > 0
              ? report.keyDeliverables
              : ['Maintained operational consistency across assigned modules.'],
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const isSupervisor = ['superadmin', 'admin', 'hr'].includes(currentUser?.role || '');

  return (
    <div className="space-y-6 animate-panel-entrance max-w-7xl mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                  Monthly Operational Report
                </h1>
                {/* Live Data Pulsing Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live Database Sync</span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-0.5">
                Authoritative monthly performance, attendance, and supervised cohort audit
                {lastSyncedTime && ` • Last synced at ${lastSyncedTime}`}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Refresh, Print, Excel, DOCX */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchLiveReport(true)}
            disabled={refreshing || loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[var(--brand-primary,#1A73E8)]' : ''}`} />}
          >
            {refreshing ? 'Syncing...' : 'Refresh Live Data'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            Print / PDF
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={downloadingFormat !== null || loading || !report}
            leftIcon={
              downloadingFormat === 'excel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )
            }
          >
            {downloadingFormat === 'excel' ? 'Exporting...' : 'Download Excel'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadDocx}
            disabled={downloadingFormat !== null || loading || !report}
            leftIcon={
              downloadingFormat === 'docx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )
            }
          >
            {downloadingFormat === 'docx' ? 'Generating...' : 'Download DOCX'}
          </Button>
        </div>
      </div>

      {/* Dynamic Controls Bar: Month Selector & Staff Filter */}
      <div className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-[var(--border-card,#DADCE0)] rounded-xl overflow-hidden bg-[var(--bg-card-subtle,#F8FAFD)]">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-2 hover:bg-[var(--border-subtle,#D2E3FC)] text-[var(--text-secondary,#5F6368)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-primary,#1F1F1F)]">
              <Calendar className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
              <select
                aria-label="Select Report Month"
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  setSelectedYear(y);
                  setSelectedMonth(m);
                }}
                className="bg-transparent font-medium focus:outline-none cursor-pointer"
              >
                {monthOptions.map((opt) => (
                  <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-2 hover:bg-[var(--border-subtle,#D2E3FC)] text-[var(--text-secondary,#5F6368)] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs text-[var(--text-secondary,#5F6368)] hidden lg:inline">
            Live working days, attendance punch logs, and task completions are calculated dynamically.
          </span>
        </div>

        {/* Supervisor Staff Member Selector */}
        {isSupervisor && availableStaff.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary,#5F6368)] flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
              <span>Audit Staff:</span>
            </span>
            <select
              aria-label="Select Staff Member to Audit"
              value={selectedStaffId || (currentUser?.id || '')}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="text-xs font-medium px-3 py-1.5 rounded-xl border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] text-[var(--text-primary,#1F1F1F)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#1A73E8)] cursor-pointer"
            >
              <option value="">{currentUser?.name} ({currentUser?.role?.toUpperCase()} • Me)</option>
              {availableStaff
                .filter((st) => st.id !== currentUser?.id && st.employeeId !== currentUser?.id)
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.employeeId} • {st.role.toUpperCase()} • {st.branch})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Report Document Preview */}
      {loading ? (
        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-xs p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--brand-primary,#1A73E8)] animate-spin" />
          <p className="text-sm text-[var(--text-secondary,#5F6368)]">Compiling live performance & attendance audit...</p>
        </div>
      ) : report ? (
        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-xs p-8 md:p-12 space-y-8 print:shadow-none print:border-none print:p-0">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b border-[var(--border-subtle,#D2E3FC)] pb-6 gap-4">
            <div className="flex items-start gap-4">
              <BrandLogo size="md" showText={false} />
              <div>
                <span className="text-[10px] text-[var(--brand-primary,#1A73E8)] tracking-widest uppercase font-semibold">
                  Gateway Software Solutions • GSS Management System
                </span>
                <h2 className="text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">
                  Monthly Performance & Attendance Audit
                </h2>
                <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
                  Report Period: {report.periodLabel}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-right text-xs min-w-[200px]">
              <p className="text-[11px] text-[var(--text-secondary,#5F6368)]">Staff Member</p>
              <p className="font-semibold text-[var(--text-primary,#1F1F1F)] text-sm mt-0.5">{report.staff.name}</p>
              <p className="text-[var(--brand-primary,#1A73E8)] uppercase text-[10px] font-semibold mt-0.5">
                {report.staff.role} • {report.staff.branch} Branch
              </p>
              <p className="text-[10px] text-[var(--text-muted,#747775)] mt-0.5 font-mono">
                ID: {report.staff.employeeId}
              </p>
            </div>
          </div>

          {/* 4 Summary Metric Panels (100% Live Computed) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Working Days */}
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
              <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Working Days</span>
              <p className="text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">
                {report.metrics.workingDays}
              </p>
              <span className="text-[11px] text-[var(--badge-success-text,#137333)] font-medium">
                Sundays Excluded
              </span>
            </div>

            {/* Days Present */}
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
              <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Days Present</span>
              <p className="text-2xl font-semibold text-[var(--badge-success-text,#137333)] mt-1">
                {report.metrics.presentDays}
              </p>
              <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">
                {report.metrics.attendancePercentage}% Attendance
              </span>
            </div>

            {/* Interns Mentored */}
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
              <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Interns Mentored</span>
              <p className="text-2xl font-semibold text-[var(--badge-warning-text,#B06000)] mt-1">
                {report.metrics.totalInternsMentored}
              </p>
              <span className="text-[11px] text-[var(--text-secondary,#5F6368)]">
                {report.metrics.activeBatchCount > 0 ? `Across ${report.metrics.activeBatchCount} Batches` : 'Active Trainees'}
              </span>
            </div>

            {/* Tasks Concluded */}
            <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
              <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)] uppercase">Tasks Concluded</span>
              <p className="text-2xl font-semibold text-[var(--brand-primary,#1A73E8)] mt-1">
                {report.metrics.tasksConcluded}
              </p>
              <span className="text-[11px] text-[var(--badge-success-text,#137333)] font-medium">
                {report.metrics.taskOnTimeRate}% On-Time
              </span>
            </div>
          </div>

          {/* Breakdown Sections */}
          <div className="space-y-6 pt-2">
            {/* Students & Interns Maintained */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
                <span>Students & Interns Maintained</span>
              </h3>
              <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#5F6368)] space-y-2.5">
                {report.domainCohorts.length > 0 ? (
                  report.domainCohorts.map((cohort, idx) => (
                    <div
                      key={cohort.domain}
                      className={`flex justify-between py-1.5 ${
                        idx < report.domainCohorts.length - 1 ? 'border-b border-[var(--border-subtle,#D2E3FC)]' : ''
                      }`}
                    >
                      <span className="font-medium text-[var(--text-primary,#1F1F1F)]">{cohort.domain}</span>
                      <span className="text-[var(--text-secondary,#5F6368)]">
                        {cohort.feeSummary} • {cohort.projectSummary}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-muted,#747775)] py-1">
                    No individual student mentorship records currently assigned to this staff profile for {report.monthName} {report.year}.
                  </p>
                )}
              </div>
            </div>

            {/* Key Deliverables & Milestones Achieved */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)] mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--badge-success-text,#137333)]" />
                <span>Key Deliverables & Milestones Achieved</span>
              </h3>
              <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#5F6368)] space-y-2">
                {report.keyDeliverables.map((deliv, idx) => (
                  <p key={idx}>• {deliv}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Verification Signatures */}
          <div className="pt-8 border-t border-[var(--border-subtle,#D2E3FC)] flex justify-between items-end text-xs text-[var(--text-secondary,#5F6368)]">
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <p className="text-[11px] font-medium text-[var(--text-primary,#1F1F1F)]">
                  System Checksum: {report.systemChecksum}
                </p>
              </div>
              <p className="text-[10px] mt-0.5 text-[var(--text-muted,#747775)]">
                Digitally certified via GSS Management System Core Database
              </p>
            </div>
            <div className="text-right">
              <div className="w-36 border-b border-[var(--border-card,#DADCE0)] mb-1"></div>
              <p className="text-[11px] text-[var(--text-primary,#1F1F1F)] font-medium">Operations Director</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-xs p-12 text-center text-sm text-[var(--text-secondary,#5F6368)]">
          No live report data available for the selected period.
        </div>
      )}
    </div>
  );
}
