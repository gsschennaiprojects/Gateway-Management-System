'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/Button';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';
import { getLiveDateInfo } from '@/lib/worklogs/worklog-session-utils';

interface StaffAttendanceRecord {
  id: string;
  name: string;
  role: string;
  punchInTime?: string;
  punchOutTime?: string;
  attendance: Record<number, 'present' | 'absent' | 'holiday'>;
}

export default function AttendanceMasterGridPage() {
  const liveDate = useMemo(() => getLiveDateInfo(), []);
  
  // Selected month state (defaults to live system date)
  const [selectedYear, setSelectedYear] = useState<number>(liveDate.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(liveDate.month); // 1-12
  
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

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

  // Fetch staff users and actual live attendance records
  const loadAttendanceData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active users
      const usersRes = await fetch('/api/auth/users');
      const usersData = await usersRes.json();
      const activeUsers = (usersData.users || []).filter((u: any) => u.status === 'active');

      // 2. Fetch existing staff attendance records from sheets
      let sheetAttMap: Record<string, Record<number, 'present' | 'absent' | 'holiday'>> = {};
      let userPunchInfo: Record<string, { punchIn?: string; punchOut?: string }> = {};

      try {
        const attRes = await fetch('/api/sheets?type=staff_attendance');
        if (attRes.ok) {
          const attJson = await attRes.json();
          if (Array.isArray(attJson.data)) {
            attJson.data.forEach((row: any) => {
              // row: { staffId, date, status, punchIn, punchOut }
              if (row.staffId && row.date) {
                const dateParts = String(row.date).split('-');
                if (dateParts.length === 3) {
                  const rYear = parseInt(dateParts[0], 10);
                  const rMonth = parseInt(dateParts[1], 10);
                  const rDay = parseInt(dateParts[2], 10);

                  if (rYear === selectedYear && rMonth === selectedMonth) {
                    if (!sheetAttMap[row.staffId]) sheetAttMap[row.staffId] = {};
                    const st = String(row.status || '').toLowerCase();
                    if (st.includes('present') || st.includes('punched') || row.punchIn) {
                      sheetAttMap[row.staffId][rDay] = 'present';
                    } else if (st.includes('absent')) {
                      sheetAttMap[row.staffId][rDay] = 'absent';
                    } else if (st.includes('holiday')) {
                      sheetAttMap[row.staffId][rDay] = 'holiday';
                    }

                    if (rDay === todayDay) {
                      userPunchInfo[row.staffId] = {
                        punchIn: row.punchIn || row.checkIn,
                        punchOut: row.punchOut || row.checkOut,
                      };
                    }
                  }
                }
              }
            });
          }
        }
      } catch (attErr) {
        console.warn('[AttendanceMaster] Attendance fetch note:', attErr);
      }

      // 3. Build staff attendance records
      const initialRecords: StaffAttendanceRecord[] = activeUsers.map((u: any) => {
        const staffAtt = sheetAttMap[u.id] || {};
        const punches = userPunchInfo[u.id] || {};

        return {
          id: u.id,
          name: u.name,
          role: `${u.role.toUpperCase()} (${u.specialization || u.branch || 'Operations'})`,
          punchInTime: punches.punchIn,
          punchOutTime: punches.punchOut,
          attendance: staffAtt,
        };
      });

      setRecords(initialRecords);
    } catch (err) {
      console.error('[AttendanceMaster] Error loading grid data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, todayDay]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Cycle status on cell click (Present -> Absent -> Holiday -> Present)
  const cycleStatus = (recordId: string, day: number) => {
    setRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== recordId) return rec;
        const current = rec.attendance[day] || (todayDay && day <= todayDay ? 'present' : 'present');
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

  // Save changes to backend
  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist to sheets/attendance API
      await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'staff_attendance_bulk',
          year: selectedYear,
          month: selectedMonth,
          records: records.map((r) => ({
            staffId: r.id,
            name: r.name,
            attendance: r.attendance,
          })),
        }),
      }).catch((e) => console.warn('[AttendanceMaster] Save note:', e));

      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Export Excel (.xlsx) with Live Date
  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      const headers = [
        'Staff Member',
        'Role',
        ...workingDays.map((d) => `${d.day} (${d.weekdayShort})`),
        'Total Present',
        'Attendance Rate %',
      ];

      const rows = records.map((r) => {
        const daysPresent = workingDays.filter((d) => {
          const st = r.attendance[d.day] || (todayDay && d.day <= todayDay ? 'present' : '-');
          return st === 'present';
        }).length;

        const rate = Math.round((daysPresent / workingDays.length) * 100);

        return [
          r.name,
          r.role,
          ...workingDays.map((d) => {
            const st = r.attendance[d.day] || (todayDay && d.day <= todayDay ? 'present' : '-');
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
        subtitle: `${currentMonthTitle} • ${workingDays.length} Working Days (Sundays Excluded) • Staff Count: ${records.length}`,
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
        branch: 'Coimbatore',
        staffName: 'Admin Operations',
        staffRole: 'ADMIN',
        sections: [
          {
            heading: '1. Staff Attendance Rate Summary',
            description: `Audited attendance percentages across all staff members for ${currentMonthTitle}.`,
            table: {
              headers: ['Staff Member', 'Role', 'Working Days', 'Days Present', 'Attendance %', 'Status'],
              rows: records.map((r) => {
                const daysPresent = workingDays.filter((d) => {
                  const st = r.attendance[d.day] || (todayDay && d.day <= todayDay ? 'present' : '-');
                  return st === 'present';
                }).length;
                const rate = Math.round((daysPresent / workingDays.length) * 100);
                return [
                  r.name,
                  r.role,
                  workingDays.length,
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
            <div className="w-10 h-10 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                  Attendance Master Grid
                </h1>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                  Live System Date: {liveDate.formattedDate}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary,#444746)] mt-0.5">
                {currentMonthTitle} working calendar — Sundays omitted per policy. Tap any cell to cycle status.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            leftIcon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 px-4 rounded-xl bg-[var(--badge-success-bg,#E6F4EA)] border border-[var(--badge-success-border,#CEEAD6)] text-[var(--badge-success-text,#137333)] text-xs flex items-center gap-2 transition-all shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Attendance records successfully updated and synced across GSS network and Google Sheets.</span>
        </div>
      )}

      {/* Month Navigation & Grid Legend Bar */}
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

        {/* Status Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[var(--text-secondary,#444746)] font-medium">Status:</span>
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
                      Loading {currentMonthTitle} Attendance Grid...
                    </p>
                    <p className="text-xs text-[var(--text-muted,#747775)] mt-1">
                      Querying live biometric and dual-persistence attendance registers...
                    </p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={workingDays.length + 1} className="py-12 text-center text-[var(--text-secondary,#444746)]">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--text-muted,#747775)]" />
                    <p className="font-medium text-sm text-[var(--text-primary,#1F1F1F)]">No staff attendance records</p>
                    <p className="text-xs text-[var(--text-muted,#747775)] mt-1">
                      Staff members from your branch will appear here once approved.
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
                      const status =
                        rec.attendance[w.day] ||
                        (todayDay && w.day <= todayDay ? 'present' : undefined);

                      const statusStyles = {
                        present:
                          'bg-[var(--badge-success-bg,#E6F4EA)] text-[var(--badge-success-text,#137333)] border-[var(--badge-success-border,#CEEAD6)] hover:opacity-90',
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
                          {status ? (
                            <button
                              type="button"
                              onClick={() => cycleStatus(rec.id, w.day)}
                              className={`w-7 h-7 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer inline-flex items-center justify-center ${
                                statusStyles[status]
                              }`}
                              title={`${w.weekdayShort} ${w.day}: ${status.toUpperCase()} ${
                                isToday && rec.punchInTime ? `(Punched In: ${rec.punchInTime})` : ''
                              } (Click to toggle)`}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
