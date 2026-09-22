/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Admin.gs
 * DESCRIPTION: Admin Master Registry & Dedicated 3-Sheet Generation for Branch Admin
 * ============================================================================
 */

const Admin = {
  HEADERS: [
    'Admin_ID',
    'Admin_Name',
    'Branch_ID',
    'Email',
    'Mobile',
    'Designation',
    'Joining_Date',
    'Permissions',
    'Status',
    'Firebase_UID',
    'Account_Status',
    'Created_Date',
    'Updated_Date'
  ],

  /**
   * Initializes or formats 03_Admin_Details sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  initAdminSheet(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.ADMIN_DETAILS);
    if (sheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sheet, this.HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(sheet, 9, ['Active', 'Inactive', 'Suspended']); // Status
      Utils.setDropdownValidation(sheet, 11, ['Pending Approval', 'Active', 'Suspended', 'Rejected']); // Account_Status
    }
    return sheet;
  },

  /**
   * Registers a new Admin into 03_Admin_Details
   * @param {Object} data
   * @returns {{ success: boolean, message: string, adminId?: string }}
   */
  registerAdmin(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initAdminSheet(ss);

    const adminId = data.Admin_ID || Utils.generateUniqueId('ADMIN_GSS', sheet.getLastRow());

    if (!Validation.isUnique(sheet, 1, adminId)) {
      return { success: false, message: `Admin ID ${adminId} already exists.` };
    }
    if (data.Email && !Validation.isUnique(sheet, 4, data.Email)) {
      return { success: false, message: `Email ${data.Email} is already registered.` };
    }

    const todayStr = Utils.formatDate(Utils.getNowIST());
    const row = [
      adminId,
      data.Admin_Name || '',
      data.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      data.Email || '',
      data.Mobile || '',
      data.Designation || 'Branch Administrator',
      data.Joining_Date || todayStr,
      data.Permissions || 'BRANCH_FULL_ACCESS',
      'Inactive',
      data.Firebase_UID || `fb_${adminId.toLowerCase()}`,
      'Pending Approval',
      todayStr,
      todayStr
    ];

    sheet.appendRow(row);

    Audit.logAction({
      userId: adminId,
      userName: data.Admin_Name,
      role: 'ADMIN',
      action: 'Create',
      module: 'Admin',
      recordId: adminId,
      branchId: data.Branch_ID,
      oldValue: '',
      newValue: 'Pending Approval'
    });

    return { success: true, message: `Admin ${adminId} registered in Pending state.`, adminId: adminId };
  },

  /**
   * Approves Admin record, activates, and creates dedicated operational sheets
   * @param {string} adminId
   * @param {string} [approverId='SUPER_ADMIN_01']
   * @returns {{ success: boolean, message: string }}
   */
  approveAdmin(adminId, approverId = 'SUPER_ADMIN_01') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initAdminSheet(ss);

    const rowIdx = Utils.findRowIndex(sheet, 1, adminId);
    if (rowIdx === -1) {
      return { success: false, message: `Admin with ID ${adminId} not found.` };
    }

    const adminName = sheet.getRange(rowIdx, 2).getValue();
    const branchId = sheet.getRange(rowIdx, 3).getValue();
    const todayStr = Utils.formatDate(Utils.getNowIST());

    sheet.getRange(rowIdx, 9).setValue('Active');           // Status
    sheet.getRange(rowIdx, 11).setValue('Active');          // Account_Status
    sheet.getRange(rowIdx, 13).setValue(todayStr);         // Updated_Date

    this.createPersonalSheets(ss, adminId, adminName, branchId);

    Audit.logAction({
      userId: approverId,
      userName: 'Super Admin',
      role: 'SUPER_ADMIN',
      action: 'Approve',
      module: 'Admin',
      recordId: adminId,
      branchId: branchId,
      oldValue: 'Pending Approval',
      newValue: 'Active'
    });

    const adminObj = Utils.getSheetDataAsObjects(sheet).find(a => a.Admin_ID === adminId);
    if (adminObj) {
      Firebase.syncUserToFirestore({
        ...adminObj,
        role: 'ADMIN',
        name: adminName,
        employeeId: adminId
      });
    }

    return {
      success: true,
      message: `Admin ${adminId} (${adminName}) approved. Dedicated operational sheets generated.`
    };
  },

  /**
   * Generates the 3 dedicated operational sheets for Admin:
   * 1. ADMIN_<ID>_Working_Progress
   * 2. ADMIN_<ID>_Student_Details
   * 3. ADMIN_<ID>_Student_Progress
   * 
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} adminId
   * @param {string} adminName
   * @param {string} branchId
   */
  createPersonalSheets(ss, adminId, adminName, branchId) {
    const wpSheetName = `ADMIN_${adminId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
    const sdSheetName = `ADMIN_${adminId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_DETAILS}`;
    const spSheetName = `ADMIN_${adminId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_PROGRESS}`;

    // 1. Working Progress
    const wpSheet = Utils.getOrCreateSheet(ss, wpSheetName);
    if (wpSheet.getLastRow() === 0) {
      const headers = [...Employee.WORKING_PROGRESS_HEADERS];
      headers[2] = 'Admin_ID';
      headers[3] = 'Admin_Name';
      Utils.formatHeaderRow(wpSheet, headers, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(wpSheet, 8, ['Yes', 'No', 'Partially']);
      Utils.setDropdownValidation(wpSheet, 12, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']);
    }

    // 2. Student Details
    const sdSheet = Utils.getOrCreateSheet(ss, sdSheetName);
    if (sdSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sdSheet, Employee.STUDENT_DETAILS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(sdSheet, 18, ['Paid', 'Partial', 'Pending']);
      Utils.setDropdownValidation(sdSheet, 19, ['Not Started', 'Ongoing', 'Under Review', 'Completed']);
      Utils.setDropdownValidation(sdSheet, 20, ['Active', 'Completed', 'Discontinued']);
    }

    // 3. Student Progress
    const spSheet = Utils.getOrCreateSheet(ss, spSheetName);
    if (spSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(spSheet, Employee.STUDENT_PROGRESS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(spSheet, 8, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']);
      Utils.setDropdownValidation(spSheet, 10, ['Yes', 'No', 'Under Review']);
      Utils.setDropdownValidation(spSheet, 11, ['Submitted', 'Pending', 'Evaluated']);
      Utils.setDropdownValidation(spSheet, 12, ['Passed', 'Failed', 'Pending']);
    }
  }
};
