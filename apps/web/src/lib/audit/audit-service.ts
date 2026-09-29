import { randomUUID } from 'crypto';
import { getAdminFirestore } from '../firebase/firebase-admin';
import type { Query } from 'firebase-admin/firestore';

export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: string;
  action: string;
  module: string;
  recordId: string;
  branch: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<string> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Audit storage is unavailable.');
  const timestamp = new Date().toISOString();
  const id = `audit_${randomUUID()}`;
  const auditRef = db.collection('audit_logs').doc(id);
  const outboxRef = db.collection('projection_jobs').doc(`audit:${id}`);
  const fullEntry: AuditLogEntry = { ...entry, id, timestamp };
  await db.runTransaction(async transaction => {
    transaction.create(auditRef, { ...fullEntry, createdAt: timestamp });
    transaction.create(outboxRef, {
      id: outboxRef.id, type: 'audit.project', entityId: id,
      branchId: entry.branch, state: 'pending', attempts: 0, createdAt: timestamp,
    });
  });
  return id;
}

export async function getAuditLogs(options?: {
  branch?: string;
  limit?: number;
  module?: string;
}): Promise<AuditLogEntry[]> {
  const db = getAdminFirestore();
  if (!db) throw new Error('Audit storage is unavailable.');
  let query: Query = db.collection('audit_logs');
  if (options?.branch && !['All', 'all'].includes(options.branch)) query = query.where('branch', '==', options.branch);
  if (options?.module && options.module !== 'all') query = query.where('module', '==', options.module);
  const limit = Math.min(100, Math.max(1, Number.isFinite(options?.limit) ? Number(options?.limit) : 50));
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map(doc => doc.data() as AuditLogEntry)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
