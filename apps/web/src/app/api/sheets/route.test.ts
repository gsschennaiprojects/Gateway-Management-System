import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getFirestoreStudents, getFirestoreUserById, getFirestoreWorklogs, syncStudentToFirestore } from '@/lib/firebase/firebase-admin';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/firebase/firebase-admin', () => ({
  getFirestoreStudents: jest.fn(), getFirestoreTasks: jest.fn(), getFirestoreUserById: jest.fn(),
  getFirestoreUsers: jest.fn(), getFirestoreWorklogs: jest.fn(), syncStudentToFirestore: jest.fn(),
}));

describe('GET /api/sheets', () => {
  it('denies branch requests outside the current admin branch before reading data', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'ADM-1', role: 'admin', branch: 'Chennai' } });
    const request = new NextRequest('http://localhost/api/sheets?type=worklog&branchCode=CBE&staffId=EMP-1');
    const response = await GET(request);
    expect(response.status).toBe(403);
    expect(getFirestoreWorklogs).not.toHaveBeenCalled();
  });

  it('returns no-store cache policy for private operational data', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'EMP-1', role: 'employee', branch: 'Chennai' } });
    (getFirestoreWorklogs as jest.Mock).mockResolvedValue([]);
    const request = new NextRequest('http://localhost/api/sheets?type=worklog&staffId=EMP-1');
    const response = await GET(request);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  });

  it('denies student writes to another branch', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'ADM-1', name: 'Branch Admin', role: 'admin', branch: 'Chennai' } });
    const request = new NextRequest('http://localhost/api/sheets', {
      method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'student', branchCode: 'CBE', staffId: 'ADM-1', data: { studentId: 'std_1', studentName: 'Student' } }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(syncStudentToFirestore).not.toHaveBeenCalled();
  });

  it('persists student enrollments through the canonical Firestore helper', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'ADM-1', name: 'Branch Admin', role: 'admin', branch: 'Chennai' } });
    (getFirestoreStudents as jest.Mock).mockResolvedValue([]);
    (getFirestoreUserById as jest.Mock).mockResolvedValue(null);
    (syncStudentToFirestore as jest.Mock).mockResolvedValue(true);
    const request = new NextRequest('http://localhost/api/sheets', {
      method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'student', branchCode: 'CHN', staffId: 'ADM-1', data: {
        studentId: 'std_1', studentName: 'Test Student', email: 'student@example.com', college: 'Test College', domain: 'Data Science',
        admissionDate: '2026-09-01', endDate: '2026-12-01', feeStatus: 'pending', projectStatus: 'in_progress', studentStatus: 'active',
      } }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(syncStudentToFirestore).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'std_1', actor: { id: 'ADM-1', name: 'Branch Admin', role: 'admin' } }));
  });
});
