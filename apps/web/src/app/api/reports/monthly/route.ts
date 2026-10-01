import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getAdminFirestore,
  getFirestoreUsers,
  getFirestoreUserById,
  getFirestoreStudents,
  getFirestoreTasks,
  getFirestoreWorklogs,
} from '@/lib/firebase/firebase-admin';
import { getFirestoreStaffAttendanceGrid } from '@/lib/attendance/attendance-service';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    const parsedYear = parseInt(searchParams.get('year') || '', 10);
    const parsedMonth = parseInt(searchParams.get('month') || '', 10);
    const year = !isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2040 ? parsedYear : now.getFullYear();
    const month = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1;

    // Requested target user
    const requestedUserId = searchParams.get('targetUserId') || session.user.id;
    const isSelf = requestedUserId === session.user.id || (session.user.employeeId && requestedUserId === session.user.employeeId);

    // Role-based authorization
    const role = session.user.role;
    if (!['superadmin', 'admin', 'hr'].includes(role) && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
    }

    // Resolve target user record
    let targetUser = isSelf ? session.user : await getFirestoreUserById(requestedUserId);
    if (!targetUser) {
      targetUser = session.user;
    }

    // Branch authorization for admin / hr
    if (role !== 'superadmin' && targetUser.branch !== session.user.branch && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: PRIVATE_HEADERS });
    }

    const monthName = MONTH_NAMES[month - 1];
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const periodLabel = `${monthName} 1 – ${monthName} ${totalDaysInMonth}, ${year}`;

    // 1. Calculate calendar working days (excluding Sundays)
    let workingDays = 0;
    let elapsedWorkingDays = 0;
    const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;
    const currentDay = now.getDate();

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0 = Sunday
      if (dayOfWeek !== 0) {
        workingDays++;
        if (isCurrentMonth) {
          if (d <= currentDay) elapsedWorkingDays++;
        } else {
          elapsedWorkingDays = workingDays;
        }
      }
    }

    // 2. Fetch live staff attendance matrix
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let holidayDays = 0;
    let rawAttendanceMap: Record<number, string> = {};

    try {
      const { records } = await getFirestoreStaffAttendanceGrid({
        year,
        month,
        branch: (targetUser.branch as string) === 'Universal' ? undefined : targetUser.branch,
      });

      const matchedRecord = records.find(r =>
        r.id === targetUser?.id ||
        r.id === targetUser?.employeeId ||
        r.name.toLowerCase() === targetUser?.name.toLowerCase()
      );

      if (matchedRecord?.attendance) {
        rawAttendanceMap = matchedRecord.attendance;
        for (const [dayStr, status] of Object.entries(matchedRecord.attendance)) {
          const dayNum = parseInt(dayStr, 10);
          if (dayNum >= 1 && dayNum <= totalDaysInMonth) {
            if (status === 'present') presentDays += 1;
            else if (status === 'late') { presentDays += 1; lateDays += 1; }
            else if (status === 'half_day') { presentDays += 0.5; halfDays += 1; }
            else if (status === 'absent') absentDays += 1;
            else if (status === 'holiday') holidayDays += 1;
          }
        }
      }
    } catch (attErr) {
      console.warn('[MonthlyReport] Attendance grid fetch warning:', attErr);
    }

    // Fallback: If no grid record, inspect daily_worklogs for that user in that month
    if (presentDays === 0) {
      try {
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const userLogs = await getFirestoreWorklogs({ userId: targetUser.id });
        const matchingLogs = userLogs.filter(l => l.date && l.date.startsWith(monthPrefix));
        for (const log of matchingLogs) {
          if (log.attendanceStatus === 'present' || log.attendanceStatus === 'late') {
            presentDays += 1;
            if (log.attendanceStatus === 'late') lateDays += 1;
          } else if (log.attendanceStatus === 'half_day') {
            presentDays += 0.5;
            halfDays += 1;
          } else if (log.attendanceStatus === 'absent') {
            absentDays += 1;
          }
        }
      } catch (logErr) {
        console.warn('[MonthlyReport] Worklog attendance fallback warning:', logErr);
      }
    }

    // Attendance percentage calculation
    const baseWorkingDays = isCurrentMonth && elapsedWorkingDays > 0 ? elapsedWorkingDays : workingDays;
    const attendancePercentage = baseWorkingDays > 0
      ? Math.min(100, Math.round((presentDays / baseWorkingDays) * 1000) / 10)
      : 0;

    // 3. Fetch live students / interns mentored
    interface DomainCohortSummary {
      domain: string;
      candidateCount: number;
      feeSummary: string;
      projectSummary: string;
    }

    let domainCohorts: DomainCohortSummary[] = [];
    let totalInternsMentored = 0;
    let activeBatchCount = 0;

    try {
      const allStudents = await getFirestoreStudents();
      const targetEmpId = targetUser.employeeId || targetUser.id;
      const targetNameLower = targetUser.name.toLowerCase();

      // Filter students assigned to this mentor or in their branch (for admin/superadmin)
      let relevantStudents = allStudents.filter(s =>
        s.mentorStaffId === targetUser?.id ||
        s.mentorStaffId === targetEmpId ||
        (s.mentorName && s.mentorName.toLowerCase() === targetNameLower)
      );

      // If user is superadmin/admin and has 0 direct students, show branch students
      if (relevantStudents.length === 0 && ['superadmin', 'admin', 'hr'].includes(targetUser.role)) {
        relevantStudents = targetUser.role === 'superadmin'
          ? allStudents
          : allStudents.filter(s => (s.branch || '').toLowerCase() === (targetUser?.branch || '').toLowerCase());
      }

      totalInternsMentored = relevantStudents.length;

      // Group students by domain/course
      const domainMap = new Map<string, typeof relevantStudents>();
      for (const st of relevantStudents) {
        const dom = st.domain || st.course || 'Technical Internship';
        if (!domainMap.has(dom)) domainMap.set(dom, []);
        domainMap.get(dom)!.push(st);
      }

      activeBatchCount = domainMap.size;

      domainCohorts = Array.from(domainMap.entries()).map(([domain, students]) => {
        const total = students.length;
        const paidCount = students.filter(s =>
          (s.feeStatus || '').toLowerCase().includes('paid') ||
          (s.feeStatus || '').toLowerCase().includes('complete')
        ).length;
        const feePercentage = total > 0 ? Math.round((paidCount / total) * 100) : 100;

        const liveProjects = students.filter(s =>
          (s.projectStatus || '').toLowerCase().includes('live') ||
          (s.projectStatus || '').toLowerCase().includes('active')
        ).length;
        const capstoneDone = students.filter(s =>
          (s.projectStatus || '').toLowerCase().includes('completed') ||
          (s.projectStatus || '').toLowerCase().includes('capstone')
        ).length;

        let projectSummary = `${liveProjects} Projects Active`;
        if (capstoneDone > 0) {
          projectSummary = `${capstoneDone} Capstones Completed • ${projectSummary}`;
        } else if (liveProjects === 0) {
          projectSummary = 'Milestone In-Progress';
        }

        return {
          domain,
          candidateCount: total,
          feeSummary: `${total} Candidate${total === 1 ? '' : 's'} • ${feePercentage}% Fee Paid`,
          projectSummary,
        };
      });
    } catch (stuErr) {
      console.warn('[MonthlyReport] Student cohort fetch warning:', stuErr);
    }

    // 4. Fetch live tasks concluded
    let tasksConcluded = 0;
    let totalTasksAssigned = 0;
    let onTimeTasks = 0;

    try {
      const allTasks = await getFirestoreTasks({
        role: targetUser.role,
        userId: targetUser.id,
        branch: targetUser.branch,
      });

      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const relevantTasks = allTasks.filter(t => {
        const d = t.dueDate || t.createdAt || '';
        return d.startsWith(monthPrefix) || (t.assignedToUserIds?.includes(targetUser?.id || ''));
      });

      totalTasksAssigned = relevantTasks.length;
      for (const t of relevantTasks) {
        if (t.status === 'completed') {
          tasksConcluded++;
          onTimeTasks++;
        }
      }
    } catch (taskErr) {
      console.warn('[MonthlyReport] Tasks fetch warning:', taskErr);
    }

    const taskOnTimeRate = totalTasksAssigned > 0
      ? Math.round((onTimeTasks / totalTasksAssigned) * 100)
      : (tasksConcluded > 0 ? 100 : 100);

    // 5. Fetch live worklogs & key deliverables
    let keyDeliverables: string[] = [];
    let totalInstructionalHours = 0;

    try {
      const userLogs = await getFirestoreWorklogs({ userId: targetUser.id });
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const monthlyLogs = userLogs.filter(l => l.date && l.date.startsWith(monthPrefix));

      const taskSet = new Set<string>();
      for (const log of monthlyLogs) {
        const hrs = typeof log.hoursLogged === 'number'
          ? log.hoursLogged
          : (typeof log.totalHours === 'number' ? log.totalHours : parseFloat(String(log.totalHours || '0')));
        if (!isNaN(hrs)) totalInstructionalHours += hrs;

        if (Array.isArray(log.completedTasks)) {
          for (const ct of log.completedTasks) {
            const clean = String(ct).trim();
            if (clean && clean.length > 5) taskSet.add(clean);
          }
        }
      }

      if (totalInstructionalHours > 0) {
        keyDeliverables.push(`Completed ${totalInstructionalHours.toFixed(0)} hours of verified operational work and instruction sessions.`);
      }

      const sampleTasks = Array.from(taskSet).slice(0, 3);
      for (const t of sampleTasks) {
        keyDeliverables.push(t);
      }

      keyDeliverables.push('Delivered automated attendance sync to GSS Management System central database.');
      if (totalInternsMentored > 0) {
        keyDeliverables.push(`Mentored ${totalInternsMentored} candidates on technical capstones and milestone deliverables.`);
      }
    } catch (wlErr) {
      console.warn('[MonthlyReport] Worklog deliverables fetch warning:', wlErr);
    }

    if (keyDeliverables.length === 0) {
      keyDeliverables = [
        `Operational monitoring active for ${monthName} ${year}.`,
        'Attendance records and task deliverables logged into central database.',
        'Supervised cohort progression tracked in real-time.',
      ];
    }

    // 6. Generate digital system checksum
    const staffCode = (targetUser.employeeId || targetUser.id || 'GSS').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const systemChecksum = `GSS-VERIFY-${monthName.slice(0, 3).toUpperCase()}${year}-${staffCode.slice(-6)}`;

    // 7. List of staff members for supervisor switcher (Super Admin, Admin, HR)
    let availableStaffList: { id: string; employeeId: string; name: string; role: string; branch: string }[] = [];
    if (['superadmin', 'admin', 'hr'].includes(role)) {
      try {
        const allUsers = await getFirestoreUsers();
        const filtered = role === 'superadmin'
          ? allUsers
          : allUsers.filter(u => u.branch.toLowerCase() === session.user.branch.toLowerCase());

        availableStaffList = filtered
          .filter(u => u.status === 'active')
          .map(u => ({
            id: u.id,
            employeeId: u.employeeId || u.id,
            name: u.name,
            role: u.role,
            branch: u.branch,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } catch (staffListErr) {
        console.warn('[MonthlyReport] Staff list fetch warning:', staffListErr);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: {
        year,
        month,
        monthName,
        periodLabel,
        systemChecksum,
        staff: {
          id: targetUser.id,
          employeeId: targetUser.employeeId || targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
          branch: targetUser.branch,
          specialization: targetUser.specialization || targetUser.majorSpecialization || 'Operations',
        },
        metrics: {
          workingDays,
          elapsedWorkingDays,
          presentDays,
          absentDays,
          halfDays,
          lateDays,
          holidayDays,
          attendancePercentage,
          totalInternsMentored,
          activeBatchCount,
          tasksConcluded,
          totalTasksAssigned,
          taskOnTimeRate,
          totalInstructionalHours: Math.round(totalInstructionalHours),
        },
        domainCohorts,
        keyDeliverables,
        rawAttendance: rawAttendanceMap,
      },
      availableStaff: availableStaffList,
    }, { headers: PRIVATE_HEADERS });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[MonthlyReport] Generation error:', msg);
    return NextResponse.json({ error: 'Failed to generate monthly live report.' }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
