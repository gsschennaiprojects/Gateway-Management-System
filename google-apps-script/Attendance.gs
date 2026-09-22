/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Attendance.gs
 * DESCRIPTION: Daily Row Auto-Generation, Login/Logout Capture & Strict Logout Validation
 * ============================================================================
 */

const Attendance = {
  /**
   * Daily Morning Process: Ensures exactly 1 working-progress row exists for today for every active user
   * Automatically derives Day and Date, and binds active assigned tasks from 04_Task_Allocation
   */
  generateDailyWorkingRows() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const now = Utils.getNowIST();
    const dayOfWeek = now.getDay(); // 0 is Sunday

    // Sunday check based on Branch Settings
    if (dayOfWeek === 0 && !GSS_CONFIG.WORKING_HOURS.SUNDAY_WORKING) {
      Logger.log('[Attendance.generateDailyWorkingRows] Today is Sunday. Non-working day by default.');
      return;
    }

    const todayDateStr = Utils.formatDate(now);
    const todayDayName = Utils.getDayName(now);

    // Get active task allocations to pull planned tasks for today
    const allocSheet = ss.getSheetByName(GSS_CONFIG.SHEETS.TASK_ALLOCATION);
    const activeTasks = allocSheet ? Utils.getSheetDataAsObjects(allocSheet).filter(t => t.Status !== GSS_CONFIG.TASK_STATUS.COMPLETED) : [];

    // Helper to process user category (Employees, HR, Admins)
    const processUserCategory = (sheetName, idCol, nameCol, statusCol, prefix) => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) return;

      const users = Utils.getSheetDataAsObjects(sheet);
      users.forEach(u => {
        const userId = u[idCol];
        const userName = u[nameCol];
        const status = u[statusCol];

        if (status !== 'Active') return; // Skip inactive/pending users

        const wpSheetName = `${prefix}_${userId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
        const wpSheet = ss.getSheetByName(wpSheetName);
        if (!wpSheet) return;

        // Check if row for today already exists (Rule 16: STRICTLY ONE ROW PER WORKING DAY)
        const existingRowIdx = Utils.findRowIndex(wpSheet, 2, todayDateStr);
        if (existingRowIdx !== -1) {
          // Row already exists; do not duplicate
          return;
        }

        // Identify assigned tasks for this user
        const userTasks = activeTasks.filter(t => {
          const mult = String(t.Assigned_To_Multiple || '');
          const single = String(t.Assigned_To_ID || '');
          return mult.includes(userId) || single === userId;
        });

        const plannedTitles = userTasks.map(t => t.Task_Title).join(' | ') || '-';
        const taskIds = userTasks.map(t => t.Task_ID).join(', ') || '-';

        // Append exactly one new row for today
        const newRow = [
          todayDayName,
          todayDateStr,
          userId,
          userName,
          '',               // Login_Time (captured on check-in)
          plannedTitles,    // Planned_Task (auto-populated)
          taskIds,          // Task_ID
          'No',             // Completed_Task
          plannedTitles !== '-' ? plannedTitles : '', // Pending_Task
          '',               // Logout_Time
          '',               // Reason_For_Not_Completed
          'Assigned',       // Status
          '',               // Working_Hours (calculated on logout)
          'Daily operational row prepared'
        ];

        wpSheet.appendRow(newRow);
      });
    };

    processUserCategory(GSS_CONFIG.SHEETS.EMPLOYEE_DETAILS, 'Employee_ID', 'Employee_Name', 'Status', 'EMP');
    processUserCategory(GSS_CONFIG.SHEETS.HR_DETAILS, 'HR_ID', 'HR_Name', 'Status', 'HR');
    processUserCategory(GSS_CONFIG.SHEETS.ADMIN_DETAILS, 'Admin_ID', 'Admin_Name', 'Status', 'ADMIN');

    Logger.log(`[Attendance] Daily working-progress rows prepared for date: ${todayDateStr}`);
  },

  /**
   * Records official login timestamp for a user. Employee cannot manually alter official timestamp.
   * @param {string} userId e.g. "EMP_GSS001"
   * @param {string} [rolePrefix='EMP']
   * @returns {{ success: boolean, message: string, loginTime?: string }}
   */
  recordLogin(userId, rolePrefix = 'EMP') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wpSheetName = `${rolePrefix}_${userId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
    const wpSheet = ss.getSheetByName(wpSheetName);

    if (!wpSheet) {
      return { success: false, message: `Operational sheet ${wpSheetName} not found.` };
    }

    const now = Utils.getNowIST();
    const todayStr = Utils.formatDate(now);
    const timeStr = Utils.formatTime(now);

    let rowIdx = Utils.findRowIndex(wpSheet, 2, todayStr);
    if (rowIdx === -1) {
      // Create today's row immediately if not already generated
      this.generateDailyWorkingRows();
      rowIdx = Utils.findRowIndex(wpSheet, 2, todayStr);
    }

    if (rowIdx === -1) {
      return { success: false, message: 'Could not initialize working row for today.' };
    }

    // Check if already logged in
    const existingLogin = wpSheet.getRange(rowIdx, 5).getValue();
    if (existingLogin) {
      return {
        success: false,
        message: `Login already recorded today at ${existingLogin}. Manual override is blocked.`
      };
    }

    // Set Login_Time and update Status
    wpSheet.getRange(rowIdx, 5).setValue(timeStr);
    wpSheet.getRange(rowIdx, 12).setValue(GSS_CONFIG.TASK_STATUS.ON_PROGRESS);

    Audit.logAction({
      userId: userId,
      userName: wpSheet.getRange(rowIdx, 4).getValue(),
      role: rolePrefix,
      action: 'Login',
      module: 'Attendance',
      recordId: `${userId}_${todayStr}`,
      oldValue: '',
      newValue: timeStr
    });

    return {
      success: true,
      message: `Login timestamp recorded successfully at ${timeStr}. Have a productive day!`,
      loginTime: timeStr
    };
  },

  /**
   * Enforces logout validation logic and records logout timestamp with duration
   * 
   * LOGOUT VALIDATION LOGIC:
   * IF all planned tasks are completed -> ALLOW LOGOUT
   * ELSE IF incomplete task exists AND Reason_For_Not_Completed is not empty -> ALLOW LOGOUT
   * ELSE -> BLOCK LOGOUT (Display error)
   * 
   * @param {string} userId
   * @param {string} [rolePrefix='EMP']
   * @param {string} [reasonForIncomplete='']
   * @returns {{ success: boolean, message: string, workingHours?: string }}
   */
  recordLogout(userId, rolePrefix = 'EMP', reasonForIncomplete = '') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wpSheetName = `${rolePrefix}_${userId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
    const wpSheet = ss.getSheetByName(wpSheetName);

    if (!wpSheet) {
      return { success: false, message: `Operational sheet ${wpSheetName} not found.` };
    }

    const now = Utils.getNowIST();
    const todayStr = Utils.formatDate(now);
    const rowIdx = Utils.findRowIndex(wpSheet, 2, todayStr);

    if (rowIdx === -1) {
      return { success: false, message: 'No active working record found for today.' };
    }

    const loginTime = wpSheet.getRange(rowIdx, 5).getValue();
    if (!loginTime) {
      return { success: false, message: 'Cannot logout: No login time recorded for today.' };
    }

    const existingLogout = wpSheet.getRange(rowIdx, 10).getValue();
    if (existingLogout) {
      return { success: false, message: `Logout was already recorded at ${existingLogout}.` };
    }

    // Retrieve row object for strict validation
    const plannedTask = wpSheet.getRange(rowIdx, 6).getValue();
    const completedTask = wpSheet.getRange(rowIdx, 8).getValue();
    const pendingTask = wpSheet.getRange(rowIdx, 9).getValue();
    let currentReason = wpSheet.getRange(rowIdx, 11).getValue();

    if (reasonForIncomplete && !currentReason) {
      currentReason = reasonForIncomplete;
      wpSheet.getRange(rowIdx, 11).setValue(reasonForIncomplete);
    }

    const validationResult = Validation.validateLogout({
      Planned_Task: plannedTask,
      Completed_Task: completedTask,
      Pending_Task: pendingTask,
      Reason_For_Not_Completed: currentReason,
      Status: wpSheet.getRange(rowIdx, 12).getValue()
    });

    if (!validationResult.allowed) {
      return {
        success: false,
        message: validationResult.message
      };
    }

    // All validation passed: Record Logout
    const logoutTime = Utils.formatTime(now);
    wpSheet.getRange(rowIdx, 10).setValue(logoutTime);

    // Calculate Working Hours: Logout_Time - Login_Time
    const workingHours = Utils.calculateWorkingHours(loginTime, logoutTime);
    wpSheet.getRange(rowIdx, 13).setValue(workingHours);
    wpSheet.getRange(rowIdx, 12).setValue(GSS_CONFIG.TASK_STATUS.COMPLETED);

    Audit.logAction({
      userId: userId,
      userName: wpSheet.getRange(rowIdx, 4).getValue(),
      role: rolePrefix,
      action: 'Logout',
      module: 'Attendance',
      recordId: `${userId}_${todayStr}`,
      oldValue: `Login: ${loginTime}`,
      newValue: `Logout: ${logoutTime} | Duration: ${workingHours}`
    });

    return {
      success: true,
      message: `Logout successful! Total working hours: ${workingHours}.`,
      workingHours
    };
  }
};
