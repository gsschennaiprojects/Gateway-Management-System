'use client';

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { Branch, BRANCHES, DEFAULT_DOMAINS } from '@/types/auth';
import { BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';
import {
  Student,
  INITIAL_STUDENTS_DATA,
  calculateDuration,
  formatStudentDate,
  calculateTenureProgress
} from '@/types/student';
import {
  getWorkingDaysForMonth,
  formatHumanReadableDate,
  isDateBefore,
  isDateAfter,
  getStudentDateEnrollmentState,
  type StudentTrackerItem,
  type AttendanceTrackerData,
} from '@/lib/sheets/sheets-config';
import { getLiveDateInfo } from '@/lib/worklogs/worklog-session-utils';
import {
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Search,
  Filter,
  Download,
  Save,
  Check,
  X,
  Edit2,
  Calendar,
  Sparkles,
  TrendingUp,
  Award,
  BookOpen,
  User,
  ChevronRight,
  ExternalLink,
  Printer,
  FileText,
  FileSpreadsheet,
  ListTodo,
  Layers,
  ArrowUpRight,
  RotateCw,
  Loader2,
  Table as TableIcon,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  ArrowRight,
  Users,
} from 'lucide-react';
import { exportToExcel, exportToDocx } from '@/lib/export-utils';
import { clientSwrCache } from '@/lib/cache/client-swr-cache';

function getBadgeStyle(val: string): string {
  switch (val) {
    case 'Present':
    case 'Completed':
      return 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]';
    case 'Absent':
    case 'Not Completed':
      return 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]';
    case 'Holiday':
    case 'On Leave':
      return 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3]';
    case 'In Progress':
      return 'bg-[#E8F0FE] text-[#1A73E8] border-[#D2E3FC]';
    case 'Not Joined':
      return 'bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]';
    default:
      return 'bg-white text-slate-700 border-slate-200';
  }
}

function StudentManagementContent() {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active navigation tab
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'directory' | 'tracker' | 'individual' | 'analytics'>(
    tabParam === 'tracker' ? 'tracker' : tabParam === 'timeline' || tabParam === 'individual' ? 'individual' : 'directory'
  );

  useEffect(() => {
    if (tabParam === 'tracker') setActiveTab('tracker');
    else if (tabParam === 'timeline' || tabParam === 'individual') setActiveTab('individual');
    else if (tabParam === 'directory') setActiveTab('directory');
  }, [tabParam]);

  const handleTabChange = (newTab: 'directory' | 'tracker' | 'individual' | 'analytics') => {
    setActiveTab(newTab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', newTab);
    router.replace(`/students?${params.toString()}`);
  };

  const staffId = currentUser?.id || 'CBE_ADM01';
  const branchCode = currentUser?.branch
    ? BRANCH_NAME_TO_CODE[currentUser.branch] || currentUser.branch
    : 'CBE';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DIRECTORY STATE & FETCH (06_Student_Directory)
  // ─────────────────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS_DATA);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [directorySource, setDirectorySource] = useState<'sheets' | 'local'>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [feeFilter, setFeeFilter] = useState<string>('all');

  const fetchBranchStudentDirectory = useCallback(async () => {
    const cacheKey = `client:dir:${branchCode}`;
    const cached = clientSwrCache.get<Student[]>(cacheKey);
    if (cached && cached.length > 0) {
      setStudents(cached);
      setDirectorySource('sheets');
    }

    try {
      if (!cached) setLoadingDirectory(true);
      const res = await fetch(`/api/sheets?type=branch_student_directory&branchCode=${branchCode}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const mapped: Student[] = data.data.map((r: any) => {
          const durationStr = calculateDuration(r.admissionDate, r.endDate) || '3 Months';
          return {
            id: r.studentId,
            name: r.studentName,
            avatarUrl: undefined,
            email: r.email || `${r.studentId.toLowerCase()}@student.guvi.in`,
            mobile: r.mobile || '+91 98765 43210',
            college: r.college || 'Engineering College',
            domain: r.domain || 'Full Stack Web (MERN)',
            branch: (currentUser?.branch as Branch) || 'Coimbatore',
            mentorName: r.mentorName || 'Assigned Staff',
            mentorRole: r.mentorStaffId ? `Mentor (${r.mentorStaffId})` : 'Staff Mentor',
            feeStatus: (r.feeStatus?.toLowerCase() === 'paid' ? 'paid' : r.feeStatus?.toLowerCase() === 'partial' ? 'partial' : 'pending'),
            startDate: r.admissionDate,
            endDate: r.endDate,
            duration: durationStr,
            projectTitle: `${r.domain} Capstone Milestone`,
            projectCompleted: r.projectStatus === 'Completed',
            todayStatus: 'present',
            yesterdayTaskDone: true,
            dailyAttendance: { 1: 'present', 2: 'present', 3: 'present', 4: 'present', 5: 'present' },
            dailyTasks: {
              1: { title: 'Project kick-off & requirements setup', completed: true },
              2: { title: 'Architecture design and schema modeling', completed: true },
            },
          };
        });
        setStudents(mapped);
        setDirectorySource('sheets');
        clientSwrCache.set(cacheKey, mapped, 120);
      }
    } catch (e) {
      console.error('Failed to load branch student directory from sheets:', e);
    } finally {
      setLoadingDirectory(false);
    }
  }, [branchCode, currentUser?.branch]);

  useEffect(() => {
    fetchBranchStudentDirectory();
  }, [fetchBranchStudentDirectory]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ATTENDANCE & TASK TRACKER STATE (ATT_{staffId})
  // ─────────────────────────────────────────────────────────────────────────────
  const liveMonthDefault = useMemo(() => {
    const ld = getLiveDateInfo();
    return `${ld.year}-${String(ld.month).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(liveMonthDefault);
  const [trackerData, setTrackerData] = useState<AttendanceTrackerData | null>(null);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerSaving, setTrackerSaving] = useState(false);
  const [trackerSuccess, setTrackerSuccess] = useState(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [selectedStudentIdx, setSelectedStudentIdx] = useState<number>(0);

  const currentWorkingDays = useMemo(() => {
    if (trackerData?.workingDays && trackerData.workingDays.length > 0) {
      return trackerData.workingDays;
    }
    // Dynamically compute working days for the selected month
    const parts = selectedMonth.split('-');
    if (parts.length === 2) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10);
      if (!isNaN(yr) && !isNaN(mo)) return getWorkingDaysForMonth(yr, mo);
    }
    const ld = getLiveDateInfo();
    return getWorkingDaysForMonth(ld.year, ld.month);
  }, [trackerData?.workingDays, selectedMonth]);

  const fetchTracker = useCallback(async (monthToFetch?: string) => {
    if (!staffId || !branchCode) return;
    const targetMonth = monthToFetch || selectedMonth;
    const cacheKey = `client:tracker:${branchCode}:${staffId}:${targetMonth}`;
    const cached = clientSwrCache.get<AttendanceTrackerData>(cacheKey);
    if (cached) {
      setTrackerData(cached);
      if (cached.monthKey) setSelectedMonth(cached.monthKey);
    }

    if (!cached) setTrackerLoading(true);
    setTrackerError(null);
    try {
      const res = await fetch(`/api/sheets?type=attendance_tracker&staffId=${staffId}&branchCode=${branchCode}&month=${targetMonth}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTrackerData(data.data);
        if (data.data.monthKey) setSelectedMonth(data.data.monthKey);
        clientSwrCache.set(cacheKey, data.data, 120);
      } else {
        setTrackerError(data.error || 'Could not load attendance tracker');
      }
    } catch {
      setTrackerError('Failed to fetch attendance tracker matrix.');
    } finally {
      setTrackerLoading(false);
    }
  }, [staffId, branchCode, selectedMonth]);

  useEffect(() => {
    fetchTracker();
  }, [fetchTracker]);

  const handleMonthChange = (monthKey: string) => {
    setSelectedMonth(monthKey);
    fetchTracker(monthKey);
  };

  const handleRolloverNextMonth = async () => {
    if (!staffId || !branchCode) return;
    setTrackerSaving(true);
    try {
      // Compute next month dynamically from the currently selected month
      const parts = selectedMonth.split('-');
      const curYear = parseInt(parts[0] || '2026', 10);
      const curMonth = parseInt(parts[1] || '9', 10);
      const nextDate = new Date(curYear, curMonth, 1); // curMonth is 1-indexed, so new Date(y, curMonth, 1) = first day of next month
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth() + 1; // back to 1-indexed
      const nextMonthKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'generate_next_month',
          staffId,
          branchCode,
          data: { year: nextYear, month: nextMonth }
        })
      });
      const resData = await res.json();
      if (resData.success) {
        setSelectedMonth(nextMonthKey);
        await fetchTracker(nextMonthKey);
      } else {
        setTrackerError(resData.error || 'Failed to rollover to next month');
      }
    } catch {
      setTrackerError('Network error while rolling over to next month');
    } finally {
      setTrackerSaving(false);
    }
  };

  const handleAttendanceChange = (studentIndex: number, dayIndex: number, val: string) => {
    if (!trackerData) return;
    const newStudents = [...trackerData.students];
    const s = { ...newStudents[studentIndex] };
    const newAtt = [...s.attendance];
    newAtt[dayIndex] = val;
    s.attendance = newAtt;

    const totalPresent = newAtt.filter(v => v === 'Present').length;
    const totalAbsent = newAtt.filter(v => v === 'Absent').length;
    const eligibleDays = newAtt.filter(v => v && v !== 'Not Joined').length || currentWorkingDays.length;

    s.totalPresent = totalPresent;
    s.totalAbsent = totalAbsent;
    s.eligibleDays = eligibleDays;
    s.attendancePct = (totalPresent + totalAbsent > 0)
      ? `${((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(1)}%`
      : '100%';

    newStudents[studentIndex] = s;
    setTrackerData({ ...trackerData, students: newStudents });
  };

  const handleTaskChange = (studentIndex: number, dayIndex: number, val: string) => {
    if (!trackerData) return;
    const newStudents = [...trackerData.students];
    const s = { ...newStudents[studentIndex] };
    const newTasks = [...s.tasks];
    newTasks[dayIndex] = val;
    s.tasks = newTasks;

    const completedTasks = newTasks.filter(v => v === 'Completed').length;
    const eligibleDays = s.eligibleDays || s.attendance.filter(v => v && v !== 'Not Joined').length || currentWorkingDays.length;

    s.tasksCompleted = completedTasks;
    s.completionPct = eligibleDays > 0 ? `${((completedTasks / eligibleDays) * 100).toFixed(1)}%` : '0%';

    newStudents[studentIndex] = s;
    setTrackerData({ ...trackerData, students: newStudents });
  };

  const handleSyncTracker = async () => {
    if (!trackerData || !staffId || !branchCode) return;
    setTrackerSaving(true);
    setTrackerSuccess(false);
    setTrackerError(null);
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'attendance_tracker',
          staffId,
          branchCode,
          data: trackerData,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setTrackerSuccess(true);
        const cacheKey = `client:tracker:${branchCode}:${staffId}:${selectedMonth}`;
        clientSwrCache.set(cacheKey, trackerData, 120);
        setTimeout(() => setTrackerSuccess(false), 3500);
      } else {
        setTrackerError(resData.error || 'Failed to save tracker to sheets');
      }
    } catch {
      setTrackerError('Network error while saving tracker');
    } finally {
      setTrackerSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. MODALS, EDIT & ADD STUDENT
  // ─────────────────────────────────────────────────────────────────────────────
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    college: '',
    domain: 'Full Stack Web (MERN)',
    branch: 'Coimbatore' as Branch,
    mentorName: currentUser?.name || 'Staff Mentor',
    mentorRole: 'Senior Full Stack Lead',
    feeStatus: 'paid' as 'paid' | 'partial' | 'pending',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    projectTitle: '',
    projectCompleted: false,
  });

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData({
      name: '',
      email: '',
      mobile: '',
      college: '',
      domain: 'Full Stack Web (MERN)',
      branch: (currentUser?.branch as Branch) || 'Coimbatore',
      mentorName: currentUser?.name || 'Staff Mentor',
      mentorRole: 'Senior Full Stack Lead',
      feeStatus: 'paid',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      projectTitle: '',
      projectCompleted: false,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditingStudent(s);
    setFormData({
      name: s.name,
      email: s.email || '',
      mobile: s.mobile || '',
      college: s.college,
      domain: s.domain,
      branch: s.branch,
      mentorName: s.mentorName,
      mentorRole: s.mentorRole,
      feeStatus: s.feeStatus,
      startDate: s.startDate,
      endDate: s.endDate,
      projectTitle: s.projectTitle,
      projectCompleted: s.projectCompleted,
    });
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const duration = calculateDuration(formData.startDate, formData.endDate) || '3 Months';

    if (editingStudent) {
      setStudents((prev) =>
        prev.map((item) =>
          item.id === editingStudent.id
            ? {
                ...item,
                name: formData.name,
                email: formData.email,
                mobile: formData.mobile,
                college: formData.college,
                domain: formData.domain,
                branch: formData.branch,
                mentorName: formData.mentorName,
                mentorRole: formData.mentorRole,
                feeStatus: formData.feeStatus,
                startDate: formData.startDate,
                endDate: formData.endDate,
                duration,
                projectTitle: formData.projectTitle || item.projectTitle,
                projectCompleted: formData.projectCompleted,
              }
            : item
        )
      );
      setEditingStudent(null);
    } else {
      const newId = `std_${Date.now()}`;
      const newStudent: Student = {
        id: newId,
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        college: formData.college,
        domain: formData.domain,
        branch: formData.branch,
        mentorName: formData.mentorName,
        mentorRole: formData.mentorRole,
        feeStatus: formData.feeStatus,
        startDate: formData.startDate,
        endDate: formData.endDate,
        duration,
        projectTitle: formData.projectTitle || `${formData.domain} Capstone Milestone`,
        projectCompleted: formData.projectCompleted,
        todayStatus: 'present',
        yesterdayTaskDone: true,
        dailyAttendance: { 1: 'present', 2: 'present', 3: 'present', 4: 'present', 5: 'present' },
        dailyTasks: {
          1: { title: 'Project kick-off & requirements setup', completed: true },
          2: { title: 'Architecture design and schema modeling', completed: true },
        },
      };
      setStudents([newStudent, ...students]);
      setIsAddModalOpen(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. FILTERED DATA & KPIS
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        s.college.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.mentorName.toLowerCase().includes(q) ||
        (s.projectTitle && s.projectTitle.toLowerCase().includes(q));

      const matchesBranch = branchFilter === 'all' || s.branch === branchFilter;
      const matchesDomain = domainFilter === 'all' || s.domain === domainFilter;
      const matchesFee = feeFilter === 'all' || s.feeStatus === feeFilter;

      return matchesSearch && matchesBranch && matchesDomain && matchesFee;
    });
  }, [students, searchQuery, branchFilter, domainFilter, feeFilter]);

  const kpis = useMemo(() => {
    const total = students.length;
    if (total === 0) {
      return { total: 0, avgAttendance: 0, completedProjects: 0, feeClearedPct: 0 };
    }
    let totalAttendancePct = 0;
    let completedProjects = 0;
    let paidCount = 0;

    students.forEach((s) => {
      const days = Object.keys(s.dailyAttendance).length;
      const presents = Object.values(s.dailyAttendance).filter((status) => status === 'present').length;
      totalAttendancePct += days > 0 ? (presents / days) * 100 : 95;
      if (s.projectCompleted) completedProjects++;
      if (s.feeStatus === 'paid') paidCount++;
    });

    return {
      total,
      avgAttendance: Math.round(totalAttendancePct / total),
      completedProjects,
      feeClearedPct: Math.round((paidCount / total) * 100),
    };
  }, [students]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. EXPORT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────
  const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'docx' | null>(null);

  const handleExportExcel = () => {
    setDownloadingFormat('excel');
    try {
      if (activeTab === 'tracker' && trackerData?.students && trackerData.students.length > 0) {
        exportToExcel({
          filename: `GSS_Attendance_Tracker_${staffId}_${selectedMonth}`,
          sheetName: `ATT_${staffId}`,
          title: `Monthly Trainee Cohort Tracker (ATT_${staffId})`,
          subtitle: `Mentor: ${currentUser?.name} (${staffId}) • Cohort: ${selectedMonth} • Branch: ${currentUser?.branch}`,
          metadata: {
            'Staff Mentor': currentUser?.name || 'Staff Member',
            'Staff ID': staffId,
            'Branch': (currentUser?.branch as string) || 'Coimbatore',
            'Cohort Period': selectedMonth,
            'Working Days Count': `${currentWorkingDays.length} Days`,
          },
          headers: [
            'Student ID',
            'Student Name',
            'Domain',
            'Start Date',
            'End Date',
            'Eligible Days',
            'Total Present',
            'Attendance %',
            'Tasks Completed',
            'Task %',
          ],
          rows: trackerData.students.map((s) => [
            s.studentId,
            s.studentName,
            s.domain,
            s.startDate,
            s.endDate,
            s.eligibleDays,
            s.totalPresent,
            s.attendancePct || '95%',
            s.tasksCompleted || 0,
            s.completionPct || '0%',
          ]),
        });
      } else {
        exportToExcel({
          filename: `GSS_Student_Directory_${branchCode}_${new Date().toISOString().substring(0, 10)}`,
          sheetName: 'Student Directory',
          title: 'Central Branch Student Directory (06_Student_Directory)',
          subtitle: `Branch: ${currentUser?.branch || 'Coimbatore'} • Registered Count: ${students.length}`,
          metadata: {
            'Exported By': currentUser?.name || 'Administrator',
            'Branch': (currentUser?.branch as string) || 'Coimbatore',
            'Source': directorySource === 'sheets' ? 'Live Google Sheets (06_Student_Directory)' : 'Local Cache',
          },
          headers: [
            'Student ID',
            'Student Name',
            'College',
            'Domain',
            'Branch',
            'Mentor',
            'Start Date',
            'End Date',
            'Duration',
            'Fee Status',
            'Project Status',
          ],
          rows: students.map((s) => [
            s.id,
            s.name,
            s.college,
            s.domain,
            s.branch,
            s.mentorName,
            s.startDate,
            s.endDate,
            s.duration,
            s.feeStatus.toUpperCase(),
            s.projectCompleted ? 'Completed' : 'Ongoing',
          ]),
        });
      }
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const handleExportDocx = async () => {
    setDownloadingFormat('docx');
    try {
      await exportToDocx({
        filename: `GSS_Student_Management_${branchCode}_${new Date().toISOString().substring(0, 10)}`,
        title: activeTab === 'tracker' ? `Mentorship Cohort Performance (ATT_${staffId})` : 'Central Branch Student Directory Dossier',
        subtitle: activeTab === 'tracker' ? `Cohort Attendance & Deliverable Evaluation` : 'Official Branch Roster & Milestone Audit',
        period: selectedMonth === '2026-10' ? 'October 2026' : 'September 2026',
        staffName: currentUser?.name || 'Staff Member',
        staffRole: currentUser?.role?.toUpperCase() || 'STAFF',
        branch: (currentUser?.branch as string) || 'Coimbatore',
        sections: [
          {
            heading: '1. Trainee Overview',
            description: `Supervised trainee roster for ${currentUser?.branch || 'Coimbatore'} branch across technology cohorts.`,
            table: {
              headers: ['Student ID', 'Student Name', 'College', 'Domain', 'Fee', 'Project'],
              rows: (activeTab === 'tracker' && trackerData?.students && trackerData.students.length > 0 ? trackerData.students : students).map((s: any) => [
                s.studentId || s.id,
                s.studentName || s.name,
                s.college || 'Engineering College',
                s.domain,
                (s.feeStatus || 'Paid').toUpperCase(),
                s.projectCompleted || s.completionPct ? 'Active' : 'In Progress',
              ]),
              columnWidthsPercentage: [18, 22, 22, 20, 9, 9],
            },
          },
        ],
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  const currentIndividualStudent = trackerData?.students[selectedStudentIdx] || trackerData?.students[0];

  return (
    <div className="space-y-6 animate-panel-entrance max-w-7xl mx-auto pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)] flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary,#1F1F1F)] tracking-tight">
                Student Management
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-on-container,#1A73E8)] border border-[var(--border-subtle,#D2E3FC)]">
                06_Student_Directory & ATT_{staffId}
              </span>
              {directorySource === 'sheets' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Google Sheets
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary,#5F6368)] mt-1">
              Unified trainee lifecycle hub combining central student directory with multi-month attendance & task trackers.
            </p>
          </div>
        </div>

        {/* Global Export & Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchBranchStudentDirectory}
            leftIcon={<RotateCw className={`w-3.5 h-3.5 ${loadingDirectory ? 'animate-spin' : ''}`} />}
          >
            Refresh
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
                <FileText className="w-3.5 h-3.5 text-blue-600" />
              )
            }
          >
            {downloadingFormat === 'docx' ? 'Generating...' : 'Download DOCX'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Student
          </Button>
        </div>
      </div>

      {/* ── Unified Mode Switcher Tabs ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-card,#DADCE0)] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-xl shadow-xs">
          <button
            type="button"
            onClick={() => handleTabChange('directory')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-[var(--brand-primary,#1A73E8)] text-white shadow-xs'
                : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Directory ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('tracker')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'tracker'
                ? 'bg-[var(--brand-primary,#1A73E8)] text-white shadow-xs'
                : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Monthly Attendance Tracker (ATT_{staffId})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('individual')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-[var(--brand-primary,#1A73E8)] text-white shadow-xs'
                : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Individual Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[var(--brand-primary,#1A73E8)] text-white shadow-xs'
                : 'text-[var(--text-secondary,#5F6368)] hover:text-[var(--text-primary,#1F1F1F)] hover:bg-[var(--nav-hover-bg,#F1F3F4)]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Batch Analytics</span>
          </button>
        </div>

        {activeTab === 'tracker' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncTracker}
              disabled={trackerSaving}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs ${
                trackerSuccess ? 'bg-emerald-600 text-white' : 'bg-[#1A365D] hover:bg-[#152a4a] text-white'
              }`}
            >
              {trackerSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : trackerSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Synced to Google Sheet!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Sync to Google Sheet</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase text-[var(--text-secondary,#5F6368)]">Total Students</span>
            <div className="w-8 h-8 rounded-full bg-[var(--brand-container,#E8F0FE)] text-[var(--brand-primary,#1A73E8)] flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary,#1F1F1F)] mt-2">{kpis.total}</p>
          <p className="text-[11px] text-[var(--text-secondary,#5F6368)] mt-1 flex items-center gap-1">
            <span className="text-[var(--badge-success-text,#137333)] font-semibold">100% active</span> enrolled cohort
          </p>
        </div>

        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase text-[var(--text-secondary,#5F6368)]">Avg Attendance</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary,#1F1F1F)] mt-2">{kpis.avgAttendance}%</p>
          <p className="text-[11px] text-[var(--text-secondary,#5F6368)] mt-1">Across Mon–Fri schedule</p>
        </div>

        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase text-[var(--text-secondary,#5F6368)]">Projects Completed</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary,#1F1F1F)] mt-2">{kpis.completedProjects}</p>
          <p className="text-[11px] text-[var(--text-secondary,#5F6368)] mt-1">Capstone milestones delivered</p>
        </div>

        <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase text-[var(--text-secondary,#5F6368)]">Fee Cleared</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary,#1F1F1F)] mt-2">{kpis.feeClearedPct}%</p>
          <p className="text-[11px] text-[var(--text-secondary,#5F6368)] mt-1">Accounting verification status</p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: STUDENT DIRECTORY (06_Student_Directory)
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted,#80868B)]" />
              <input
                type="text"
                placeholder="Search by student, college, mentor, domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-[var(--nav-hover-bg,#F1F3F4)] border border-transparent focus:border-[var(--brand-primary,#1A73E8)] focus:bg-white transition outline-none"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)] outline-none cursor-pointer"
              >
                <option value="all">All Domains</option>
                {DEFAULT_DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)] outline-none cursor-pointer"
              >
                <option value="all">All Branches</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <select
                value={feeFilter}
                onChange={(e) => setFeeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs border border-[var(--border-card,#DADCE0)] bg-[var(--bg-card,#FFFFFF)] text-[var(--text-primary,#1F1F1F)] outline-none cursor-pointer"
              >
                <option value="all">All Fees</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[var(--text-secondary,#5F6368)] font-semibold border-b border-[var(--border-card,#DADCE0)] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Student ID & Name</th>
                    <th className="py-3 px-4">Domain & College</th>
                    <th className="py-3 px-4">Mentor Assigned</th>
                    <th className="py-3 px-4">Tenure (Start → End)</th>
                    <th className="py-3 px-4 text-center">Fee Status</th>
                    <th className="py-3 px-4 text-center">Project Milestone</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-card,#DADCE0)]">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No students match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{s.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{s.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-blue-700">{s.domain}</div>
                          <div className="text-[11px] text-slate-500">{s.college}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{s.mentorName}</div>
                          <div className="text-[11px] text-slate-500">{s.mentorRole}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                          {formatHumanReadableDate(s.startDate)} → {formatHumanReadableDate(s.endDate)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            s.feeStatus === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : s.feeStatus === 'partial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {s.feeStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            s.projectCompleted
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {s.projectCompleted ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedStudentForDossier(s)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                            >
                              Dossier
                            </button>
                            <button
                              onClick={() => openEditModal(s)}
                              className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: ATTENDANCE & TASK TRACKER (ATT_{staffId})
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'tracker' && (
        <div className="space-y-4">
          {/* Tracker Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-[var(--text-primary,#1F1F1F)] font-medium">
                  Sub-Sheet: <span className="font-mono font-bold text-[var(--brand-primary,#1A73E8)]">ATT_{staffId}</span> • <span className="font-semibold">{currentWorkingDays.length} Working Days</span> (Mon–Fri)
                </p>
              </div>

              {/* Month Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(trackerData?.availableMonths && trackerData.availableMonths.length > 0
                  ? trackerData.availableMonths
                  : [
                      { monthKey: '2026-09', title: 'September 2026' },
                      { monthKey: '2026-10', title: 'October 2026' }
                    ]
                ).map((m) => {
                  const isSelected = selectedMonth === m.monthKey;
                  return (
                    <button
                      key={m.monthKey}
                      type="button"
                      onClick={() => handleMonthChange(m.monthKey)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {m.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRolloverNextMonth}
                disabled={trackerSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-xs text-indigo-700 font-semibold hover:bg-indigo-100 transition cursor-pointer"
                title="Create next month cohort block below with exactly 4 empty gap rows. Students whose End Date passed in previous month are automatically excluded."
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>+ Rollover Next Month (4-Row Gap)</span>
              </button>

              <button
                onClick={() => fetchTracker(selectedMonth)}
                disabled={trackerLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-card,#DADCE0)] text-xs text-[var(--text-primary,#1F1F1F)] font-medium hover:bg-[var(--nav-hover-bg,#F1F3F4)] transition cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 text-[var(--text-muted,#5F6368)] ${trackerLoading ? 'animate-spin' : ''}`} />
                <span>Reload</span>
              </button>
            </div>
          </div>

          {/* Multi-Month Spacing & Lifecycle Rollover Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl px-4 py-3 text-xs text-blue-900 shadow-xs">
            <div className="flex items-start sm:items-center gap-2.5">
              <CalendarCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong className="font-semibold text-blue-950">Multi-Month Vertical Stacking:</strong> Each consecutive month in <code className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[11px]">ATT_{staffId}</code> is stacked vertically with a <strong>gap of 4 empty rows</strong>.
                Students completing their internship in a previous month (End Date passed) do not appear in subsequent months.
              </span>
            </div>
            <span className="text-[11px] font-semibold text-blue-800 shrink-0 self-start sm:self-auto bg-white/90 px-2.5 py-1 rounded-lg border border-blue-200 shadow-xs">
              Cohort: {selectedMonth === '2026-09' ? 'September 2026' : selectedMonth === '2026-10' ? 'October 2026' : selectedMonth}
            </span>
          </div>

          {trackerError && (
            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{trackerError}</span>
            </div>
          )}

          {trackerLoading && !trackerData ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary,#1A73E8)] mb-3" />
              <p className="text-xs text-[var(--text-muted,#5F6368)] font-medium">Loading Monthly Attendance & Task Tracker matrix...</p>
            </div>
          ) : !trackerData || trackerData.students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl">
              <TableIcon className="w-12 h-12 text-[var(--text-muted,#5F6368)] opacity-30 mb-3" />
              <p className="text-sm font-semibold text-[var(--text-primary,#1F1F1F)]">No tracker data available for {selectedMonth}</p>
              <p className="text-xs text-[var(--text-muted,#5F6368)] mt-1">Click &ldquo;+ Rollover Next Month&rdquo; to populate.</p>
            </div>
          ) : (
            /* EXACT SPREADSHEET MATRIX VIEW */
            <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse select-none">
                  <thead>
                    <tr className="bg-[#1A365D] text-white">
                      <th
                        colSpan={2 + currentWorkingDays.length + 5}
                        className="py-3 px-4 text-right font-bold text-sm tracking-wide border-b border-[#2A4A87]"
                      >
                        {trackerData.monthTitle || `MONTHLY ATTENDANCE & TASK TRACKER — ${selectedMonth === '2026-10' ? 'OCTOBER 2026' : 'SEPTEMBER 2026'}`}
                      </th>
                    </tr>

                    <tr className="bg-[#23457D] text-[#D2E3FC]">
                      <th
                        colSpan={2 + currentWorkingDays.length + 5}
                        className="py-1.5 px-4 text-right italic font-normal text-[11px] border-b border-[#2A4A87]"
                      >
                        {trackerData.subTitle || 'Cohort: Q3-Q4 2026 | Mon-Fri Tracking | Dropdown Validation'}
                      </th>
                    </tr>

                    <tr className="bg-[#1E3A8A] text-white font-semibold">
                      <th className="py-2.5 px-3 border border-[#3B82F6]/30 text-center sticky left-0 z-20 bg-[#1E3A8A] min-w-[170px]">
                        Intern Name
                      </th>
                      <th className="py-2.5 px-3 border border-[#3B82F6]/30 text-center sticky left-[170px] z-20 bg-[#1E3A8A] min-w-[140px]">
                        Tracking Metric
                      </th>
                      {currentWorkingDays.map(w => {
                        const isToday = w.date === new Date().toISOString().slice(0, 10);
                        return (
                          <th
                            key={w.date}
                            className={`py-2 px-2 border text-center font-mono text-[10px] min-w-[85px] relative transition-all ${
                              isToday
                                ? 'bg-amber-500 text-slate-950 font-bold border-amber-300 ring-2 ring-amber-300 shadow-sm'
                                : 'border-[#3B82F6]/30 text-white'
                            }`}
                          >
                            {isToday && (
                              <span className="inline-block text-[8px] uppercase tracking-wider font-extrabold bg-slate-950 text-amber-300 rounded px-1.5 py-0.5 mb-1 shadow-2xs">
                                TODAY
                              </span>
                            )}
                            <div>{w.date}</div>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-2 border border-[#3B82F6]/30 text-center min-w-[90px] bg-[#172554]">Total Present</th>
                      <th className="py-2.5 px-2 border border-[#3B82F6]/30 text-center min-w-[90px] bg-[#172554]">Total Absent</th>
                      <th className="py-2.5 px-2 border border-[#3B82F6]/30 text-center min-w-[90px] bg-[#172554]">Attendance %</th>
                      <th className="py-2.5 px-2 border border-[#3B82F6]/30 text-center min-w-[105px] bg-[#172554]">Tasks Completed</th>
                      <th className="py-2.5 px-2 border border-[#3B82F6]/30 text-center min-w-[95px] bg-[#172554]">Completion %</th>
                    </tr>

                    <tr className="bg-[#2563EB] text-white font-medium text-[11px]">
                      <th className="py-1.5 px-3 border border-[#60A5FA]/30 text-center sticky left-0 z-20 bg-[#2563EB]">
                        Domain &amp; Individual Tenure
                      </th>
                      <th className="py-1.5 px-3 border border-[#60A5FA]/30 text-center sticky left-[170px] z-20 bg-[#2563EB]">
                        Daily Log Type
                      </th>
                      {currentWorkingDays.map(w => {
                        const isToday = w.date === new Date().toISOString().slice(0, 10);
                        return (
                          <th
                            key={w.date}
                            className={`py-1.5 px-2 border text-center text-[10px] font-semibold transition-all ${
                              isToday
                                ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                                : 'border-[#60A5FA]/30 text-white'
                            }`}
                          >
                            {w.day}
                          </th>
                        );
                      })}
                      <th className="py-1.5 px-2 border border-[#60A5FA]/30 text-center text-[10px] bg-[#1D4ED8]">Summary</th>
                      <th className="py-1.5 px-2 border border-[#60A5FA]/30 text-center text-[10px] bg-[#1D4ED8]">Summary</th>
                      <th className="py-1.5 px-2 border border-[#60A5FA]/30 text-center text-[10px] bg-[#1D4ED8]">Rate %</th>
                      <th className="py-1.5 px-2 border border-[#60A5FA]/30 text-center text-[10px] bg-[#1D4ED8]">Summary</th>
                      <th className="py-1.5 px-2 border border-[#60A5FA]/30 text-center text-[10px] bg-[#1D4ED8]">Rate %</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trackerData.students.map((s, studentIdx) => {
                      const presentCount = s.attendance.filter(v => v === 'Present').length;
                      const absentCount = s.attendance.filter(v => v === 'Absent').length;
                      const attPct = (presentCount + absentCount > 0)
                        ? `${((presentCount / (presentCount + absentCount)) * 100).toFixed(1)}%`
                        : '100%';

                      const eligibleDays = s.eligibleDays || s.attendance.filter(v => v && v !== 'Not Joined').length || currentWorkingDays.length;
                      const completedTasks = s.tasks.filter(v => v === 'Completed').length;
                      const compPct = eligibleDays > 0 ? `${((completedTasks / eligibleDays) * 100).toFixed(1)}%` : '0%';

                      return (
                        <React.Fragment key={studentIdx}>
                          <tr className="hover:bg-slate-50 transition-colors border-t border-slate-200">
                            <td
                              rowSpan={2}
                              className="py-2 px-3 border border-slate-200 font-bold text-[var(--text-primary,#1F1F1F)] text-center align-middle sticky left-0 z-10 bg-white"
                            >
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="text-xs font-semibold text-slate-900">{s.studentName}</span>
                                <span className="text-[10px] text-slate-500 font-normal">{s.domain}</span>
                                <div className="mt-1 flex flex-col items-center gap-0.5">
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                    Start: {formatHumanReadableDate(s.startDate)}
                                  </span>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    End: {formatHumanReadableDate(s.endDate)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedStudentIdx(studentIdx);
                                    handleTabChange('individual');
                                  }}
                                  className="mt-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                                >
                                  <span>View Timeline</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            <td className="py-2 px-3 border border-slate-200 text-center text-slate-700 font-medium sticky left-[170px] z-10 bg-white">
                              Attendance
                            </td>

                            {currentWorkingDays.map((w, dayIdx) => {
                              const enrollmentState = getStudentDateEnrollmentState(w.date, s.startDate, s.endDate);
                              const isNotJoined = enrollmentState === 'NOT_JOINED';
                              const val = isNotJoined ? 'Not Joined' : (s.attendance[dayIdx] || '');

                              return (
                                <td key={w.date} className="p-1 border border-slate-200 text-center">
                                  <div className="relative inline-block w-full">
                                    <select
                                      value={val}
                                      disabled={isNotJoined}
                                      onChange={(e) => handleAttendanceChange(studentIdx, dayIdx, e.target.value)}
                                      className={`w-full py-1 px-1 rounded-lg text-[10px] font-semibold border appearance-none text-center transition focus:outline-none ${
                                        isNotJoined
                                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed italic'
                                          : `cursor-pointer focus:ring-1 focus:ring-blue-500 ${getBadgeStyle(val)}`
                                      }`}
                                    >
                                      {isNotJoined ? (
                                        <option value="Not Joined">Not Joined</option>
                                      ) : (
                                        <>
                                          <option value="">—</option>
                                          <option value="Present">Present ▾</option>
                                          <option value="Absent">Absent ▾</option>
                                          <option value="Holiday">Holiday ▾</option>
                                          <option value="On Leave">On Leave ▾</option>
                                        </>
                                      )}
                                    </select>
                                  </div>
                                </td>
                              );
                            })}

                            <td className="py-2 px-2 border border-slate-200 text-center font-bold text-slate-800 bg-slate-50">
                              {presentCount}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-center font-bold text-slate-800 bg-slate-50">
                              {absentCount}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/50">
                              {attPct}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-center text-slate-400 bg-slate-50">—</td>
                            <td className="py-2 px-2 border border-slate-200 text-center text-slate-400 bg-slate-50">—</td>
                          </tr>

                          <tr className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                            <td className="py-2 px-3 border border-slate-200 text-center text-slate-700 font-medium sticky left-[170px] z-10 bg-white">
                              Task Completion
                            </td>

                            {currentWorkingDays.map((w, dayIdx) => {
                              const enrollmentState = getStudentDateEnrollmentState(w.date, s.startDate, s.endDate);
                              const isNotJoined = enrollmentState === 'NOT_JOINED';
                              const val = isNotJoined ? 'Not Joined' : (s.tasks[dayIdx] || '');

                              return (
                                <td key={w.date} className="p-1 border border-slate-200 text-center">
                                  <div className="relative inline-block w-full">
                                    <select
                                      value={val}
                                      disabled={isNotJoined}
                                      onChange={(e) => handleTaskChange(studentIdx, dayIdx, e.target.value)}
                                      className={`w-full py-1 px-1 rounded-lg text-[10px] font-semibold border appearance-none text-center transition focus:outline-none ${
                                        isNotJoined
                                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed italic'
                                          : `cursor-pointer focus:ring-1 focus:ring-blue-500 ${getBadgeStyle(val)}`
                                      }`}
                                    >
                                      {isNotJoined ? (
                                        <option value="Not Joined">Not Joined</option>
                                      ) : (
                                        <>
                                          <option value="">—</option>
                                          <option value="Completed">Completed ▾</option>
                                          <option value="Not Completed">Not Comp... ▾</option>
                                          <option value="In Progress">In Progress ▾</option>
                                          <option value="Holiday">Holiday ▾</option>
                                        </>
                                      )}
                                    </select>
                                  </div>
                                </td>
                              );
                            })}

                            <td className="py-2 px-2 border border-slate-200 text-center text-slate-400 bg-slate-50">—</td>
                            <td className="py-2 px-2 border border-slate-200 text-center text-slate-400 bg-slate-50">—</td>
                            <td className="py-2 px-2 border border-slate-200 text-center text-slate-400 bg-slate-50">—</td>
                            <td className="py-2 px-2 border border-slate-200 text-center font-bold text-slate-800 bg-slate-50">
                              {completedTasks}
                            </td>
                            <td className="py-2 px-2 border border-slate-200 text-center font-bold text-blue-700 bg-blue-50/50">
                              {compPct}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}

                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-2.5 px-3 border border-slate-300 text-left sticky left-0 z-10 bg-slate-100">
                        Daily Total Present
                      </td>
                      <td className="py-2.5 px-3 border border-slate-300 text-center sticky left-[170px] z-10 bg-slate-100">
                        Cohort Attendance
                      </td>
                      {currentWorkingDays.map((w, dayIdx) => {
                        const count = trackerData.students.reduce(
                          (acc, cur) => acc + (cur.attendance[dayIdx] === 'Present' ? 1 : 0),
                          0
                        );
                        return (
                          <td key={w.date} className="py-2.5 px-2 border border-slate-300 text-center font-mono text-xs">
                            {count}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-2 border border-slate-300 text-center font-mono text-xs">
                        {trackerData.students.reduce((acc, cur) => acc + cur.attendance.filter(a => a === 'Present').length, 0)}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-300 text-center font-mono text-xs">
                        {trackerData.students.reduce((acc, cur) => acc + cur.attendance.filter(a => a === 'Absent').length, 0)}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-300 text-center font-mono text-xs">—</td>
                      <td className="py-2.5 px-2 border border-slate-300 text-center font-mono text-xs">—</td>
                      <td className="py-2.5 px-2 border border-slate-300 text-center font-mono text-xs">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: INDIVIDUAL STUDENT TIMELINE
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'individual' && currentIndividualStudent && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700">Select Intern:</label>
              <select
                value={selectedStudentIdx}
                onChange={(e) => setSelectedStudentIdx(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white shadow-xs focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {trackerData?.students.map((s, idx) => (
                  <option key={idx} value={idx}>
                    {s.studentName} — {s.domain} (Joined: {formatHumanReadableDate(s.startDate)})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSyncTracker}
              disabled={trackerSaving}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#1A365D] hover:bg-[#152a4a] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            >
              {trackerSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Sync to Google Sheet</span>
            </button>
          </div>

          <div className="bg-gradient-to-br from-[#1A365D] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
                  {currentIndividualStudent.studentName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{currentIndividualStudent.studentName}</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-medium">
                      Active Mentorship
                    </span>
                  </div>
                  <p className="text-xs text-blue-100 mt-0.5">{currentIndividualStudent.domain}</p>
                  <p className="text-[11px] text-blue-200/80 mt-1">
                    Internship Period: <span className="font-semibold text-white">{formatHumanReadableDate(currentIndividualStudent.startDate)}</span> → <span className="font-semibold text-white">{formatHumanReadableDate(currentIndividualStudent.endDate)}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                  <p className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">Attendance Rate</p>
                  <p className="text-lg font-extrabold text-emerald-300 mt-0.5">{currentIndividualStudent.attendancePct || '100%'}</p>
                  <p className="text-[9px] text-blue-100">{currentIndividualStudent.totalPresent || 0} Present / {currentIndividualStudent.totalAbsent || 0} Absent</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                  <p className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">Task Completion</p>
                  <p className="text-lg font-extrabold text-white mt-0.5">{currentIndividualStudent.completionPct || '0%'}</p>
                  <p className="text-[9px] text-blue-100">{currentIndividualStudent.tasksCompleted || 0} Tasks Done</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                  <p className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">Active Days</p>
                  <p className="text-lg font-extrabold text-white mt-0.5">{currentIndividualStudent.eligibleDays || 22} Days</p>
                  <p className="text-[9px] text-blue-100">Enrolled in Cycle</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 text-center">
                  <p className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">Total Duration</p>
                  <p className="text-lg font-extrabold text-white mt-0.5">{currentIndividualStudent.tenureDays || 90} Days</p>
                  <p className="text-[9px] text-blue-100">12 Weeks Track</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Day-by-Day Attendance & Task Lifecycle for {currentIndividualStudent.studentName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tracked from Start Date ({formatHumanReadableDate(currentIndividualStudent.startDate)}) to End Date ({formatHumanReadableDate(currentIndividualStudent.endDate)})
                </p>
              </div>

              <span className="text-[11px] font-medium text-slate-500">
                Total Tracked Working Days: {currentWorkingDays.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Day</th>
                    <th className="py-2.5 px-4">Enrollment Status</th>
                    <th className="py-2.5 px-4">Daily Attendance</th>
                    <th className="py-2.5 px-4">Task Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentWorkingDays.map((w, dayIdx) => {
                    const enrollmentState = getStudentDateEnrollmentState(w.date, currentIndividualStudent.startDate, currentIndividualStudent.endDate);
                    const isNotJoined = enrollmentState === 'NOT_JOINED';
                    const attVal = isNotJoined ? 'Not Joined' : (currentIndividualStudent.attendance[dayIdx] || '');
                    const tskVal = isNotJoined ? 'Not Joined' : (currentIndividualStudent.tasks[dayIdx] || '');

                    return (
                      <tr key={w.date} className={`hover:bg-slate-50 transition-colors ${isNotJoined ? 'bg-slate-50/60' : ''}`}>
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{dayIdx + 1}</td>
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{formatHumanReadableDate(w.date)}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-600">{w.day}</td>

                        <td className="py-2.5 px-4">
                          {isNotJoined ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              Pre-Enrollment (Not Joined)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active Student
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-4">
                          <select
                            value={attVal}
                            disabled={isNotJoined}
                            onChange={(e) => handleAttendanceChange(selectedStudentIdx, dayIdx, e.target.value)}
                            className={`py-1 px-2 rounded-lg text-xs font-semibold border transition ${
                              isNotJoined
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed italic'
                                : `cursor-pointer focus:ring-1 focus:ring-blue-500 ${getBadgeStyle(attVal)}`
                            }`}
                          >
                            {isNotJoined ? (
                              <option value="Not Joined">Not Joined</option>
                            ) : (
                              <>
                                <option value="">— Select Attendance —</option>
                                <option value="Present">Present</option>
                                <option value="Absent">Absent</option>
                                <option value="Holiday">Holiday</option>
                                <option value="On Leave">On Leave</option>
                              </>
                            )}
                          </select>
                        </td>

                        <td className="py-2 px-4">
                          <select
                            value={tskVal}
                            disabled={isNotJoined}
                            onChange={(e) => handleTaskChange(selectedStudentIdx, dayIdx, e.target.value)}
                            className={`py-1 px-2 rounded-lg text-xs font-semibold border transition ${
                              isNotJoined
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed italic'
                                : `cursor-pointer focus:ring-1 focus:ring-blue-500 ${getBadgeStyle(tskVal)}`
                            }`}
                          >
                            {isNotJoined ? (
                              <option value="Not Joined">Not Joined</option>
                            ) : (
                              <>
                                <option value="">— Select Task Status —</option>
                                <option value="Completed">Completed</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Not Completed">Not Completed</option>
                                <option value="Holiday">Holiday</option>
                              </>
                            )}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 4: BATCH ANALYTICS & VISUAL BREAKDOWN
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Technology Domain Distribution</span>
            </h3>
            <div className="space-y-3">
              {DEFAULT_DOMAINS.map((domain) => {
                const count = students.filter((s) => s.domain === domain).length;
                const pct = students.length > 0 ? Math.round((count / students.length) * 100) : 0;
                return (
                  <div key={domain}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{domain}</span>
                      <span className="text-slate-500">{count} trainees ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[var(--bg-card,#FFFFFF)] border border-[var(--border-card,#DADCE0)] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Accounting & Fee Clearance Status</span>
            </h3>
            <div className="space-y-4">
              {['paid', 'partial', 'pending'].map((status) => {
                const count = students.filter((s) => s.feeStatus === status).length;
                const pct = students.length > 0 ? Math.round((count / students.length) * 100) : 0;
                const color = status === 'paid' ? 'bg-emerald-500' : status === 'partial' ? 'bg-amber-500' : 'bg-rose-500';
                return (
                  <div key={status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700 uppercase">{status}</span>
                      <span className="text-slate-500">{count} trainees ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          STUDENT PROFILE & DOSSIER MODAL
         ───────────────────────────────────────────────────────────────────────────── */}
      {selectedStudentForDossier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {selectedStudentForDossier.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedStudentForDossier.name}</h3>
                  <p className="text-xs text-slate-500">{selectedStudentForDossier.id} • {selectedStudentForDossier.domain}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudentForDossier(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-500 font-medium">College</p>
                <p className="font-semibold text-slate-800">{selectedStudentForDossier.college}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Branch</p>
                <p className="font-semibold text-slate-800">{selectedStudentForDossier.branch}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Assigned Mentor</p>
                <p className="font-semibold text-slate-800">{selectedStudentForDossier.mentorName}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Tenure</p>
                <p className="font-semibold text-slate-800">{formatHumanReadableDate(selectedStudentForDossier.startDate)} → {formatHumanReadableDate(selectedStudentForDossier.endDate)}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Fee Clearance</p>
                <p className="font-semibold text-slate-800 uppercase">{selectedStudentForDossier.feeStatus}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Capstone Project</p>
                <p className="font-semibold text-slate-800">{selectedStudentForDossier.projectTitle || 'Capstone Milestone'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <Button variant="secondary" onClick={() => setSelectedStudentForDossier(null)}>
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          ADD / EDIT STUDENT MODAL
         ───────────────────────────────────────────────────────────────────────────── */}
      {(isAddModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveStudent} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingStudent ? 'Edit Student Record' : 'Enroll New Trainee'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">College *</label>
                  <input
                    required
                    type="text"
                    value={formData.college}
                    onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                    placeholder="College Name"
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Domain</label>
                  <select
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                  >
                    {DEFAULT_DOMAINS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Fee Status</label>
                  <select
                    value={formData.feeStatus}
                    onChange={(e) => setFormData({ ...formData, feeStatus: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Assigned Mentor</label>
                  <input
                    type="text"
                    value={formData.mentorName}
                    onChange={(e) => setFormData({ ...formData, mentorName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                {editingStudent ? 'Save Changes' : 'Enroll Trainee'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function StudentManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary,#1A73E8)]" />
          <p className="text-xs text-[var(--text-secondary,#5F6368)]">Loading Student Management Portal...</p>
        </div>
      }
    >
      <StudentManagementContent />
    </Suspense>
  );
}
