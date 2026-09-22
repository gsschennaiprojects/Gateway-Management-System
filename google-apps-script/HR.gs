/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: HR.gs
 * DESCRIPTION: HR Master Registry & Dedicated 3-Sheet Generation for Branch HR
 * ============================================================================
 */

const HR = {
  HEADERS: [
    'HR_ID',
    'HR_Name',
    'Branch_ID',
    'Email',
    'Mobile',
    'Designation',
    'Joining_Date',
    'Reporting_Manager',
    'Status',
    'Firebase_UID',
    'Account_Status',
    'Created_Date',
    'Updated_Date'
  ],

  /**
   * Initializes or formats 02_HR_Details sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  initHRSheet(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.HR_DETAILS);
    if (sheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sheet, this.HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(sheet, 9, ['Active', 'Inactive', 'On Leave']); // Status
      Utils.setDropdownValidation(sheet, 11, ['Pending Approval', 'Active', 'Suspended', 'Rejected']); // Account_Status
    }
    return sheet;
  },

  /**
   * Registers a new HR record into 02_HR_Details
   * @param {Object} data
   * @returns {{ success: boolean, message: string, hrId?: string }}
   */
  registerHR(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initHRSheet(ss);

    const hrId = data.HR_ID || Utils.generateUniqueId('HR_GSS', sheet.getLastRow());

    if (!Validation.isUnique(sheet, 1, hrId)) {
      return { success: false, message: `HR ID ${hrId} already exists.` };
    }
    if (data.Email && !Validation.isUnique(sheet, 4, data.Email)) {
      return { success: false, message: `Email ${data.Email} is already registered.` };
    }

    const todayStr = Utils.formatDate(Utils.getNowIST());
    const row = [
      hrId,
      data.HR_Name || '',
      data.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      data.Email || '',
      data.Mobile || '',
      data.Designation || 'HR Executive',
      data.Joining_Date || todayStr,
      data.Reporting_Manager || 'Branch Admin',
      'Inactive',
      data.Firebase_UID || `fb_${hrId.toLowerCase()}`,
      'Pending Approval',
      todayStr,
      todayStr
    ];

    sheet.appendRow(row);

    Audit.logAction({
      userId: hrId,
      userName: data.HR_Name,
      role: 'HR',
      action: 'Create',
      module: 'HR',
      recordId: hrId,
      branchId: data.Branch_ID,
      oldValue: '',
      newValue: 'Pending Approval'
    });

    return { success: true, message: `HR ${hrId} registered successfully in Pending state.`, hrId: hrId };
  },

  /**
   * Approves HR record, marks status Active, and generates the 3 dedicated operational sheets
   * @param {string} hrId
   * @param {string} [approverId='ADMIN_GSS001']
   * @returns {{ success: boolean, message: string }}
   */
  approveHR(hrId, approverId = 'ADMIN_GSS001') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initHRSheet(ss);

    const rowIdx = Utils.findRowIndex(sheet, 1, hrId);
    if (rowIdx === -1) {
      return { success: false, message: `HR member with ID ${hrId} not found.` };
    }

    const hrName = sheet.getRange(rowIdx, 2).getValue();
    const branchId = sheet.getRange(rowIdx, 3).getValue();
    const todayStr = Utils.formatDate(Utils.getNowIST());

    sheet.getRange(rowIdx, 9).setValue('Active');           // Status
    sheet.getRange(rowIdx, 11).setValue('Active');          // Account_Status
    sheet.getRange(rowIdx, 13).setValue(todayStr);         // Updated_Date

    this.createPersonalSheets(ss, hrId, hrName, branchId);

    Audit.logAction({
      userId: approverId,
      userName: 'Branch Admin',
      role: 'ADMIN',
      action: 'Approve',
      module: 'HR',
      recordId: hrId,
      branchId: branchId,
      oldValue: 'Pending Approval',
      newValue: 'Active'
    });

    const hrObj = Utils.getSheetDataAsObjects(sheet).find(h => h.HR_ID === hrId);
    if (hrObj) {
      Firebase.syncUserToFirestore({
        ...hrObj,
        role: 'HR',
        name: hrName,
        employeeId: hrId
      });
    }

    return {
      success: true,
      message: `HR ${hrId} (${hrName}) approved. Dedicated 3 operational sheets created.`
    };
  },

  /**
   * Automatically generates the 3 dedicated sheets for HR:
   * 1. HR_<ID>_Working_Progress
   * 2. HR_<ID>_Student_Details
   * 3. HR_<ID>_Student_Progress
   * 
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} hrId
   * @param {string} hrName
   * @param {string} branchId
   */
  createPersonalSheets(ss, hrId, hrName, branchId) {
    const wpSheetName = `HR_${hrId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
    const sdSheetName = `HR_${hrId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_DETAILS}`;
    const spSheetName = `HR_${hrId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_PROGRESS}`;

    // 1. Working Progress
    const wpSheet = Utils.getOrCreateSheet(ss, wpSheetName);
    if (wpSheet.getLastRow() === 0) {
      const headers = [...Employee.WORKING_PROGRESS_HEADERS];
      headers[2] = 'HR_ID';
      headers[3] = 'HR_Name';
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
