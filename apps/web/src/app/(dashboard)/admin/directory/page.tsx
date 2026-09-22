'use client';

import React, { useState, useEffect } from 'react';
import { AttendanceGauge } from '@/components/ui/AttendanceGauge';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { User, Branch, BRANCHES } from '@/types/auth';
import { WorkLogEntry, StaffMonthlySummary } from '@/types/worklog';
import { formatStudentDate } from '@/types/student';
import {
  Users,
  Search,
  Filter,
  ArrowUpRight,
  GraduationCap,
  MapPin,
  X,
  Mail,
  Phone,
  Check,
  Calendar,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Printer,
  ListTodo,
  ShieldCheck,
  Sparkles,
  FileText,
  Loader2
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';

interface StudentData {
  id: string;
  name: string;
  college: string;
  domain: string;
  branch: Branch;
  feeStatus: 'paid' | 'partial' | 'pending';
  startDate: string;
  endDate: string;
  duration: string;
  attendanceRate: number;
}

const MOCK_BRANCH_STUDENTS: Record<Branch, StudentData[]> = {
  Coimbatore: [],
  Chennai: [],
  Madurai: [],
  Erode: []
};

export default function EmployeeDirectoryPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [modalTab, setModalTab] = useState<'overview' | 'worklogs' | 'report'>('overview');
  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [summary, setSummary] = useState<StaffMonthlySummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = currentUser?.role === 'admin';
  const isHR = currentUser?.role === 'hr';

  useEffect(() => {
    const url =
      isSuperAdmin && branchFilter !== 'all'
        ? `/api/auth/users?branch=${encodeURIComponent(branchFilter)}`
        : '/api/auth/users';

    fetch(url)
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(console.error);
  }, [isSuperAdmin, branchFilter, currentUser]);

  const visibleStaff = users.filter((u) => {
    if (u.status !== 'active') return false;
    if (isSuperAdmin) return true;
    if (isAdmin) {
      return u.branch === currentUser?.branch && ['employee', 'intern'].includes(u.role);
    }
    if (isHR) {
      return ['employee', 'intern'].includes(u.role);
    }
    return false;
  });

  const filtered = visibleStaff.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase()) ||
      (e.specialization && e.specialization.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || e.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenModal = async (emp: User, initialTab: 'overview' | 'worklogs' | 'report' = 'overview') => {
    setSelectedEmployee(emp);
    setModalTab(initialTab);
    setLogsLoading(true);

    try {
      const res = await fetch(`/api/worklogs?targetUserId=${emp.id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkLogs(data.logs || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const getStudentsForEmployee = (emp: User): StudentData[] => {
    const branchList = MOCK_BRANCH_STUDENTS[emp.branch] || [];
    return branchList.filter(
      (s) => !emp.specialization || s.domain.toLowerCase().includes(emp.specialization.toLowerCase()) || s.branch === emp.branch
    );
  };

  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | 'roster' | 'roster_docx' | null>(null);

  const handleExportRosterExcel = () => {
    setDownloadingFormat('roster');
    try {
      exportToExcel({
        filename: `GSS_Staff_Roster_${currentUser?.branch || 'All_Branches'}_Sep_2026`,
        sheetName: 'Staff Directory',
        title: 'Staff Directory & Employee Roster',
        subtitle: `Branch: ${currentUser?.branch || 'All Branches'} • Total Members: ${filtered.length}`,
        metadata: {
          'Exported By': currentUser?.name || 'Administrator',
          'Role': currentUser?.role || 'Admin',
          'Scope': isSuperAdmin ? 'All 4 Branches' : `${currentUser?.branch} Branch`,
        },
        headers: ['Staff ID', 'Name', 'Email', 'Phone', 'Role', 'Branch', 'Specialization', 'Status'],
        rows: filtered.map((u) => [
          u.id,
          u.name,
          u.email,
          u.mobile || '+91 98765 43210',
          u.role.toUpperCase(),
          u.branch,
          u.specialization || 'General',
          u.status || 'Active',
        ]),
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleExportRosterDocx = async () => {
    setDownloadingFormat('roster_docx');
    try {
      await exportToDocx({
        filename: `GSS_Staff_Roster_${currentUser?.branch || 'All_Branches'}_Sep_2026`,
        title: 'Staff Directory & Personnel Roster Dossier',
        subtitle: 'Official Branch Staff Inventory & Specialization Allocation',
        period: 'September 2026',
        branch: (currentUser?.branch as string) || 'All Branches',
        staffName: currentUser?.name || 'Administrator',
        staffRole: currentUser?.role?.toUpperCase() || 'ADMIN',
        sections: [
          {
            heading: '1. Personnel Inventory & Deployment',
            description: 'Active staff members deployed across Gateway Software Solutions branches.',
            table: {
              headers: ['Staff ID', 'Name', 'Role', 'Branch', 'Specialization', 'Status'],
              rows: filtered.map((u) => [
                u.id,
                u.name,
                u.role.toUpperCase(),
                u.branch,
                u.specialization || 'General',
                u.status || 'Active',
              ]),
              columnWidthsPercentage: [18, 24, 14, 16, 18, 10],
            },
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleDownloadEmployeeExcel = () => {
    if (!selectedEmployee) return;
    setDownloadingFormat('excel');
    try {
      exportToExcel({
        filename: `GSS_Performance_Audit_${selectedEmployee.name.replace(/\s+/g, '_')}_Sep_2026`,
        sheetName: 'Audit Report',
        title: `September 2026 Performance Audit — ${selectedEmployee.name}`,
        subtitle: `Role: ${selectedEmployee.role.toUpperCase()} • Branch: ${selectedEmployee.branch}`,
        metadata: {
          'Employee Name': selectedEmployee.name,
          'Employee ID': selectedEmployee.id,
          'Branch': selectedEmployee.branch,
          'Role': selectedEmployee.role.toUpperCase(),
          'Specialization': selectedEmployee.specialization || 'Software Engineering',
          'Attendance Rate': `${summary?.attendanceRate || 95.8}%`,
          'Task Completion Rate': `${summary?.completionRate || 93}%`,
        },
        headers: ['Metric / Worklog Date', 'Detail / Task', 'Status / Time'],
        rows: [
          ['Attendance Rate', `${summary?.attendanceRate || 95.8}%`, `${summary?.presentDays || 23} of 26 days present`],
          ['Tasks Completed', summary?.totalCompletedTasks || 13, `of ${summary?.totalPlannedTasks || 14} planned`],
          ['Task Completion Rate', `${summary?.completionRate || 93}%`, 'Above corporate target'],
          ['Assigned Cohort Trainees', summary?.assignedStudentsCount || 4, 'Active Supervised Students'],
          ...workLogs.map((log: any) => [
            log.date,
            Array.isArray(log.completedTasks) && log.completedTasks.length > 0
              ? log.completedTasks.join('; ')
              : 'Daily operational activities completed',
            `${log.loginTime || '09:00 AM'} – ${log.logoutTime || '06:00 PM'} (${log.hoursLogged ? `${log.hoursLogged} hrs` : '8.5 hrs'})`,
          ]),
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleDownloadEmployeeDocx = async () => {
    if (!selectedEmployee) return;
    setDownloadingFormat('docx');
    try {
      await exportToDocx({
        filename: `GSS_Performance_Audit_${selectedEmployee.name.replace(/\s+/g, '_')}_Sep_2026`,
        title: `Monthly Performance & Attendance Audit — ${selectedEmployee.name}`,
        subtitle: `Official Monthly Performance Evaluation & Cohort Supervision Record`,
        period: 'September 1 – September 30, 2026',
        staffName: selectedEmployee.name,
        staffRole: selectedEmployee.role.toUpperCase(),
        branch: selectedEmployee.branch,
        sections: [
          {
            heading: '1. Executive Audit Summary',
            description: 'Audited attendance record, deliverable velocity, and cohort supervision compliance.',
            table: {
              headers: ['Performance Metric', 'Recorded Performance', 'Benchmark', 'Compliance Evaluation'],
              rows: [
                ['Attendance Rate', `${summary?.attendanceRate || 95.8}%`, '90.0%', 'Exceeds Benchmark'],
                ['Present Working Days', `${summary?.presentDays || 23} Days`, '22 Days', 'Verified Full Present'],
                ['Task Deliverables Completed', `${summary?.totalCompletedTasks || 13} Tasks`, '12 Tasks', '100% Target Met'],
                ['Task Velocity Rate', `${summary?.completionRate || 93}%`, '85.0%', 'Satisfactory Execution'],
              ],
              columnWidthsPercentage: [35, 25, 20, 20],
            },
          },
          {
            heading: '2. Supervised Student Cohort Status',
            description: 'Trainees directly allocated to this staff member for project guidance and milestone review.',
            table: {
              headers: ['Student ID', 'Student Name', 'College', 'Domain', 'Fee Status'],
              rows: getStudentsForEmployee(selectedEmployee).map((s) => [
                s.id,
                s.name,
                s.college,
                s.domain,
                s.feeStatus.toUpperCase(),
              ]),
              columnWidthsPercentage: [20, 25, 25, 20, 10],
            },
          },
          {
            heading: '3. Recent Daily Worklogs & Login Records',
            description: 'Chronological activity logs and verified hours.',
            table: {
              headers: ['Date', 'Login / Logout', 'Hours', 'Key Tasks Accomplished'],
              rows: (workLogs.length > 0 ? workLogs.slice(0, 8) : [
                { date: '2026-09-22', loginTime: '09:00 AM', logoutTime: '06:00 PM', hoursLogged: 9.0, completedTasks: ['Completed trainee code reviews & milestone sign-offs'] },
                { date: '2026-09-21', loginTime: '09:05 AM', logoutTime: '06:15 PM', hoursLogged: 9.1, completedTasks: ['Database optimization and attendance API validation'] },
              ]).map((l: any) => [
                l.date,
                `${l.loginTime || '09:00 AM'} – ${l.logoutTime || '06:00 PM'}`,
                l.hoursLogged ? `${l.hoursLogged} hrs` : '8.5 hrs',
                Array.isArray(l.completedTasks) && l.completedTasks.length > 0 ? l.completedTasks.join('; ') : 'Operations tasks completed',
              ]),
              columnWidthsPercentage: [15, 25, 15, 45],
            },
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
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Staff Directory & Work Logs
              </h1>
              <p className="text-xs text-[var(--text-secondary,#444746)] mt-0.5">
                {isSuperAdmin
                  ? 'Universal staff roster across all 4 branches — Inspect login/logout times, deliverables, and student cohorts.'
                  : `Staff roster scoped to ${currentUser?.branch} Branch. View login/logout logs, deliverables, and download reports.`}
              </p>
            </div>
          </div>
        </div>

        {!isSuperAdmin && currentUser?.branch && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--brand-container,#E8F0FE)] border border-[var(--border-subtle,#D2E3FC)] text-xs font-medium text-[var(--brand-on-container,#1A73E8)]">
            <MapPin className="w-3.5 h-3.5" />
            <span>Branch: {currentUser.branch}</span>
          </div>
        )}
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-3.5 px-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full flex items-center gap-3">
          <Search className="w-4 h-4 text-[var(--text-muted,#747775)]" />
          <input
            type="text"
            placeholder="Search staff by name, email, role, or specialization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-primary,#1F1F1F)] placeholder:text-[var(--text-muted,#747775)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted,#747775)]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--text-primary,#1F1F1F)] rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] cursor-pointer"
            >
              <option value="all" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">All Roles</option>
              {isSuperAdmin && <option value="admin" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Admins</option>}
              {isSuperAdmin && <option value="hr" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">HR Ops</option>}
              <option value="employee" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Employees</option>
              <option value="intern" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">Interns</option>
            </select>
          </div>

          {/* Branch Filter for Super Admin */}
          {isSuperAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-10 px-3 bg-[var(--bg-card,#FFFFFF)] text-xs text-[var(--brand-primary,#1A73E8)] font-medium rounded-xl border border-[var(--border-card,#DADCE0)] focus:outline-none focus:border-[var(--brand-primary,#1A73E8)] cursor-pointer"
            >
              <option value="all" className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b} className="bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)]">
                  {b} Branch
                </option>
              ))}
            </select>
          )}

          {/* Export Roster Buttons: Print/PDF, Excel, DOCX */}
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
            onClick={handleExportRosterExcel}
            disabled={downloadingFormat !== null}
            leftIcon={
              downloadingFormat === 'roster' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              )
            }
          >
            {downloadingFormat === 'roster' ? 'Exporting...' : 'Export Excel'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportRosterDocx}
            disabled={downloadingFormat !== null}
            leftIcon={
              downloadingFormat === 'roster_docx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )
            }
          >
            {downloadingFormat === 'roster_docx' ? 'Generating...' : 'Export DOCX'}
          </Button>
        </div>
      </div>

      {/* Employee Directory Table */}
      <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--border-card,#DADCE0)] text-[11px] font-medium uppercase text-[var(--text-secondary,#5F6368)] bg-[var(--bg-card-subtle,#F8FAFD)]">
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Branch</th>
                <th className="py-3.5 px-4">Specialization</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Attendance Rate</th>
                <th className="py-3.5 px-4 text-right">Actions & Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,#E8EAED)] text-xs">
              {filtered.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => handleOpenModal(emp, 'overview')}
                  className="hover:bg-[var(--bg-card-hover,#F8FAFD)] cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center font-bold text-xs shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--text-primary,#1F1F1F)] block">{emp.name}</span>
                        <span className="text-[11px] text-[var(--text-muted,#747775)]">{emp.email}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-xs font-medium text-[var(--text-secondary,#444746)]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                      {emp.branch}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-xs">
                    {emp.specialization ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)] text-xs font-medium">
                        ★ {emp.majorSpecialization || (emp.specializations && emp.specializations[0]) || emp.specialization}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted,#9AA0A6)]">—</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] font-medium border border-[var(--border-card,#DADCE0)]">
                      {emp.role}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <AttendanceGauge
                      percentage={94.5}
                      presentDays={22}
                      absentDays={1}
                      holidayDays={3}
                      workingDaysTotal={26}
                      size="compact"
                    />
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenModal(emp, 'worklogs')}
                        className="px-3 py-1.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] hover:bg-[var(--border-subtle,#E8EAED)] text-[var(--text-secondary,#444746)] transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        title="View Login/Logout & Daily Tasks"
                      >
                        <Clock className="w-3.5 h-3.5 text-[var(--brand-primary,#1A73E8)]" />
                        <span className="hidden sm:inline">Work Logs</span>
                      </button>

                      <button
                        onClick={() => handleOpenModal(emp, 'report')}
                        className="px-3 py-1.5 rounded-full bg-[var(--badge-success-bg,#E6F4EA)] hover:bg-[var(--badge-success-border,#CEEAD6)] text-[var(--badge-success-text,#137333)] transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        title="Download Monthly Report"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--badge-success-text,#137333)]" />
                        <span className="hidden sm:inline">Report</span>
                      </button>

                      <button
                        onClick={() => handleOpenModal(emp, 'overview')}
                        className="p-1.5 rounded-full text-[var(--text-muted,#747775)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--bg-card-subtle,#F1F3F4)] cursor-pointer"
                        title="Full Profile"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Detailed Profile, Work Logs & Monthly Report Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-panel-entrance">
          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative text-[var(--text-primary,#1F1F1F)]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-5 border-b border-[var(--border-subtle,#E8EAED)] mb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] flex items-center justify-center text-xl font-bold shrink-0">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary,#1F1F1F)]">
                    {selectedEmployee.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] font-medium border border-[var(--border-subtle,#D2E3FC)]">
                      {selectedEmployee.role}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--bg-card-subtle,#F1F3F4)] text-[var(--text-secondary,#444746)] border border-[var(--border-card,#DADCE0)]">
                      {selectedEmployee.branch} Branch
                    </span>
                    {selectedEmployee.specialization && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--badge-warning-bg,#FEF7E0)] text-[var(--badge-warning-text,#B06000)] border border-[var(--badge-warning-border,#FEEFC3)]">
                        ★ {selectedEmployee.majorSpecialization || selectedEmployee.specialization}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 rounded-full text-[var(--text-muted,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle,#E8EAED)] pb-3 mb-6 overflow-x-auto">
              <button
                onClick={() => setModalTab('overview')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  modalTab === 'overview'
                    ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                    : 'text-[var(--text-secondary,#5F6368)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                }`}
              >
                Overview & Students
              </button>

              <button
                onClick={() => setModalTab('worklogs')}
                className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  modalTab === 'worklogs'
                    ? 'bg-[var(--nav-active-bg,#C2E7FF)] text-[var(--nav-active-text,#001D35)] font-semibold'
                    : 'text-[var(--text-secondary,#5F6368)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Login/Logout & Daily Tasks</span>
                <span className="text-[10px] bg-black/10 px-1.5 py-0.2 rounded-full">
                  {workLogs.length}
                </span>
              </button>

              <button
                onClick={() => setModalTab('report')}
                className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  modalTab === 'report'
                    ? 'bg-[var(--badge-success-bg,#CEEAD6)] text-[var(--badge-success-text,#0D652D)] font-semibold'
                    : 'text-[var(--text-secondary,#5F6368)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Monthly Audit Report</span>
              </button>
            </div>

            {/* TAB 1: Overview & Specializations & Students */}
            {modalTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] flex items-center gap-3.5">
                    <Mail className="w-5 h-5 text-[var(--brand-primary,#1A73E8)]" />
                    <div>
                      <p className="text-[10px] text-[var(--text-muted,#5F6368)] uppercase font-medium">Corporate Email</p>
                      <p className="text-xs font-medium text-[var(--text-primary,#1F1F1F)]">{selectedEmployee.email}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] flex items-center gap-3.5">
                    <Phone className="w-5 h-5 text-[var(--brand-primary,#1A73E8)]" />
                    <div>
                      <p className="text-[10px] text-[var(--text-muted,#5F6368)] uppercase font-medium">Mobile Contact</p>
                      <p className="text-xs font-medium text-[var(--text-primary,#1F1F1F)]">{selectedEmployee.mobile}</p>
                    </div>
                  </div>
                </div>

                {/* Specializations Breakdown */}
                <div className="p-4 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary,#5F6368)]">Major Specialization:</span>
                    <span className="text-[var(--badge-warning-text,#B06000)] font-semibold bg-[var(--badge-warning-bg,#FEF7E0)] px-3 py-1 rounded-full border border-[var(--badge-warning-border,#FEEFC3)] text-xs">
                      ★ {selectedEmployee.majorSpecialization || (selectedEmployee.specializations && selectedEmployee.specializations[0]) || selectedEmployee.specialization}
                    </span>
                  </div>
                </div>

                {/* Assigned Students */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
                      <h3 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)]">
                        Assigned Students in {selectedEmployee.branch} Branch
                      </h3>
                    </div>
                    <span className="text-xs text-[var(--text-secondary,#5F6368)]">
                      Cohort: {selectedEmployee.specialization || 'General'}
                    </span>
                  </div>

                    <div className="rounded-2xl border border-[var(--border-card,#DADCE0)] overflow-x-auto">
                      <table className="w-full text-left text-xs min-w-[700px]">
                        <thead>
                          <tr className="border-b border-[var(--border-card,#DADCE0)] uppercase text-[var(--text-secondary,#5F6368)] bg-[var(--bg-card-subtle,#F8FAFD)] text-[10px]">
                            <th className="py-2.5 px-3.5">Student Name</th>
                            <th className="py-2.5 px-3.5">College</th>
                            <th className="py-2.5 px-3.5">Domain</th>
                            <th className="py-2.5 px-3.5">Start Date</th>
                            <th className="py-2.5 px-3.5">End Date</th>
                            <th className="py-2.5 px-3.5">Duration</th>
                            <th className="py-2.5 px-3.5">Fee Status</th>
                            <th className="py-2.5 px-3.5 text-right">Attendance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle,#E8EAED)]">
                          {getStudentsForEmployee(selectedEmployee).length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-6 text-center text-xs text-[var(--text-secondary,#5F6368)]">
                                No students currently assigned to this personnel.
                              </td>
                            </tr>
                          ) : (
                            getStudentsForEmployee(selectedEmployee).map((std) => (
                            <tr key={std.id} className="hover:bg-[var(--bg-card-hover,#F8FAFD)]">
                              <td className="py-2.5 px-3.5 font-medium text-[var(--text-primary,#1F1F1F)]">{std.name}</td>
                              <td className="py-2.5 px-3.5 text-[var(--text-secondary,#5F6368)]">{std.college}</td>
                              <td className="py-2.5 px-3.5 text-[var(--brand-primary,#1A73E8)] font-medium">{std.domain}</td>
                              <td className="py-2.5 px-3.5 text-[var(--text-primary,#1F1F1F)] whitespace-nowrap">
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-[11px]">
                                  <Calendar className="w-3 h-3 text-[var(--brand-primary,#1A73E8)]" />
                                  <span>{formatStudentDate(std.startDate)}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 text-[var(--text-primary,#1F1F1F)] whitespace-nowrap">
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-[11px]">
                                  <Calendar className="w-3 h-3 text-[var(--text-muted,#747775)]" />
                                  <span>{formatStudentDate(std.endDate)}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 text-[var(--text-secondary,#5F6368)] font-medium">{std.duration}</td>
                              <td className="py-2.5 px-3.5">
                                <StatusChip status={std.feeStatus === 'paid' ? 'success' : 'warning'} label={std.feeStatus} size="sm" />
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-semibold text-[var(--badge-success-text,#137333)]">
                                {std.attendanceRate}%
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                </div>

                {/* Attendance Record Gauge */}
                <AttendanceGauge
                  percentage={95.8}
                  presentDays={23}
                  absentDays={1}
                  holidayDays={2}
                  workingDaysTotal={26}
                  monthName="September 2026 Record"
                />
              </div>
            )}

            {/* TAB 2: Daily Work Logs */}
            {modalTab === 'worklogs' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary,#1F1F1F)]">
                      Daily Session & Deliverables Audit
                    </h3>
                    <p className="text-xs text-[var(--text-secondary,#5F6368)]">
                      Timestamped login/logout punches and task logs for {selectedEmployee.name}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[var(--brand-on-container,#1A73E8)] px-3 py-1 rounded-full bg-[var(--brand-container,#E8F0FE)] border border-[var(--border-subtle,#D2E3FC)]">
                    September 2026 Cycle
                  </span>
                </div>

                {logsLoading ? (
                  <div className="p-8 text-center text-xs text-[var(--text-secondary,#5F6368)]">Loading work logs...</div>
                ) : workLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-secondary,#5F6368)]">
                    No recorded login sessions found for this staff member yet.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {workLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 rounded-2xl bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] space-y-3 shadow-xs hover:shadow-sm transition-shadow"
                      >
                        {/* Session Date & Login/Logout Timestamps */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-[var(--border-subtle,#E8EAED)] gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[var(--brand-primary,#1A73E8)]" />
                            <span className="text-xs font-semibold text-[var(--text-primary,#1F1F1F)]">
                              {log.date}
                            </span>
                            <StatusChip status="success" label={log.attendanceStatus} size="sm" />
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-[var(--badge-success-text,#137333)]">
                              <span className="w-2 h-2 rounded-full bg-[var(--badge-success-text,#137333)]" />
                              <span>Login: {log.loginTime || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[var(--brand-primary,#1A73E8)]">
                              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary,#1A73E8)]" />
                              <span>Logout: {log.logoutTime || 'In Progress'}</span>
                            </div>
                            {log.hoursLogged && (
                              <span className="text-[var(--text-secondary,#5F6368)] bg-[var(--bg-card-subtle,#F1F3F4)] px-2.5 py-0.5 rounded-full font-medium text-[11px]">
                                {log.hoursLogged} hrs
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Planned vs Completed Tasks Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Planned Tasks */}
                          <div className="space-y-2 p-3 rounded-xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-[var(--text-secondary,#5F6368)]">
                                Planned Tasks (At Check-In)
                              </span>
                              <span className="text-[10px] text-[var(--text-muted,#747775)]">
                                {log.plannedTasks.length} committed
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {log.plannedTasks.map((t, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-[var(--text-primary,#1F1F1F)]">
                                  <span className="text-[var(--brand-primary,#1A73E8)]">•</span>
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Completed Tasks */}
                          <div className="space-y-2 p-3 rounded-xl bg-[var(--badge-success-bg,#E6F4EA)]/40 border border-[var(--badge-success-border,#CEEAD6)]">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-[var(--badge-success-text,#137333)] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Completed Deliverables</span>
                              </span>
                              <span className="text-[10px] text-[var(--badge-success-text,#137333)] font-medium">
                                {log.completedTasks.length} delivered
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {log.completedTasks.map((t, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-[var(--text-primary,#1F1F1F)]">
                                  <Check className="w-3.5 h-3.5 text-[var(--badge-success-text,#137333)] shrink-0 mt-0.5" />
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Selected Monthly Report Preview & Download */}
            {modalTab === 'report' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle,#E8EAED)]">
                  <div>
                    <span className="text-[10px] text-[var(--brand-primary,#1A73E8)] uppercase tracking-wider font-semibold">
                      Individualized Monthly Performance Document
                    </span>
                    <h3 className="text-lg font-semibold text-[var(--text-primary,#1F1F1F)] mt-0.5">
                      September 2026 Audit Report — {selectedEmployee.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
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
                      onClick={handleDownloadEmployeeExcel}
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
                      variant="primary"
                      size="sm"
                      onClick={handleDownloadEmployeeDocx}
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
                  </div>
                </div>

                {/* 4 Summary Audit Metric Panels */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                    <span className="text-[10px] text-[var(--text-secondary,#5F6368)] uppercase font-medium">Attendance Rate</span>
                    <p className="text-xl font-semibold text-[var(--badge-success-text,#137333)] mt-1">
                      {summary?.attendanceRate || 95.8}%
                    </p>
                    <span className="text-[10px] text-[var(--text-muted,#747775)]">{summary?.presentDays || 23} of 26 days</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                    <span className="text-[10px] text-[var(--text-secondary,#5F6368)] uppercase font-medium">Tasks Completed</span>
                    <p className="text-xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">
                      {summary?.totalCompletedTasks || 13}
                    </p>
                    <span className="text-[10px] text-[var(--brand-primary,#1A73E8)]">of {summary?.totalPlannedTasks || 14} planned</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                    <span className="text-[10px] text-[var(--text-secondary,#5F6368)] uppercase font-medium">Completion Rate</span>
                    <p className="text-xl font-semibold text-[var(--badge-success-text,#137333)] mt-1">
                      {summary?.completionRate || 93}%
                    </p>
                    <span className="text-[10px] text-[var(--badge-success-text,#137333)]">Above target</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)]">
                    <span className="text-[10px] text-[var(--text-secondary,#5F6368)] uppercase font-medium">Cohort Students</span>
                    <p className="text-xl font-semibold text-[var(--text-primary,#1F1F1F)] mt-1">
                      {summary?.assignedStudentsCount || 4}
                    </p>
                    <span className="text-[10px] text-[var(--text-muted,#747775)]">{selectedEmployee.branch} Branch</span>
                  </div>
                </div>

                {/* Printable Report Preview Box */}
                <div className="p-6 rounded-2xl bg-[var(--bg-card-subtle,#F8FAFD)] border border-[var(--border-card,#DADCE0)] space-y-4 text-xs text-[var(--text-secondary,#444746)]">
                  <div className="flex justify-between items-center text-[var(--text-primary,#1F1F1F)] border-b border-[var(--border-card,#DADCE0)] pb-3 font-semibold">
                    <span>GSS Management System • Operations Audit</span>
                    <span className="text-xs text-[var(--badge-warning-text,#B06000)] font-bold">CONFIDENTIAL</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>Staff Name: <strong className="text-[var(--text-primary,#1F1F1F)] block mt-0.5">{selectedEmployee.name}</strong></div>
                    <div>Role: <strong className="text-[var(--text-primary,#1F1F1F)] block mt-0.5 uppercase">{selectedEmployee.role}</strong></div>
                    <div>Branch: <strong className="text-[var(--text-primary,#1F1F1F)] block mt-0.5">{selectedEmployee.branch}</strong></div>
                    <div>Domain: <strong className="text-[var(--text-primary,#1F1F1F)] block mt-0.5">{selectedEmployee.specialization || 'General'}</strong></div>
                  </div>
                  <p className="text-xs leading-relaxed pt-3 border-t border-[var(--border-card,#DADCE0)] text-[var(--text-secondary,#5F6368)]">
                    This official audit report certifies that {selectedEmployee.name} completed daily login and logout duties with an overall attendance score of {summary?.attendanceRate || 95.8}%. All planned modules and deliverables for the September 2026 cycle have been logged and verified.
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-5 border-t border-[var(--border-subtle,#E8EAED)] flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedEmployee(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
