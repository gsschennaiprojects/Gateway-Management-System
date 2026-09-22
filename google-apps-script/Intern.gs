/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Intern.gs
 * DESCRIPTION: Intern Master Registry & Dedicated Operational Sheet Generation
 * ============================================================================
 */

const Intern = {
  HEADERS: [
    'Intern_ID',
    'Intern_Name',
    'Branch_ID',
    'College',
    'Department',
    'Domain',
    'Mentor_ID',
    'Mentor_Name',
    'Joining_Date',
    'End_Date',
    'Project',
    'Project_Status',
    'Status',
    'Firebase_UID',
    'Account_Status',
    'Created_Date',
    'Updated_Date'
  ],

  /**
   * Initializes or retrieves 04_Intern_Details sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  initInternSheet(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, '04_Intern_Details');
    if (sheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sheet, this.HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(sheet, 12, ['Not Started', 'Ongoing', 'Under Review', 'Completed']); // Project_Status
      Utils.setDropdownValidation(sheet, 13, ['Active', 'Completed', 'Discontinued']); // Status
      Utils.setDropdownValidation(sheet, 15, ['Pending Approval', 'Active', 'Suspended', 'Rejected']); // Account_Status
    }
    return sheet;
  },

  /**
   * Registers an intern into 04_Intern_Details
   * @param {Object} data
   * @returns {{ success: boolean, message: string, internId?: string }}
   */
  registerIntern(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initInternSheet(ss);

    const internId = data.Intern_ID || Utils.generateUniqueId('INT_GSS', sheet.getLastRow());

    if (!Validation.isUnique(sheet, 1, internId)) {
      return { success: false, message: `Intern ID ${internId} already exists.` };
    }

    const todayStr = Utils.formatDate(Utils.getNowIST());
    const row = [
      internId,
      data.Intern_Name || '',
      data.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      data.College || '',
      data.Department || '',
      data.Domain || 'Web Development',
      data.Mentor_ID || 'EMP_GSS001',
      data.Mentor_Name || 'Senior Mentor',
      data.Joining_Date || todayStr,
      data.End_Date || '',
      data.Project || 'Internal Project',
      'Ongoing',
      'Inactive',
      data.Firebase_UID || `fb_${internId.toLowerCase()}`,
      'Pending Approval',
      todayStr,
      todayStr
    ];

    sheet.appendRow(row);

    Audit.logAction({
      userId: internId,
      userName: data.Intern_Name,
      role: 'INTERN',
      action: 'Create',
      module: 'Intern',
      recordId: internId,
      branchId: data.Branch_ID,
      oldValue: '',
      newValue: 'Pending Approval'
    });

    return { success: true, message: `Intern ${internId} registered in Pending state.`, internId };
  },

  /**
   * Approves Intern and creates their 3 personal sheets
   * @param {string} internId
   * @param {string} [approverId='ADMIN_GSS001']
   * @returns {{ success: boolean, message: string }}
   */
  approveIntern(internId, approverId = 'ADMIN_GSS001') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initInternSheet(ss);

    const rowIdx = Utils.findRowIndex(sheet, 1, internId);
    if (rowIdx === -1) {
      return { success: false, message: `Intern ${internId} not found.` };
    }

    const internName = sheet.getRange(rowIdx, 2).getValue();
    const branchId = sheet.getRange(rowIdx, 3).getValue();
    const todayStr = Utils.formatDate(Utils.getNowIST());

    sheet.getRange(rowIdx, 13).setValue('Active');          // Status
    sheet.getRange(rowIdx, 15).setValue('Active');          // Account_Status
    sheet.getRange(rowIdx, 17).setValue(todayStr);        // Updated_Date

    this.createPersonalSheets(ss, internId, internName, branchId);

    Audit.logAction({
      userId: approverId,
      userName: 'Branch Admin',
      role: 'ADMIN',
      action: 'Approve',
      module: 'Intern',
      recordId: internId,
      branchId: branchId,
      oldValue: 'Pending Approval',
      newValue: 'Active'
    });

    const internObj = Utils.getSheetDataAsObjects(sheet).find(i => i.Intern_ID === internId);
    if (internObj) {
      Firebase.syncUserToFirestore({
        ...internObj,
        role: 'INTERN',
        name: internName,
        employeeId: internId
      });
    }

    return {
      success: true,
      message: `Intern ${internId} (${internName}) approved. Dedicated 3 operational sheets generated.`
    };
  },

  /**
   * Generates the 3 dedicated operational sheets for Intern:
   * 1. INT_<ID>_Working_Progress
   * 2. INT_<ID>_Student_Details
   * 3. INT_<ID>_Student_Progress
   * 
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} internId
   * @param {string} internName
   * @param {string} branchId
   */
  createPersonalSheets(ss, internId, internName, branchId) {
    const wpSheetName = `INT_${internId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
    const sdSheetName = `INT_${internId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_DETAILS}`;
    const spSheetName = `INT_${internId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_PROGRESS}`;

    // 1. Working Progress
    const wpSheet = Utils.getOrCreateSheet(ss, wpSheetName);
    if (wpSheet.getLastRow() === 0) {
      const headers = [...Employee.WORKING_PROGRESS_HEADERS];
      headers[2] = 'Intern_ID';
      headers[3] = 'Intern_Name';
      Utils.formatHeaderRow(wpSheet, headers, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(wpSheet, 8, ['Yes', 'No', 'Partially']);
      Utils.setDropdownValidation(wpSheet, 12, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']);
    }

    // 2. Student Details
    const sdSheet = Utils.getOrCreateSheet(ss, sdSheetName);
    if (sdSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sdSheet, Employee.STUDENT_DETAILS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
    }

    // 3. Student Progress
    const spSheet = Utils.getOrCreateSheet(ss, spSheetName);
    if (spSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(spSheet, Employee.STUDENT_PROGRESS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(spSheet, 8, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']);
    }
  }
};
