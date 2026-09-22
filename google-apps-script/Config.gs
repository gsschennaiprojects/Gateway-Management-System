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

  // Exactly 4 Operational Branches
  BRANCHES: {
    BRANCH_01: {
      ID: 'BR_CHN_01',
      CODE: 'CHN',
      NAME: 'Gateway Chennai Branch',
      LOCATION: 'Chennai, Tamil Nadu',
      SPREADSHEET_ID: '1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY',
      SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY/edit'
    },
    BRANCH_02: {
      ID: 'BR_CBE_02',
      CODE: 'CBE',
      NAME: 'Gateway Coimbatore Branch',
      LOCATION: 'Coimbatore, Tamil Nadu',
      SPREADSHEET_ID: '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA',
      SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA/edit'
    },
    BRANCH_03: {
      ID: 'BR_MDU_03',
      CODE: 'MDU',
      NAME: 'Gateway Madurai Branch',
      LOCATION: 'Madurai, Tamil Nadu',
      SPREADSHEET_ID: '1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8',
      SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8/edit'
    },
    BRANCH_04: {
      ID: 'BR_ERD_04',
      CODE: 'ERD',
      NAME: 'Gateway Erode Branch',
      LOCATION: 'Erode, Tamil Nadu',
      SPREADSHEET_ID: '1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY',
      SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY/edit'
    }
  },

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

  // Google Cloud & Firebase / Firestore Integration Parameters
  GOOGLE_CLOUD: {
    PROJECT_ID: 'management-system-509313',
    SERVICE_ACCOUNT_EMAIL: 'gss-508@management-system-509313.iam.gserviceaccount.com',
    OAUTH_CLIENT_ID: '446096297797-1kbqt8i7hffgvkq5k5fntsvlc56mjjbg.apps.googleusercontent.com'
  },
  FIREBASE: {
    PROJECT_ID: 'gss-management-system-eef75',
    DATABASE_URL: 'https://gss-management-system-eef75.firebaseio.com',
    FIRESTORE_REST_BASE: 'https://firestore.googleapis.com/v1/projects/gss-management-system-eef75/databases/(default)/documents',
    API_KEY: 'AIzaSyBdu8_3m0H2a7llugxPQk1FtjjVSosmN6w',
    AUTH_DOMAIN: 'gss-management-system-eef75.firebaseapp.com',
    APP_ID: '1:528394878333:web:a9a5da85cefbe639b9a014',
    MEASUREMENT_ID: 'G-NNL9WX2Q24'
  },

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
