/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Student.gs
 * DESCRIPTION: Central Student Registry (06_Student_Master) & Personal Student Sync
 * ============================================================================
 */

const Student = {
  MASTER_HEADERS: [
    'Student_ID',
    'Student_Name',
    'Branch_ID',
    'College',
    'Department',
    'Year',
    'Email',
    'Mobile',
    'Domain',
    'Course',
    'Assigned_To_ID',
    'Assigned_To_Name',
    'Assigned_Role',
    'Start_Date',
    'Expected_End_Date',
    'Fee_Status',
    'Project_Status',
    'Student_Status',
    'Created_Date',
    'Updated_Date'
  ],

  /**
   * Initializes 06_Student_Master sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  initStudentMaster(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.STUDENT_MASTER);
    if (sheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sheet, this.MASTER_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(sheet, 16, ['Paid', 'Partial', 'Pending']); // Fee_Status
      Utils.setDropdownValidation(sheet, 17, ['Not Started', 'Ongoing', 'Under Review', 'Completed']); // Project_Status
      Utils.setDropdownValidation(sheet, 18, ['Active', 'Completed', 'Discontinued']); // Student_Status
    }
    return sheet;
  },

  /**
   * Registers a student in 06_Student_Master and syncs into the assigned Tutor's Student_Details sheet
   * @param {Object} data
   * @returns {{ success: boolean, message: string, studentId?: string }}
   */
  registerStudent(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initStudentMaster(ss);

    const studentId = data.Student_ID || Utils.generateUniqueId('STU_GSS', sheet.getLastRow());

    // Duplicate check
    if (!Validation.isUnique(sheet, 1, studentId)) {
      return { success: false, message: `Student ID ${studentId} already exists.` };
    }
    if (data.Email && !Validation.isUnique(sheet, 7, data.Email)) {
      return { success: false, message: `Student email ${data.Email} already registered.` };
    }

    const todayStr = Utils.formatDate(Utils.getNowIST());
    const assignedId = data.Assigned_To_ID || '';
    const assignedName = data.Assigned_To_Name || '';
    const assignedRole = data.Assigned_Role || 'EMPLOYEE';

    const row = [
      studentId,
      data.Student_Name || '',
      data.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      data.College || '',
      data.Department || '',
      data.Year || 'Final Year',
      data.Email || '',
      data.Mobile || '',
      data.Domain || 'Python / AI',
      data.Course || 'Advanced Certification',
      assignedId,
      assignedName,
      assignedRole,
      data.Start_Date || todayStr,
      data.Expected_End_Date || '',
      data.Fee_Status || 'Pending',
      data.Project_Status || 'Not Started',
      data.Student_Status || 'Active',
      todayStr,
      todayStr
    ];

    sheet.appendRow(row);

    // Sync to assigned Tutor's personal Student_Details sheet
    if (assignedId) {
      this.syncToPersonalStudentDetails(ss, studentId, row);
    }

    Audit.logAction({
      userId: assignedId || 'ADMIN',
      userName: assignedName || 'Administrator',
      role: assignedRole,
      action: 'Create',
      module: 'Student',
      recordId: studentId,
      branchId: data.Branch_ID,
      oldValue: '',
      newValue: `Assigned to ${assignedId}`
    });

    Firebase.syncStudentToFirestore(data);

    return {
      success: true,
      message: `Student ${studentId} (${data.Student_Name}) registered and linked to tutor ${assignedId}.`,
      studentId
    };
  },

  /**
   * Syncs student into tutor's dedicated Student_Details sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} studentId
   * @param {Array} masterRowData
   */
  syncToPersonalStudentDetails(ss, studentId, masterRowData) {
    const assignedId = masterRowData[10];
    const assignedName = masterRowData[11];
    let prefix = 'EMP';
    if (assignedId.startsWith('HR')) prefix = 'HR';
    if (assignedId.startsWith('ADMIN')) prefix = 'ADMIN';

    const personalSheetName = `${prefix}_${assignedId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_DETAILS}`;
    const personalSheet = ss.getSheetByName(personalSheetName);
    if (!personalSheet) return;

    // Check if already in personal sheet
    const existingIdx = Utils.findRowIndex(personalSheet, 1, studentId);
    const personalRow = [
      masterRowData[0], // Student_ID
      masterRowData[1], // Student_Name
      masterRowData[2], // Branch_ID
      masterRowData[3], // College
      masterRowData[4], // Department
      masterRowData[5], // Year
      masterRowData[6], // Email
      masterRowData[7], // Mobile
      masterRowData[8], // Domain
      masterRowData[9], // Course
      'Internship/Training', // Training_Type
      assignedId,       // Tutor_ID
      assignedName,     // Tutor_Name
      masterRowData[18],// Assigned_Date
      masterRowData[13],// Start_Date
      masterRowData[14],// Expected_End_Date
      '',               // Actual_End_Date
      masterRowData[15],// Fee_Status
      masterRowData[16],// Project_Status
      masterRowData[17],// Student_Status
      'Linked from Student Master',
      masterRowData[18],// Created_Date
      masterRowData[19] // Updated_Date
    ];

    if (existingIdx === -1) {
      personalSheet.appendRow(personalRow);
    } else {
      personalSheet.getRange(existingIdx, 1, 1, personalRow.length).setValues([personalRow]);
    }
  },

  /**
   * Records daily learning/project progress in personal Student_Progress sheet
   * @param {Object} data
   * @returns {{ success: boolean, message: string }}
   */
  recordStudentDailyProgress(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tutorId = data.Tutor_ID;
    let prefix = 'EMP';
    if (tutorId.startsWith('HR')) prefix = 'HR';
    if (tutorId.startsWith('ADMIN')) prefix = 'ADMIN';

    const spSheetName = `${prefix}_${tutorId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_PROGRESS}`;
    const spSheet = ss.getSheetByName(spSheetName);

    if (!spSheet) {
      return { success: false, message: `Progress sheet ${spSheetName} not found.` };
    }

    const now = Utils.getNowIST();
    const progressId = Utils.generateUniqueId('PROG');
    const dayName = Utils.getDayName(now);
    const dateStr = Utils.formatDate(now);

    const row = [
      progressId,
      data.Student_ID,
      data.Student_Name,
      dayName,
      dateStr,
      data.Topic || 'Topic Modules',
      data.Task || 'Practical Exercises',
      data.Task_Status || 'Completed',
      data.Progress_Percentage || 100,
      data.Practical_Completed || 'Yes',
      data.Assignment_Status || 'Submitted',
      data.Test_Status || 'Passed',
      data.Remarks || '',
      data.Next_Task || '',
      dateStr
    ];

    spSheet.appendRow(row);

    Audit.logAction({
      userId: tutorId,
      userName: data.Tutor_Name || 'Tutor',
      role: prefix,
      action: 'Student Update',
      module: 'Student',
      recordId: `${data.Student_ID}_${progressId}`,
      oldValue: '',
      newValue: `${data.Topic} (${data.Progress_Percentage}%)`
    });

    return { success: true, message: `Progress recorded for ${data.Student_Name} (${data.Student_ID}).` };
  }
};
