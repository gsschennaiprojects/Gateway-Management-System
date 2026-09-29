/**
 * Firestore integration is intentionally disabled in Apps Script.
 * Firestore is canonical; the authenticated Next.js server writes canonical
 * records and enqueues spreadsheet projections. Apps Script must not use an
 * unauthenticated REST API key to write operational or identity records.
 */
const Firebase = {
  isConfigured() { return false; },
  getProperty() { return null; },
  encodeFirestoreValue() { throw new Error('Direct Apps Script Firestore access is disabled.'); },
  encodeFirestoreDocument() { throw new Error('Direct Apps Script Firestore access is disabled.'); },
  upsertDocument() { return null; },
  syncUserToFirestore() { return false; },
  syncTaskToFirestore() { return false; },
  syncStudentToFirestore() { return false; },
  syncAuditEntry() { return false; },
};
