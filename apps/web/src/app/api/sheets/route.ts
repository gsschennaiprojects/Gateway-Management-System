import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { BRANCH_NAME_TO_CODE } from '@/lib/seed-branches';
import { getFirestoreStudents, getFirestoreTasks, getFirestoreUserById, getFirestoreUsers, getFirestoreWorklogs, syncStudentToFirestore } from '@/lib/firebase/firebase-admin';
import type { UserRole } from '@/types/auth';
import { hasOversizedBody, isSameOriginRequest } from '@/lib/api/request-security';

export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

function resolveBranchCode(branchCode: string | null, branchName: string): string | null {
  if (branchCode) return branchCode.toUpperCase();
  return BRANCH_NAME_TO_CODE[branchName] || null;
}

function branchNameForCode(code: string): string | undefined {
  return Object.entries(BRANCH_NAME_TO_CODE).find(([, branchCode]) => branchCode === code)?.[0];
}

async function canAccessStaff(session: { id: string; role: UserRole; branch: string }, staffId: string, code: string): Promise<boolean> {
  if (session.role === 'superadmin') return true;
  if (BRANCH_NAME_TO_CODE[session.branch] !== code) return false;
  if (staffId === session.id) return true;
  if (!['admin', 'hr'].includes(session.role)) return false;
  const target = await getFirestoreUserById(staffId);
  return target?.branch === session.branch;
}

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return error(401, 'Unauthorized');
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  if (!type) return error(400, 'Missing type parameter.');
  const code = resolveBranchCode(searchParams.get('branchCode'), searchParams.get('branch') || session.user.branch);
  if (!code) return error(400, 'Unknown branch.');
  if (session.user.role !== 'superadmin' && BRANCH_NAME_TO_CODE[session.user.branch] !== code) return error(403, 'Forbidden');
  const branch = branchNameForCode(code);
  if (!branch) return error(404, 'Branch not found.');

  try {
    if (type === 'worklog' || type === 'student' || type === 'task' || type === 'attendance_tracker') {
      const staffId = searchParams.get('staffId') || session.user.id;
      if (!await canAccessStaff({ id: session.user.id, role: session.user.role, branch: session.user.branch }, staffId, code)) return error(403, 'Forbidden');
      if (type === 'worklog') {
        const logs = await getFirestoreWorklogs({ userId: staffId, date: searchParams.get('date') || undefined });
        return NextResponse.json({ success: true, data: logs, count: logs.length, source: 'firestore' }, { headers: PRIVATE_HEADERS });
      }
      if (type === 'student') {
        const students = await getFirestoreStudents({ staffId, branch });
        return NextResponse.json({ success: true, data: students, count: students.length, source: 'firestore' }, { headers: PRIVATE_HEADERS });
      }
      if (type === 'task') {
        const tasks = await getFirestoreTasks({ userId: staffId, role: session.user.role, branch });
        return NextResponse.json({ success: true, data: tasks, count: tasks.length, source: 'firestore' }, { headers: PRIVATE_HEADERS });
      }
      return error(503, 'Monthly attendance tracker storage is not configured in the canonical database.');
    }
    if (type === 'staff_directory') {
      if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) return error(403, 'Forbidden');
      const users = await getFirestoreUsers();
      const data = users.filter(user => user.branch === branch);
      return NextResponse.json({ success: true, data, count: data.length, source: 'firestore' }, { headers: PRIVATE_HEADERS });
    }
    if (type === 'branch_student_directory') {
      if (!['superadmin', 'admin', 'hr'].includes(session.user.role)) return error(403, 'Forbidden');
      const students = await getFirestoreStudents({ branch });
      return NextResponse.json({ success: true, data: students, count: students.length, source: 'firestore' }, { headers: PRIVATE_HEADERS });
    }
    if (type === 'staff_attendance') return error(503, 'Attendance directory projection is not configured in the canonical database.');
    return error(400, 'Unknown data type.');
  } catch {
    return error(503, 'Requested data is temporarily unavailable.');
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return error(401, 'Unauthorized');
  if (!isSameOriginRequest(request)) return error(403, 'Request origin is not allowed.');
  if (hasOversizedBody(request, 32_768)) return error(413, 'Request is too large.');
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return error(400, 'Invalid request.');
    const input = body as Record<string, unknown>;
    const type = input.type;
    const data = input.data;
    if (!data || typeof data !== 'object') return error(400, 'Missing data.');
    const code = resolveBranchCode(typeof input.branchCode === 'string' ? input.branchCode : null, session.user.branch);
    if (!code) return error(400, 'Unknown branch.');
    if (session.user.role !== 'superadmin' && BRANCH_NAME_TO_CODE[session.user.branch] !== code) return error(403, 'Forbidden');
    const branch = branchNameForCode(code);
    if (!branch) return error(404, 'Branch not found.');
    if (type !== 'student' && type !== 'branch_student_directory') return error(410, 'This operation is not enabled until its Firestore transaction and projection are deployed.');
    if (type === 'branch_student_directory' && !['superadmin', 'admin', 'hr'].includes(session.user.role)) return error(403, 'Forbidden');
    if (type === 'student' && !['superadmin', 'admin', 'hr', 'employee'].includes(session.user.role)) return error(403, 'Forbidden');

    const student = data as Record<string, unknown>;
    const studentId = typeof student.studentId === 'string' ? student.studentId.trim() : '';
    const studentName = typeof student.studentName === 'string' ? student.studentName.trim() : '';
    const mentorStaffId = type === 'student' ? String(input.staffId || session.user.id) : String(student.mentorStaffId || '');
    if (!/^[A-Za-z0-9_-]{2,80}$/.test(studentId) || studentName.length < 2 || studentName.length > 120 || !mentorStaffId) return error(400, 'Student ID, name, and mentor are required.');
    if (!await canAccessStaff({ id: session.user.id, role: session.user.role, branch: session.user.branch }, mentorStaffId, code)) return error(403, 'Mentor must belong to your branch.');
    if (type === 'student' && !await canAccessStaff({ id: session.user.id, role: session.user.role, branch: session.user.branch }, String(input.staffId || session.user.id), code)) return error(403, 'Forbidden');
    const existingStudent = (await getFirestoreStudents()).find(record => record.studentId === studentId);
    if (existingStudent && existingStudent.branch !== branch) return error(409, 'That student ID is already registered to another branch.');
    if (existingStudent && session.user.role === 'employee' && existingStudent.mentorStaffId !== session.user.id) return error(403, 'Only the assigned mentor can update this student.');
    const email = typeof student.email === 'string' ? student.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(400, 'A valid student email is required.');
    const admissionDate = typeof student.admissionDate === 'string' ? student.admissionDate : '';
    const endDate = typeof student.endDate === 'string' ? student.endDate : '';
    const validDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const timestamp = Date.parse(`${value}T00:00:00Z`);
      return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
    };
    if (!validDate(admissionDate) || !validDate(endDate) || endDate < admissionDate) return error(400, 'Enter a valid admission date and an end date on or after it.');
    const feeStatus = String(student.feeStatus || '');
    const projectStatus = String(student.projectStatus || '');
    const studentStatus = String(student.studentStatus || 'active');
    if (!['paid', 'partial', 'pending'].includes(feeStatus) || !['completed', 'in_progress'].includes(projectStatus) || !['active', 'inactive', 'completed'].includes(studentStatus)) {
      return error(400, 'Select valid student, fee, and project statuses.');
    }
    if (String(student.college || '').length > 150 || String(student.domain || '').length > 150 || String(student.mobile || '').length > 40) return error(400, 'Student details exceed allowed lengths.');

    const persisted = await syncStudentToFirestore({
      studentId, studentName, branch,
      college: String(student.college || '').slice(0, 150), department: String(student.department || '').slice(0, 150),
      year: String(student.year || '').slice(0, 30), email,
      mobile: String(student.mobile || '').slice(0, 40), course: String(student.course || '').slice(0, 150),
      domain: String(student.domain || '').slice(0, 150), mentorStaffId,
      mentorName: String(student.mentorName || (mentorStaffId === session.user.id ? session.user.name : '')).slice(0, 120),
      admissionDate, endDate,
      feeStatus, projectStatus,
      projectTitle: String(student.projectTitle || '').slice(0, 200),
      studentStatus,
      actor: { id: session.user.id, name: session.user.name, role: session.user.role },
    });
    if (!persisted) return error(503, 'Student could not be saved to Firestore.');
    return NextResponse.json({ success: true, projection: 'pending', message: 'Student saved to Firestore; branch projection is pending.' }, { status: existingStudent ? 200 : 201, headers: PRIVATE_HEADERS });
  } catch {
    return error(503, 'Student could not be saved.');
  }
}
