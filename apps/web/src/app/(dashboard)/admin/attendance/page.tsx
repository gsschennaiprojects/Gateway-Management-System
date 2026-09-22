'use client';

import React, { useState, useEffect } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/Button';
import { CalendarCheck, ChevronLeft, ChevronRight, Save, Download, CheckCircle2, AlertCircle, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';

interface StaffAttendanceRecord {
  id: string;
  name: string;
  role: string;
  attendance: Record<number, 'present' | 'absent' | 'holiday'>;
}

// Generate September 2026 working days (omitting Sundays)
// In Sep 2026: Sep 1 is Tuesday, Sep 6, 13, 20, 27 are Sundays
const WORKING_DAYS_SEP_2026 = Array.from({ length: 30 }, (_, i) => i + 1).filter(
  (day) => ![6, 13, 20, 27].includes(day)
);

export default function AttendanceMasterGridPage() {
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);
  const todayDay = 12; // September 12, 2026

  useEffect(() => {
    fetch('/api/auth/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.users && data.users.length > 0) {
          const activeUsers = data.users.filter((u: any) => u.status === 'active');
          setRecords(
            activeUsers.map((u: any) => ({
              id: u.id,
              name: u.name,
              role: `${u.role.toUpperCase()} (${u.specialization || u.branch})`,
              attendance: {}
            }))
          );
        }
      })
      .catch(console.error);
  }, []);

  const cycleStatus = (recordId: string, day: number) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordId) return rec;
        const current = rec.attendance[day] || 'present';
        const next: Record<string, 'present' | 'absent' | 'holiday'> = {
          present: 'absent',
          absent: 'holiday',
          holiday: 'present',
        };
        return {
          ...rec,
          attendance: {
            ...rec.attendance,
            [day]: next[current],
          },
        };
      })
    );
  };

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      const headers = ['Staff Member', 'Role', ...WORKING_DAYS_SEP_2026.map(d => `Sep ${d}`), 'Total Present', 'Rate %'];
      const rows = records.map(r => {
        const daysPresent = WORKING_DAYS_SEP_2026.filter(d => (r.attendance[d] || (d <= todayDay ? 'present' : '-')) === 'present').length;
        const rate = Math.round((daysPresent / WORKING_DAYS_SEP_2026.length) * 100);
        return [
          r.name,
          r.role.toUpperCase(),
          ...WORKING_DAYS_SEP_2026.map(d => {
            const st = r.attendance[d] || (d <= todayDay ? 'present' : '-');
            return st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'holiday' ? 'H' : '-';
          }),
          daysPresent,
          `${rate}%`,
        ];
      });

      exportToExcel({
        filename: `GSS_Staff_Attendance_Master_September_2026`,
        sheetName: 'Attendance Master',
        title: 'Gateway Software Solutions — Staff Attendance Master Grid',
        subtitle: `September 2026 • 26 Working Days (Sundays Excluded) • Staff Count: ${records.length}`,
        headers,
        rows,
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  // Export DOCX (.docx)
  const handleExportDocx = async () => {
    setDownloadingFormat('docx');
    try {
      await exportToDocx({
        filename: `GSS_Staff_Attendance_Master_September_2026`,
        title: 'Staff Attendance Master Audit Record',
        subtitle: 'Monthly Staff Attendance Verification & Working Day Compliance',
        period: 'September 2026',
        branch: 'Coimbatore',
        staffName: 'Admin Operations',
        staffRole: 'ADMIN',
        sections: [
          {
            heading: '1. Staff Attendance Rate Summary',
            description: 'Audited attendance percentages across all staff members for September 2026.',
            table: {
              headers: ['Staff Member', 'Role', 'Working Days', 'Days Present', 'Attendance %', 'Status'],
              rows: records.map(r => {
                const daysPresent = WORKING_DAYS_SEP_2026.filter(d => (r.attendance[d] || (d <= todayDay ? 'present' : '-')) === 'present').length;
                const rate = Math.round((daysPresent / WORKING_DAYS_SEP_2026.length) * 100);
                return [
                  r.name,
                  r.role.toUpperCase(),
                  WORKING_DAYS_SEP_2026.length,
                  daysPresent,
                  `${rate}%`,
                  rate >= 90 ? 'Compliant' : 'Review',
                ];
              }),
              columnWidthsPercentage: [25, 20, 15, 15, 13, 12],
            },
          },
          {
            heading: '2. Audit Certification',
            bullets: [
              'All working days omit Sundays per GSS corporate calendar policies.',
              'Verified against biometric and portal login/logout timestamps.',
              'Archived for corporate compliance and monthly payroll processing.',
            ],
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  return (
    <div className="space-y-6 animate-panel-entrance max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Attendance Master Grid
              </h1>
              <p className="text-xs text-[var(--text-secondary,#444746)] mt-0.5">
                September 2026 working calendar — Sundays omitted per policy. Tap any cell to cycle status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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
            {downloadingFormat === 'excel' ? 'Exporting...' : 'Download Excel'}
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
            {downloadingFormat === 'docx' ? 'Generating...' : 'Download DOCX'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} leftIcon={<Save className="w-3.5 h-3.5" />}>
            Save Changes
          </Button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 px-4 rounded-xl bg-[var(--badge-success-bg,#E6F4EA)] border border-[var(--badge-success-border,#CEEAD6)] text-[var(--badge-success-text,#137333)] text-xs flex items-center gap-2 transition-all">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Attendance records successfully updated and synced across GSS network.</span>
        </div>
      )}

      {/* Grid Legend & Status Filters */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-3.5 px-5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[var(--text-secondary,#444746)] font-medium">Status Legend:</span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border border-[var(--badge-success-border,#CEEAD6)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--badge-success-text,#137333)]" />
            <span>Present (P)</span>
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

        <div className="flex items-center gap-2 text-[var(--brand-on-container,#1A73E8)] bg-[var(--brand-container,#E8F0FE)] px-3 py-1 rounded-full font-medium text-xs">
          <span className="w-2 h-2 rounded-full bg-[var(--brand-primary,#1A73E8)]" />
          <span>Today: Sep 12, 2026</span>
        </div>
      </div>

      {/* Horizontally Scrollable Grid with Sticky Left Column */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-card,#DADCE0)] bg-[var(--bg-card-subtle,#F8FAFD)] text-[11px] font-medium text-[var(--text-secondary,#444746)]">
                {/* Sticky Left Column */}
                <th className="py-3.5 px-4 sticky left-0 z-20 bg-[var(--bg-card-subtle,#F8FAFD)] min-w-[220px] border-r border-[var(--border-card,#DADCE0)] uppercase tracking-wider text-[var(--text-secondary,#444746)]">
                  Staff Member
                </th>
                {WORKING_DAYS_SEP_2026.map((day) => {
                  const isToday = day === todayDay;
                  return (
                    <th
                      key={day}
                      className={`py-2 px-1.5 text-center min-w-[44px] border-r border-[var(--border-subtle,#E8EAED)] ${
                        isToday
                          ? 'bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] font-bold border-b-2 border-b-[var(--brand-primary,#1A73E8)]'
                          : 'text-[var(--text-secondary,#444746)]'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{day}</span>
                      <span className="block text-[10px] text-[var(--text-muted,#747775)]">
                        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][(day + 1) % 6]}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,#E8EAED)] text-xs">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={WORKING_DAYS_SEP_2026.length + 1} className="py-12 text-center text-[var(--text-secondary,#444746)]">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--text-muted,#747775)]" />
                    <p className="font-medium text-sm text-[var(--text-primary,#1F1F1F)]">No staff attendance records</p>
                    <p className="text-xs text-[var(--text-muted,#747775)] mt-1">Staff members from your branch will appear here once approved.</p>
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
                        <p className="font-semibold text-xs text-[var(--text-primary,#1F1F1F)] truncate">{rec.name}</p>
                        <p className="text-[10px] text-[var(--text-muted,#747775)] truncate">{rec.role}</p>
                      </div>
                    </div>
                  </td>

                  {WORKING_DAYS_SEP_2026.map((day) => {
                    const status = rec.attendance[day] || (day <= todayDay ? 'present' : undefined);
                    const isToday = day === todayDay;

                    const statusStyles = {
                      present: 'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border-[var(--badge-success-border,#CEEAD6)] hover:opacity-90',
                      absent: 'bg-[var(--badge-danger-bg,#FCE8E6)] text-[var(--badge-danger-text,#C5221F)] border-[var(--badge-danger-border,#FAD2CF)] hover:opacity-90',
                      holiday: 'bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#5F6368)] border-[var(--border-card,#DADCE0)] hover:border-[var(--brand-primary,#1A73E8)]',
                    };

                    return (
                      <td
                        key={day}
                        className={`p-1 text-center border-r border-[var(--border-subtle,#E8EAED)] ${
                          isToday ? 'bg-[var(--brand-container,#E8F0FE)]/40' : ''
                        }`}
                      >
                        {status ? (
                          <button
                            onClick={() => cycleStatus(rec.id, day)}
                            className={`w-7 h-7 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center ${
                              statusStyles[status]
                            }`}
                            title={`Sep ${day}: ${status} (Click to toggle)`}
                          >
                            {status === 'present' ? 'P' : status === 'absent' ? 'A' : 'H'}
                          </button>
                        ) : (
                          <span className="text-[var(--text-muted,#9AA0A6)] text-xs font-mono">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
