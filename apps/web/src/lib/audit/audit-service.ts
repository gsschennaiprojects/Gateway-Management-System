import { getAdminFirestore } from '../firebase/firebase-admin';
import type { Query } from 'firebase-admin/firestore';
import { getSheetsApi } from '../sheets/sheets-service';
import { BRANCH_SPREADSHEET_MAP } from '../seed-branches';

export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  action: string; // e.g. 'USER_REGISTERED', 'USER_APPROVED', 'TASK_CREATED', 'TASK_COMPLETED', 'STUDENT_ADDED', 'ATTENDANCE_PUNCH'
  module: string; // e.g. 'AUTH', 'TASKS', 'STUDENTS', 'WORKLOGS', 'ATTENDANCE'
  recordId: string;
  branch: string; // e.g. 'Chennai', 'Coimbatore', 'Madurai', 'Erode', or 'CHN', 'CBE'
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

function resolveBranchCode(branch: string): string {
  const b = (branch || '').toLowerCase();
  if (b.includes('chennai') || b === 'chn') return 'CHN';
  if (b.includes('coimbatore') || b === 'cbe') return 'CBE';
  if (b.includes('madurai') || b === 'mdu') return 'MDU';
  if (b.includes('erode') || b === 'erd') return 'ERD';
  return 'CBE';
}

/**
 * Enterprise Audit Logger: Dual-persists structured audit entries to
 * Firestore `audit_logs` and Google Sheets `09_System_Audit_Log`.
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<string> {
  const timestamp = new Date().toISOString();
  const logId = `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const fullEntry: AuditLogEntry = {
    ...entry,
    id: logId,
    timestamp,
  };

  // 1. Dual persistence: Firestore audit_logs
  try {
    const db = getAdminFirestore();
    if (db) {
      await db.collection('audit_logs').doc(logId).set({
        ...fullEntry,
        createdAt: timestamp,
      });
    }
  } catch (err: any) {
    console.warn('[AuditService] Firestore write non-blocking warning:', err.message);
  }

  // 2. Dual persistence: Google Sheets `09_System_Audit_Log`
  try {
    const branchCode = resolveBranchCode(entry.branch);
    const spreadsheetId = BRANCH_SPREADSHEET_MAP[branchCode];
    if (spreadsheetId) {
      const sheetsApi = await getSheetsApi();
      const rowData = [
        logId,
        timestamp,
        entry.userId || 'SYSTEM',
        entry.userName || 'Anonymous',
        entry.role || 'system',
        entry.action,
        entry.module,
        entry.recordId || 'N/A',
        branchCode,
        entry.oldValue || '',
        entry.newValue || '',
        entry.ipAddress || '127.0.0.1',
      ];

      await sheetsApi.spreadsheets.values.append({
        spreadsheetId,
        range: '09_System_Audit_Log!A:L',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowData],
        },
      });
    }
  } catch (err: any) {
    console.warn('[AuditService] Sheets audit append non-blocking warning:', err.message);
  }

  return logId;
}

/**
 * Retrieve recent audit logs from Firestore for administrative viewing.
 */
export async function getAuditLogs(options?: {
  branch?: string;
  limit?: number;
  module?: string;
}): Promise<AuditLogEntry[]> {
  try {
    const db = getAdminFirestore();
    if (!db) return [];

    let query: Query = db.collection('audit_logs');

    if (options?.branch && options.branch !== 'All' && options.branch !== 'all') {
      const bCode = resolveBranchCode(options.branch);
      query = query.where('branch', '==', bCode);
    }

    if (options?.module && options.module !== 'all') {
      query = query.where('module', '==', options.module);
    }

    const snap = await query.limit(options?.limit || 50).get();

    const logs: AuditLogEntry[] = [];
    for (const doc of snap.docs) {
      logs.push(doc.data() as AuditLogEntry);
    }

    // Sort by timestamp desc
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err: any) {
    console.error('[AuditService] Failed to read audit logs:', err.message);
    return [];
  }
}
