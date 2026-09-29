/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Config.gs
 * DESCRIPTION: Centralized System Configuration, Constants & Branch Routing
 * ============================================================================
 */

const GSS_CONFIG = {
  // System Metadata
  SYSTEM_NAME: 'Gateway Software Solutions Management System',
  VERSION: '2.4.0',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  DATE_FORMAT: 'dd-MM-yyyy',
  TIME_FORMAT: 'hh:mm a',
  DATETIME_FORMAT: 'dd-MM-yyyy hh:mm:ss a',

  // Runtime branch routing comes from per-spreadsheet Script Properties.
  BRANCHES: {},

  // Common Branch Sheet Names (Strict Prefix & Format)
  SHEETS: {
    BRANCH_DETAILS: '00_Branch_Details',
    EMPLOYEE_DETAILS: '01_Employee_Details',
    HR_DETAILS: '02_HR_Details',
    ADMIN_DETAILS: '03_Admin_Details',
    TASK_ALLOCATION: '04_Task_Allocation',
    TASK_HISTORY: '05_Task_History',
    STUDENT_MASTER: '06_Student_Master',
    BRANCH_DASHBOARD: '07_Branch_Dashboard',
    BRANCH_SETTINGS: '08_Branch_Settings',
    AUDIT_LOG: '09_Audit_Log'
  },

  // Personal Sheet Suffixes (Exactly 3 per person)
  PERSONAL_SUFFIXES: {
    WORKING_PROGRESS: 'Working_Progress',
    STUDENT_DETAILS: 'Student_Details',
    STUDENT_PROGRESS: 'Student_Progress'
  },

  // Allowed Task Statuses
  TASK_STATUS: {
    ASSIGNED: 'Assigned',
    ON_PROGRESS: 'On Progress',
    COMPLETED: 'Completed',
    PARTIALLY_STOPPED: 'Partially Stopped'
  },

  // Task Priorities
  TASK_PRIORITY: {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    URGENT: 'Urgent'
  },

  // Account Statuses
  ACCOUNT_STATUS: {
    PENDING: 'Pending Approval',
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
    REJECTED: 'Rejected',
    ARCHIVED: 'Archived'
  },

  // User Roles
  ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    HR: 'HR',
    EMPLOYEE: 'EMPLOYEE',
    INTERN: 'INTERN'
  },

  // Student Fee Statuses
  FEE_STATUS: {
    PAID: 'Paid',
    PARTIAL: 'Partial',
    PENDING: 'Pending'
  },

  // Student Project Statuses
  PROJECT_STATUS: {
    NOT_STARTED: 'Not Started',
    ONGOING: 'Ongoing',
    UNDER_REVIEW: 'Under Review',
    COMPLETED: 'Completed'
  },

  // No Firebase or Google credentials belong in Apps Script source.

  // Working Hours Parameters
  WORKING_HOURS: {
    START_TIME: '09:00 AM',
    END_TIME: '06:00 PM',
    SUNDAY_WORKING: false,
    MIN_REASON_LENGTH: 10 // Characters
  },

  // UI Theme Colors for Google Sheets Headers
  UI_COLORS: {
    PRIMARY_HEADER_BG: '#1A73E8', // Google Workspace Royal Blue
    PRIMARY_HEADER_TEXT: '#FFFFFF',
    SECONDARY_HEADER_BG: '#E8F0FE',
    SECONDARY_HEADER_TEXT: '#174EA6',
    SUCCESS_BG: '#CEEAD6',
    SUCCESS_TEXT: '#0D652D',
    WARNING_BG: '#FEEFC3',
    WARNING_TEXT: '#B06000',
    DANGER_BG: '#FAD2CF',
    DANGER_TEXT: '#A50E0E',
    ZEBRA_ROW_BG: '#F8FAFD',
    BORDER_COLOR: '#DADCE0'
  }
};

/** Read and validate the branch identity attached to this spreadsheet. */
function getCurrentBranchConfig() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    ID: props.getProperty('GSS_BRANCH_ID'),
    CODE: props.getProperty('GSS_BRANCH_CODE'),
    NAME: props.getProperty('GSS_BRANCH_NAME'),
    LOCATION: props.getProperty('GSS_BRANCH_LOCATION') || '',
    SPREADSHEET_ID: props.getProperty('GSS_SPREADSHEET_ID'),
    TIMEZONE: props.getProperty('GSS_TIMEZONE') || GSS_CONFIG.DEFAULT_TIMEZONE,
  };
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!config.ID || !config.CODE || !config.NAME || !config.SPREADSHEET_ID || !activeSpreadsheet || activeSpreadsheet.getId() !== config.SPREADSHEET_ID) {
    throw new Error('This spreadsheet is not configured for a registered GSS branch.');
  }
  if (!/^[A-Z0-9_-]{2,40}$/.test(config.ID) || !/^[A-Z0-9]{2,8}$/.test(config.CODE)) {
    throw new Error('Branch Script Properties are invalid.');
  }
  return config;
}

function getSystemTimezone() {
  return PropertiesService.getScriptProperties().getProperty('GSS_TIMEZONE') || GSS_CONFIG.DEFAULT_TIMEZONE;
}

/** Run manually after opening the intended branch spreadsheet; never guesses a branch. */
function configureCurrentBranch(branchId, branchCode, branchName, location, timeZone) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open a branch spreadsheet before configuration.');
  if (!branchId || !/^[A-Z0-9_-]{2,40}$/.test(branchId) || !branchCode || !/^[A-Z0-9]{2,8}$/.test(branchCode) || !branchName) {
    throw new Error('Provide an approved branch ID, branch code, and branch name.');
  }
  const zone = timeZone || GSS_CONFIG.DEFAULT_TIMEZONE;
  try { Utilities.formatDate(new Date(), zone, 'yyyy-MM-dd'); } catch (_) { throw new Error('Invalid IANA timezone.'); }
  PropertiesService.getScriptProperties().setProperties({
    GSS_BRANCH_ID: branchId, GSS_BRANCH_CODE: branchCode, GSS_BRANCH_NAME: branchName,
    GSS_BRANCH_LOCATION: location || '', GSS_SPREADSHEET_ID: spreadsheet.getId(), GSS_TIMEZONE: zone,
  }, true);
  return { branchId: branchId, branchCode: branchCode, spreadsheetId: spreadsheet.getId() };
}
