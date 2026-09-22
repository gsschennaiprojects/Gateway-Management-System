/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Employee.gs
 * DESCRIPTION: Employee Master Registry & Automated Dedicated Sub-Sheet Generation
 * ============================================================================
 */

const Employee = {
  HEADERS: [
    'Employee_ID',
    'Employee_Name',
    'Branch_ID',
    'Email',
    'Mobile',
    'Designation',
    'Department',
    'Domain',
    'Joining_Date',
    'Reporting_Manager',
    'HR_ID',
    'Admin_ID',
    'Employment_Type',
    'Status',
    'Firebase_UID',
    'Account_Status',
    'Created_Date',
    'Updated_Date'
  ],

  WORKING_PROGRESS_HEADERS: [
    'Day',
    'Date',
    'Employee_ID',
    'Employee_Name',
    'Login_Time',
    'Planned_Task',
    'Task_ID',
    'Completed_Task',
    'Pending_Task',
    'Logout_Time',
    'Reason_For_Not_Completed',
    'Status',
    'Working_Hours',
    'Remarks'
  ],

  STUDENT_DETAILS_HEADERS: [
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
    'Training_Type',
    'Tutor_ID',
    'Tutor_Name',
    'Assigned_Date',
    'Start_Date',
    'Expected_End_Date',
    'Actual_End_Date',
    'Fee_Status',
    'Project_Status',
    'Student_Status',
    'Remarks',
    'Created_Date',
    'Updated_Date'
  ],

  STUDENT_PROGRESS_HEADERS: [
    'Progress_ID',
    'Student_ID',
    'Student_Name',
    'Day',
    'Date',
    'Topic',
    'Task',
    'Task_Status',
    'Progress_Percentage',
    'Practical_Completed',
    'Assignment_Status',
    'Test_Status',
    'Remarks',
    'Next_Task',
    'Updated_Date'
  ],

  /**
   * Initializes or formats the 01_Employee_Details sheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  initEmployeeSheet(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.EMPLOYEE_DETAILS);
    if (sheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sheet, this.HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      
      // Column validations
      Utils.setDropdownValidation(sheet, 13, ['Full Time', 'Part Time', 'Contract', 'Intern', 'Trainee']);
      Utils.setDropdownValidation(sheet, 14, ['Active', 'Inactive', 'On Leave', 'Terminated']);
      Utils.setDropdownValidation(sheet, 16, ['Pending Approval', 'Active', 'Suspended', 'Rejected']);
    }
    return sheet;
  },

  /**
   * Registers a new employee into 01_Employee_Details with Pending status
   * @param {Object} data
   * @returns {{ success: boolean, message: string, employeeId?: string }}
   */
  registerEmployee(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initEmployeeSheet(ss);

    const empId = data.Employee_ID || Utils.generateUniqueId('EMP_GSS', sheet.getLastRow());

    // Duplicate checks
    if (!Validation.isUnique(sheet, 1, empId)) {
      return { success: false, message: `Employee ID ${empId} already exists.` };
    }
    if (data.Email && !Validation.isUnique(sheet, 4, data.Email)) {
      return { success: false, message: `Email ${data.Email} is already registered.` };
    }
    if (data.Mobile && !Validation.isUnique(sheet, 5, data.Mobile)) {
      return { success: false, message: `Mobile ${data.Mobile} is already registered.` };
    }

    const todayStr = Utils.formatDate(Utils.getNowIST());
    const row = [
      empId,
      data.Employee_Name || '',
      data.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      data.Email || '',
      data.Mobile || '',
      data.Designation || 'Software Engineer',
      data.Department || 'Engineering',
      data.Domain || 'Full Stack',
      data.Joining_Date || todayStr,
      data.Reporting_Manager || 'Admin',
      data.HR_ID || 'HR_GSS001',
      data.Admin_ID || 'ADMIN_GSS001',
      data.Employment_Type || 'Full Time',
      'Inactive', // Activated upon approval
      data.Firebase_UID || `fb_${empId.toLowerCase()}`,
      'Pending Approval',
      todayStr,
      todayStr
    ];

    sheet.appendRow(row);

    Audit.logAction({
      userId: empId,
      userName: data.Employee_Name,
      role: 'EMPLOYEE',
      action: 'Create',
      module: 'Employee',
      recordId: empId,
      branchId: data.Branch_ID,
      oldValue: '',
      newValue: 'Pending Approval'
    });

    return { success: true, message: `Employee ${empId} registered successfully in Pending state.`, employeeId: empId };
  },

  /**
   * Approves an employee, activates status, and automatically creates their 3 dedicated sheets
   * @param {string} employeeId
   * @param {string} [approverId='ADMIN_GSS001']
   * @param {string} [approverName='Branch Admin']
   * @returns {{ success: boolean, message: string }}
   */
  approveEmployee(employeeId, approverId = 'ADMIN_GSS001', approverName = 'Branch Admin') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = this.initEmployeeSheet(ss);

    const rowIdx = Utils.findRowIndex(sheet, 1, employeeId);
    if (rowIdx === -1) {
      return { success: false, message: `Employee with ID ${employeeId} not found.` };
    }

    const empName = sheet.getRange(rowIdx, 2).getValue();
    const branchId = sheet.getRange(rowIdx, 3).getValue();
    const todayStr = Utils.formatDate(Utils.getNowIST());

    // Update status to Active
    sheet.getRange(rowIdx, 14).setValue('Active');           // Status
    sheet.getRange(rowIdx, 16).setValue('Active');           // Account_Status
    sheet.getRange(rowIdx, 18).setValue(todayStr);          // Updated_Date

    // Create exactly the 3 dedicated sheets for this employee
    this.createPersonalSheets(ss, employeeId, empName, branchId);

    // Audit log
    Audit.logAction({
      userId: approverId,
      userName: approverName,
      role: 'ADMIN',
      action: 'Approve',
      module: 'Employee',
      recordId: employeeId,
      branchId: branchId,
      oldValue: 'Pending Approval',
      newValue: 'Active'
    });

    // Sync profile to Firestore
    const employeeObj = Utils.getSheetDataAsObjects(sheet).find(e => e.Employee_ID === employeeId);
    if (employeeObj) {
      Firebase.syncUserToFirestore(employeeObj);
    }

    return {
      success: true,
      message: `Employee ${employeeId} (${empName}) approved. Dedicated 3 operational sheets successfully generated.`
    };
  },

  /**
   * Generates the exactly 3 required personal sheets for an employee:
   * 1. EMP_<ID>_Working_Progress
   * 2. EMP_<ID>_Student_Details
   * 3. EMP_<ID>_Student_Progress
   * 
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} empId
   * @param {string} empName
   * @param {string} branchId
   */
  createPersonalSheets(ss, empId, empName, branchId) {
    const wpSheetName = `EMP_${empId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
    const sdSheetName = `EMP_${empId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_DETAILS}`;
    const spSheetName = `EMP_${empId}_${GSS_CONFIG.PERSONAL_SUFFIXES.STUDENT_PROGRESS}`;

    // 1. Working Progress Sheet
    const wpSheet = Utils.getOrCreateSheet(ss, wpSheetName);
    if (wpSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(wpSheet, this.WORKING_PROGRESS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      // Data validations
      Utils.setDropdownValidation(wpSheet, 8, ['Yes', 'No', 'Partially']); // Completed_Task
      Utils.setDropdownValidation(wpSheet, 12, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']); // Status
    }

    // 2. Student Details Sheet
    const sdSheet = Utils.getOrCreateSheet(ss, sdSheetName);
    if (sdSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(sdSheet, this.STUDENT_DETAILS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(sdSheet, 18, ['Paid', 'Partial', 'Pending']); // Fee_Status
      Utils.setDropdownValidation(sdSheet, 19, ['Not Started', 'Ongoing', 'Under Review', 'Completed']); // Project_Status
      Utils.setDropdownValidation(sdSheet, 20, ['Active', 'Completed', 'Discontinued']); // Student_Status
    }

    // 3. Student Progress Sheet
    const spSheet = Utils.getOrCreateSheet(ss, spSheetName);
    if (spSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(spSheet, this.STUDENT_PROGRESS_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(spSheet, 8, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']); // Task_Status
      Utils.setDropdownValidation(spSheet, 10, ['Yes', 'No', 'Under Review']); // Practical_Completed
      Utils.setDropdownValidation(spSheet, 11, ['Submitted', 'Pending', 'Evaluated']); // Assignment_Status
      Utils.setDropdownValidation(spSheet, 12, ['Passed', 'Failed', 'Pending']); // Test_Status
    }
  }
};
