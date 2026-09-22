/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Code.gs
 * DESCRIPTION: Custom Spreadsheet UI Menu, Interactive Dialogs & Automated Triggers
 * ============================================================================
 */

/**
 * Standard Google Apps Script entry point when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 GSS Enterprise Menu')
    .addItem('🏢 Initialize Common Branch Sheets', 'menuInitializeBranch')
    .addSeparator()
    .addItem('👤 Approve Pending Person & Generate Sheets', 'menuApprovePerson')
    .addItem('📋 Allocate Task (Multi-Employee)', 'menuCreateTask')
    .addItem('🔄 Update Task Status (In-Place)', 'menuUpdateTaskStatus')
    .addSeparator()
    .addItem('⏰ Punch In (Login Timestamp)', 'menuPunchIn')
    .addItem('🚪 Punch Out (Logout with Validation)', 'menuPunchOut')
    .addSeparator()
    .addItem('📊 Refresh Branch Dashboard', 'menuRefreshDashboard')
    .addItem('⚙️ Setup Automated Daily Triggers', 'setupSystemTriggers')
    .addToUi();
}

/**
 * Initializes all 10 common branch sheets in the active spreadsheet with enterprise styling
 */
function menuInitializeBranch() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // 00_Branch_Details
    initBranchDetailsSheet(ss);

    // 01_Employee_Details
    Employee.initEmployeeSheet(ss);

    // 02_HR_Details
    HR.initHRSheet(ss);

    // 03_Admin_Details
    Admin.initAdminSheet(ss);

    // 04_Task_Allocation & 05_Task_History
    Task.initTaskSheets(ss);

    // 06_Student_Master
    Student.initStudentMaster(ss);

    // 08_Branch_Settings
    initBranchSettingsSheet(ss);

    // 09_Audit_Log
    Audit.initAuditSheet(ss);

    // 07_Branch_Dashboard
    Dashboard.refreshDashboard(ss);

    ui.alert(
      'Initialization Complete',
      'All 10 common branch sheets have been successfully initialized with professional enterprise schemas, dropdowns, and formatting.',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Initialization Error', err.message, ui.ButtonSet.OK);
  }
}

/**
 * Initializes 00_Branch_Details
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function initBranchDetailsSheet(ss) {
  const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.BRANCH_DETAILS);
  const headers = [
    'Branch_ID',
    'Branch_Name',
    'Branch_Code',
    'Location',
    'Address',
    'Branch_Email',
    'Branch_Phone',
    'Branch_Admin_ID',
    'Branch_Admin_Name',
    'HR_ID',
    'HR_Name',
    'Opening_Date',
    'Status',
    'Created_Date',
    'Last_Updated'
  ];

  if (sheet.getLastRow() === 0) {
    Utils.formatHeaderRow(sheet, headers, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
    Utils.setDropdownValidation(sheet, 13, ['Active', 'Inactive', 'Temporarily Closed']);

    // Pre-fill branch info by automatically detecting the current spreadsheet ID
    const currentId = ss.getId();
    const branchEntry = Object.values(GSS_CONFIG.BRANCHES).find(b => b.SPREADSHEET_ID === currentId) || GSS_CONFIG.BRANCHES.BRANCH_01;

    sheet.appendRow([
      branchEntry.ID,
      branchEntry.NAME,
      branchEntry.CODE,
      branchEntry.LOCATION,
      `GSS Technology Campus, ${branchEntry.LOCATION}`,
      `${branchEntry.CODE.toLowerCase()}@gatewaysolutions.com`,
      '+91 98765 43210',
      'ADMIN_GSS001',
      'Branch Administrator',
      'HR_GSS001',
      'Senior HR Manager',
      '01-01-2022',
      'Active',
      Utils.formatDate(Utils.getNowIST()),
      Utils.formatDate(Utils.getNowIST())
    ]);
  }
  return sheet;
}

/**
 * Initializes 08_Branch_Settings
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 */
function initBranchSettingsSheet(ss) {
  const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.BRANCH_SETTINGS);
  const headers = [
    'Branch_ID',
    'Working_Start_Time',
    'Working_End_Time',
    'Lunch_Start',
    'Lunch_End',
    'Working_Days',
    'Sunday_Working',
    'Holiday_List',
    'Default_Task_Status',
    'Minimum_Required_Reason',
    'Time_Zone',
    'Date_Format',
    'Currency'
  ];

  if (sheet.getLastRow() === 0) {
    Utils.formatHeaderRow(sheet, headers, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
    const currentId = ss.getId();
    const branchEntry = Object.values(GSS_CONFIG.BRANCHES).find(b => b.SPREADSHEET_ID === currentId) || GSS_CONFIG.BRANCHES.BRANCH_01;

    sheet.appendRow([
      branchEntry.ID,
      '09:00 AM',
      '06:00 PM',
      '01:00 PM',
      '02:00 PM',
      'Monday to Saturday',
      'FALSE',
      'New Year, Pongal, Republic Day, May Day, Independence Day, Diwali',
      'Assigned',
      '10',
      'Asia/Kolkata',
      'dd-MM-yyyy',
      'INR'
    ]);
  }
  return sheet;
}

/**
 * Interactive Approval Dialog: Approves a person and automatically creates their 3 personal sheets
 */
function menuApprovePerson() {
  const ui = SpreadsheetApp.getUi();
  const idPrompt = ui.prompt('Approve Person', 'Enter Employee ID, HR ID, or Admin ID to approve (e.g. EMP_GSS001, HR_GSS001):', ui.ButtonSet.OK_CANCEL);

  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;
  const personId = idPrompt.getResponseText().trim();
  if (!personId) {
    ui.alert('Validation Error', 'ID cannot be empty.', ui.ButtonSet.OK);
    return;
  }

  let result;
  if (personId.startsWith('HR')) {
    result = HR.approveHR(personId);
  } else if (personId.startsWith('ADMIN')) {
    result = Admin.approveAdmin(personId);
  } else {
    result = Employee.approveEmployee(personId);
  }

  ui.alert(result.success ? 'Approval Succeeded' : 'Approval Failed', result.message, ui.ButtonSet.OK);
}

/**
 * Interactive Task Creation Dialog (Supports multiple employee IDs)
 */
function menuCreateTask() {
  const ui = SpreadsheetApp.getUi();

  const titlePrompt = ui.prompt('New Task', 'Enter Task Title (e.g. Python API Integration):', ui.ButtonSet.OK_CANCEL);
  if (titlePrompt.getSelectedButton() !== ui.Button.OK) return;
  const title = titlePrompt.getResponseText().trim();

  const empPrompt = ui.prompt('Assign Employees', 'Enter Employee ID(s) comma-separated (e.g. EMP_GSS001, EMP_GSS002):', ui.ButtonSet.OK_CANCEL);
  if (empPrompt.getSelectedButton() !== ui.Button.OK) return;
  const assignedStr = empPrompt.getResponseText().trim();

  const res = Task.createTask({
    Task_Title: title,
    Assigned_To_Multiple: assignedStr,
    Assigned_By_ID: 'ADMIN_GSS001',
    Assigned_By_Name: 'Branch Admin',
    Priority: 'High',
    Category: 'Development'
  });

  ui.alert(res.success ? 'Task Created' : 'Error', res.message, ui.ButtonSet.OK);
}

/**
 * Interactive In-Place Task Status Update
 */
function menuUpdateTaskStatus() {
  const ui = SpreadsheetApp.getUi();

  const taskPrompt = ui.prompt('Update Task', 'Enter Task ID to update (e.g. TASK_001):', ui.ButtonSet.OK_CANCEL);
  if (taskPrompt.getSelectedButton() !== ui.Button.OK) return;
  const taskId = taskPrompt.getResponseText().trim();

  const statusPrompt = ui.prompt('Select Status', 'Enter new status (Assigned | On Progress | Completed | Partially Stopped):', ui.ButtonSet.OK_CANCEL);
  if (statusPrompt.getSelectedButton() !== ui.Button.OK) return;
  const status = statusPrompt.getResponseText().trim();

  const pctPrompt = ui.prompt('Progress Percentage', 'Enter progress percentage (0 - 100):', ui.ButtonSet.OK_CANCEL);
  if (pctPrompt.getSelectedButton() !== ui.Button.OK) return;
  const pct = parseInt(pctPrompt.getResponseText().trim() || '0', 10);

  const res = Task.updateTaskStatus(taskId, status, pct, 'EMP_GSS001', 'Operator', 'Status updated via GSS Menu');
  ui.alert(res.success ? 'Status Updated' : 'Update Failed', res.message, ui.ButtonSet.OK);
}

/**
 * Interactive Punch In (Captures Login Timestamp)
 */
function menuPunchIn() {
  const ui = SpreadsheetApp.getUi();
  const idPrompt = ui.prompt('Punch In', 'Enter your Employee ID (e.g. EMP_GSS001):', ui.ButtonSet.OK_CANCEL);
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;
  const empId = idPrompt.getResponseText().trim();

  let prefix = 'EMP';
  if (empId.startsWith('HR')) prefix = 'HR';
  if (empId.startsWith('ADMIN')) prefix = 'ADMIN';

  const res = Attendance.recordLogin(empId, prefix);
  ui.alert(res.success ? 'Punch In Successful' : 'Notice', res.message, ui.ButtonSet.OK);
}

/**
 * Interactive Punch Out (Enforces Strict Logout Validation)
 */
function menuPunchOut() {
  const ui = SpreadsheetApp.getUi();
  const idPrompt = ui.prompt('Punch Out', 'Enter your Employee ID (e.g. EMP_GSS001):', ui.ButtonSet.OK_CANCEL);
  if (idPrompt.getSelectedButton() !== ui.Button.OK) return;
  const empId = idPrompt.getResponseText().trim();

  let prefix = 'EMP';
  if (empId.startsWith('HR')) prefix = 'HR';
  if (empId.startsWith('ADMIN')) prefix = 'ADMIN';

  // First check validation without reason
  const res = Attendance.recordLogout(empId, prefix, '');
  if (!res.success && res.message.includes('Reason_For_Not_Completed')) {
    // Prompt user for mandatory reason
    const reasonPrompt = ui.prompt(
      'Logout Validation Required',
      'Incomplete tasks detected!\n\nPlease enter a detailed reason for not completing all planned tasks today (min 10 characters):',
      ui.ButtonSet.OK_CANCEL
    );
    if (reasonPrompt.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Logout Blocked', 'Logout was cancelled. Incomplete tasks require an explanation.', ui.ButtonSet.OK);
      return;
    }
    const reason = reasonPrompt.getResponseText().trim();
    const retryRes = Attendance.recordLogout(empId, prefix, reason);
    ui.alert(retryRes.success ? 'Punch Out Successful' : 'Logout Blocked', retryRes.message, ui.ButtonSet.OK);
  } else {
    ui.alert(res.success ? 'Punch Out Successful' : 'Notice', res.message, ui.ButtonSet.OK);
  }
}

/**
 * Refreshes 07_Branch_Dashboard
 */
function menuRefreshDashboard() {
  Dashboard.refreshDashboard();
  SpreadsheetApp.getUi().alert('Dashboard Refreshed', 'Branch Dashboard has been updated with real-time KPIs.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Configures system automated installable triggers:
 * 1. Morning daily row generator (every morning between 6:00 AM and 7:00 AM)
 * 2. Hourly health check & dashboard refresh
 */
function setupSystemTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));

  // Daily morning generation trigger
  ScriptApp.newTrigger('triggerDailyMorningProcess')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone(GSS_CONFIG.DEFAULT_TIMEZONE)
    .create();

  // Hourly dashboard & overdue task trigger
  ScriptApp.newTrigger('triggerHourlyHealthCheck')
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    'Triggers Configured',
    'Daily morning row generation (6:00 AM IST) and hourly KPI/overdue health checks have been successfully scheduled.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Scheduled trigger function for morning preparation
 */
function triggerDailyMorningProcess() {
  Attendance.generateDailyWorkingRows();
  Dashboard.refreshDashboard();
}

/**
 * Scheduled trigger function for hourly background maintenance
 */
function triggerHourlyHealthCheck() {
  Dashboard.refreshDashboard();
}
