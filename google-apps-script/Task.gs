/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Task.gs
 * DESCRIPTION: Task Allocation, Multi-Employee Assignment, Single-Row Status, History & Sync
 * ============================================================================
 */

const Task = {
  ALLOCATION_HEADERS: [
    'Task_ID',
    'Day',
    'Date',
    'Assigned_By_ID',
    'Assigned_By_Name',
    'Assigned_To_ID',
    'Assigned_To_Name',
    'Assigned_To_Multiple',
    'Task_Title',
    'Task_Description',
    'Priority',
    'Category',
    'Start_Date',
    'Expected_Completion_Date',
    'Completed_Date',
    'Status',
    'Progress_Percentage',
    'Remarks',
    'Created_Date',
    'Last_Updated'
  ],

  HISTORY_HEADERS: [
    'History_ID',
    'Task_ID',
    'Timestamp',
    'Changed_By_ID',
    'Changed_By_Name',
    'Old_Status',
    'New_Status',
    'Progress_Percentage',
    'Remarks'
  ],

  /**
   * Initializes 04_Task_Allocation and 05_Task_History sheets
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   */
  initTaskSheets(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    // 04_Task_Allocation
    const allocSheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.TASK_ALLOCATION);
    if (allocSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(allocSheet, this.ALLOCATION_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
      Utils.setDropdownValidation(allocSheet, 11, ['Low', 'Medium', 'High', 'Urgent']); // Priority
      Utils.setDropdownValidation(allocSheet, 16, ['Assigned', 'On Progress', 'Completed', 'Partially Stopped']); // Status
    }

    // 05_Task_History
    const histSheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.TASK_HISTORY);
    if (histSheet.getLastRow() === 0) {
      Utils.formatHeaderRow(histSheet, this.HISTORY_HEADERS, GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);
    }

    return { allocSheet, histSheet };
  },

  /**
   * Allocates a new task. Supports multiple employees in one single task record.
   * @param {Object} data
   * @returns {{ success: boolean, message: string, taskId?: string }}
   */
  createTask(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const { allocSheet, histSheet } = this.initTaskSheets(ss);

    const taskId = data.Task_ID || Utils.generateUniqueId('TASK', allocSheet.getLastRow());

    // Duplicate check
    if (!Validation.isUnique(allocSheet, 1, taskId)) {
      return { success: false, message: `Task ID ${taskId} already exists.` };
    }

    const now = Utils.getNowIST();
    const dayName = Utils.getDayName(now);
    const dateStr = Utils.formatDate(now);

    // Multi-employee parsing: Normalize array or comma-separated string
    let assignedMultipleStr = '';
    let primaryAssignedId = data.Assigned_To_ID || '';
    let primaryAssignedName = data.Assigned_To_Name || '';

    if (Array.isArray(data.Assigned_To_Multiple)) {
      assignedMultipleStr = data.Assigned_To_Multiple.join(', ');
      if (!primaryAssignedId && data.Assigned_To_Multiple.length > 0) {
        primaryAssignedId = data.Assigned_To_Multiple[0];
      }
    } else if (typeof data.Assigned_To_Multiple === 'string') {
      assignedMultipleStr = data.Assigned_To_Multiple;
    }

    if (!assignedMultipleStr && primaryAssignedId) {
      assignedMultipleStr = primaryAssignedId;
    }

    const initialStatus = GSS_CONFIG.TASK_STATUS.ASSIGNED;
    const priority = data.Priority || 'Medium';
    const category = data.Category || 'Development';
    const expectedComp = data.Expected_Completion_Date || dateStr;

    const row = [
      taskId,
      dayName,
      dateStr,
      data.Assigned_By_ID || 'ADMIN_GSS001',
      data.Assigned_By_Name || 'Branch Admin',
      primaryAssignedId,
      primaryAssignedName,
      assignedMultipleStr,
      data.Task_Title || 'Untitled Task',
      data.Task_Description || '',
      priority,
      category,
      '', // Start_Date (empty until On Progress)
      expectedComp,
      '', // Completed_Date (empty until Completed)
      initialStatus,
      0,  // Progress_Percentage
      data.Remarks || 'Task assigned to team member(s)',
      dateStr,
      dateStr
    ];

    allocSheet.appendRow(row);

    // Log to Task History
    const historyId = Utils.generateUniqueId('HIST');
    histSheet.appendRow([
      historyId,
      taskId,
      Utils.formatDateTime(now),
      data.Assigned_By_ID || 'ADMIN_GSS001',
      data.Assigned_By_Name || 'Branch Admin',
      'None',
      initialStatus,
      0,
      'Initial task creation and assignment'
    ]);

    // Audit Log
    Audit.logAction({
      userId: data.Assigned_By_ID || 'ADMIN_GSS001',
      userName: data.Assigned_By_Name || 'Branch Admin',
      role: 'ADMIN',
      action: 'Create',
      module: 'Task',
      recordId: taskId,
      branchId: data.Branch_ID,
      oldValue: '',
      newValue: initialStatus
    });

    // Propagate task to each assigned employee's Working_Progress sheet for today
    this.propagateTaskToWorkingProgress(ss, taskId, data.Task_Title, assignedMultipleStr);

    // Sync to Firestore
    const taskObj = {
      taskId,
      day: dayName,
      date: dateStr,
      assignedById: data.Assigned_By_ID,
      assignedByName: data.Assigned_By_Name,
      assignedToId: primaryAssignedId,
      assignedToName: primaryAssignedName,
      assignedToMultiple: assignedMultipleStr,
      taskTitle: data.Task_Title,
      taskDescription: data.Task_Description,
      priority,
      category,
      expectedCompletionDate: expectedComp,
      status: initialStatus,
      progressPercentage: 0,
      remarks: data.Remarks
    };
    Firebase.syncTaskToFirestore(taskObj);

    return {
      success: true,
      message: `Task ${taskId} created successfully and allocated to [${assignedMultipleStr}].`,
      taskId
    };
  },

  /**
   * Updates task status and progress in the EXACT SAME ROW (in-place update)
   * Logs old -> new status transition into 05_Task_History
   * 
   * @param {string} taskId
   * @param {string} newStatus 'Assigned' | 'On Progress' | 'Completed' | 'Partially Stopped'
   * @param {number} progressPercentage 0 to 100
   * @param {string} changedById
   * @param {string} changedByName
   * @param {string} remarks
   * @returns {{ success: boolean, message: string }}
   */
  updateTaskStatus(taskId, newStatus, progressPercentage, changedById, changedByName, remarks = '') {
    if (!Validation.isValidTaskStatus(newStatus)) {
      return {
        success: false,
        message: `Invalid status '${newStatus}'. Allowed: Assigned, On Progress, Completed, Partially Stopped.`
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const { allocSheet, histSheet } = this.initTaskSheets(ss);

    const rowIdx = Utils.findRowIndex(allocSheet, 1, taskId);
    if (rowIdx === -1) {
      return { success: false, message: `Task ${taskId} not found in branch allocation records.` };
    }

    const oldStatus = allocSheet.getRange(rowIdx, 16).getValue();
    const assignedDate = allocSheet.getRange(rowIdx, 3).getValue();
    let currentStartDate = allocSheet.getRange(rowIdx, 13).getValue();
    let currentCompletedDate = allocSheet.getRange(rowIdx, 15).getValue();

    const now = Utils.getNowIST();
    const todayStr = Utils.formatDate(now);

    // Business Rules for Dates:
    // When status changes to 'On Progress', set Start_Date if empty
    if (newStatus === GSS_CONFIG.TASK_STATUS.ON_PROGRESS && !currentStartDate) {
      currentStartDate = todayStr;
      allocSheet.getRange(rowIdx, 13).setValue(todayStr); // Start_Date
    }

    // When status changes to 'Completed', set Completed_Date and 100% progress
    if (newStatus === GSS_CONFIG.TASK_STATUS.COMPLETED) {
      currentCompletedDate = todayStr;
      allocSheet.getRange(rowIdx, 15).setValue(todayStr); // Completed_Date
      progressPercentage = 100;
    } else if (newStatus !== GSS_CONFIG.TASK_STATUS.COMPLETED && oldStatus === GSS_CONFIG.TASK_STATUS.COMPLETED) {
      // Reopened task: clear Completed_Date
      allocSheet.getRange(rowIdx, 15).setValue('');
      currentCompletedDate = '';
    }

    // Validate sequence
    const seqCheck = Validation.validateDateSequence(assignedDate, currentStartDate, currentCompletedDate);
    if (!seqCheck.valid) {
      return { success: false, message: seqCheck.message };
    }

    // In-place row updates on 04_Task_Allocation
    allocSheet.getRange(rowIdx, 16).setValue(newStatus);                         // Status
    allocSheet.getRange(rowIdx, 17).setValue(progressPercentage);                // Progress_Percentage
    if (remarks) allocSheet.getRange(rowIdx, 18).setValue(remarks);             // Remarks
    allocSheet.getRange(rowIdx, 20).setValue(todayStr);                         // Last_Updated

    // Append record to 05_Task_History
    const historyId = Utils.generateUniqueId('HIST');
    histSheet.appendRow([
      historyId,
      taskId,
      Utils.formatDateTime(now),
      changedById,
      changedByName,
      oldStatus,
      newStatus,
      progressPercentage,
      remarks || `Status transitioned from ${oldStatus} to ${newStatus}`
    ]);

    // Audit Log
    Audit.logAction({
      userId: changedById,
      userName: changedByName,
      role: 'USER',
      action: 'Task Status Change',
      module: 'Task',
      recordId: taskId,
      oldValue: `${oldStatus} (${allocSheet.getRange(rowIdx, 17).getValue()}%)`,
      newValue: `${newStatus} (${progressPercentage}%)`
    });

    // Firestore remote sync
    const allRows = Utils.getSheetDataAsObjects(allocSheet);
    const updatedTask = allRows.find(t => t.Task_ID === taskId);
    if (updatedTask) {
      Firebase.syncTaskToFirestore(updatedTask);
    }

    return {
      success: true,
      message: `Task ${taskId} updated in-place to '${newStatus}' (${progressPercentage}%). History recorded.`
    };
  },

  /**
   * Propagates newly assigned task to each assigned employee's Working_Progress sheet for today
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} taskId
   * @param {string} taskTitle
   * @param {string} assignedMultipleStr
   */
  propagateTaskToWorkingProgress(ss, taskId, taskTitle, assignedMultipleStr) {
    if (!assignedMultipleStr) return;
    const empIds = assignedMultipleStr.split(',').map(s => s.trim()).filter(Boolean);
    const todayStr = Utils.formatDate(Utils.getNowIST());

    empIds.forEach(empId => {
      // Check prefix for sheet name
      let prefix = 'EMP';
      if (empId.startsWith('HR')) prefix = 'HR';
      if (empId.startsWith('ADMIN')) prefix = 'ADMIN';

      const sheetName = `${prefix}_${empId}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return;

      // Find today's row
      const rowIdx = Utils.findRowIndex(sheet, 2, todayStr);
      if (rowIdx !== -1) {
        const existingPlanned = sheet.getRange(rowIdx, 6).getValue();
        const existingTaskIds = sheet.getRange(rowIdx, 7).getValue();

        const newPlanned = existingPlanned && existingPlanned !== '-' ? `${existingPlanned} | ${taskTitle}` : taskTitle;
        const newTaskIds = existingTaskIds && existingTaskIds !== '-' ? `${existingTaskIds}, ${taskId}` : taskId;

        sheet.getRange(rowIdx, 6).setValue(newPlanned);
        sheet.getRange(rowIdx, 7).setValue(newTaskIds);
      }
    });
  }
};
