/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Audit.gs
 * DESCRIPTION: Centralized Audit Logging to '09_Audit_Log' & Cloud Firestore
 * ============================================================================
 */

const Audit = {
  HEADERS: [
    'Timestamp',
    'User_ID',
    'User_Name',
    'Role',
    'Action',
    'Module',
    'Record_ID',
    'Branch_ID',
    'Old_Value',
    'New_Value'
  ],

  /**
   * Initializes or formats the 09_Audit_Log sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  initAuditSheet(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.AUDIT_LOG);
    if (sheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sheet, this.HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
    }
    return sheet;
  },

  /**
   * Logs an action with full metadata into 09_Audit_Log
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.userName
   * @param {string} params.role
   * @param {string} params.action - e.g. "Create", "Update", "Approve", "Reject", "Task Status Change", "Login", "Logout"
   * @param {string} params.module - e.g. "Employee", "Task", "Attendance", "Student", "Admin"
   * @param {string} params.recordId - e.g. "EMP_GSS001", "TASK_001"
   * @param {string} [params.branchId]
   * @param {string|Object} [params.oldValue='']
   * @param {string|Object} [params.newValue='']
   */
  logAction(params) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = this.initAuditSheet(ss);

      const timestamp = Utils.formatDateTime(Utils.getNowIST());
      const branchId = params.branchId || GSS_CONFIG.BRANCHES.BRANCH_01.ID;
      const oldValStr = typeof params.oldValue === 'object' ? JSON.stringify(params.oldValue) : String(params.oldValue || '');
      const newValStr = typeof params.newValue === 'object' ? JSON.stringify(params.newValue) : String(params.newValue || '');

      const rowData = [
        timestamp,
        params.userId || 'SYSTEM',
        params.userName || 'System Engine',
        params.role || 'SYSTEM',
        params.action || 'Unknown',
        params.module || 'General',
        params.recordId || '-',
        branchId,
        oldValStr,
        newValStr
      ];

      sheet.appendRow(rowData);

      // Apply light zebra styling on the newly added row
      const newRowIdx = sheet.getLastRow();
      if (newRowIdx % 2 === 0) {
        sheet.getRange(newRowIdx, 1, 1, this.HEADERS.length).setBackground(GSS_CONFIG.UI_COLORS.ZEBRA_ROW_BG);
      }

      // Optional async sync to Firestore if configured
      if (typeof Firebase !== 'undefined' && Firebase.isConfigured && Firebase.isConfigured()) {
        Firebase.syncAuditEntry({
          timestamp: new Date().toISOString(),
          userId: params.userId,
          userName: params.userName,
          role: params.role,
          action: params.action,
          module: params.module,
          recordId: params.recordId,
          branchId: branchId,
          oldValue: oldValStr,
          newValue: newValStr
        });
      }
    } catch (err) {
      Logger.log(`[Audit.logAction ERROR] Failed to record audit log: ${err.message}`);
    }
  }
};
