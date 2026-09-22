/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Dashboard.gs
 * DESCRIPTION: Aggregate Branch KPI Computation & Visual Dashboard Formatter
 * ============================================================================
 */

const Dashboard = {
  /**
   * Initializes or refuels 07_Branch_Dashboard with real-time branch operational KPIs
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} [ss]
   */
  refreshDashboard(ss = SpreadsheetApp.getActiveSpreadsheet()) {
    const sheet = Utils.getOrCreateSheet(ss, GSS_CONFIG.SHEETS.BRANCH_DASHBOARD);
    sheet.clear();
    sheet.setTabColor(GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG);

    const now = Utils.getNowIST();
    const todayStr = Utils.formatDate(now);
    const branchName = ss.getName();

    // 1. Fetch source data
    const empSheet = ss.getSheetByName(GSS_CONFIG.SHEETS.EMPLOYEE_DETAILS);
    const hrSheet = ss.getSheetByName(GSS_CONFIG.SHEETS.HR_DETAILS);
    const adminSheet = ss.getSheetByName(GSS_CONFIG.SHEETS.ADMIN_DETAILS);
    const taskSheet = ss.getSheetByName(GSS_CONFIG.SHEETS.TASK_ALLOCATION);
    const studentSheet = ss.getSheetByName(GSS_CONFIG.SHEETS.STUDENT_MASTER);

    const employees = empSheet ? Utils.getSheetDataAsObjects(empSheet) : [];
    const hrList = hrSheet ? Utils.getSheetDataAsObjects(hrSheet) : [];
    const adminList = adminSheet ? Utils.getSheetDataAsObjects(adminSheet) : [];
    const tasks = taskSheet ? Utils.getSheetDataAsObjects(taskSheet) : [];
    const students = studentSheet ? Utils.getSheetDataAsObjects(studentSheet) : [];

    // Calculate metrics
    const totalEmployees = employees.length;
    const totalHR = hrList.length;
    const totalAdmin = adminList.length;
    const activeEmployees = employees.filter(e => e.Status === 'Active').length;
    const activeUsers = activeEmployees + hrList.filter(h => h.Status === 'Active').length + adminList.filter(a => a.Status === 'Active').length;

    const totalTasks = tasks.length;
    const assignedTasks = tasks.filter(t => t.Status === GSS_CONFIG.TASK_STATUS.ASSIGNED).length;
    const onProgressTasks = tasks.filter(t => t.Status === GSS_CONFIG.TASK_STATUS.ON_PROGRESS).length;
    const completedTasks = tasks.filter(t => t.Status === GSS_CONFIG.TASK_STATUS.COMPLETED).length;
    const partiallyStoppedTasks = tasks.filter(t => t.Status === GSS_CONFIG.TASK_STATUS.PARTIALLY_STOPPED).length;

    // Overdue tasks: Expected_Completion_Date < Today && Status != Completed
    let overdueTasks = 0;
    tasks.forEach(t => {
      if (t.Status !== GSS_CONFIG.TASK_STATUS.COMPLETED && t.Expected_Completion_Date) {
        const parts = String(t.Expected_Completion_Date).split('-');
        if (parts.length === 3) {
          const expDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          if (expDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
            overdueTasks++;
          }
        }
      }
    });

    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.Student_Status === 'Active').length;

    // Today's attendance scan
    let todayLoggedIn = 0;
    let todayLoggedOut = 0;

    employees.forEach(emp => {
      const wpName = `EMP_${emp.Employee_ID}_${GSS_CONFIG.PERSONAL_SUFFIXES.WORKING_PROGRESS}`;
      const wpSheet = ss.getSheetByName(wpName);
      if (wpSheet) {
        const rowIdx = Utils.findRowIndex(wpSheet, 2, todayStr);
        if (rowIdx !== -1) {
          const login = wpSheet.getRange(rowIdx, 5).getValue();
          const logout = wpSheet.getRange(rowIdx, 10).getValue();
          if (login) todayLoggedIn++;
          if (logout) todayLoggedOut++;
        }
      }
    });

    // 2. Build Title Banner
    sheet.getRange('B2:H2').merge()
      .setValue(`GATEWAY SOFTWARE SOLUTIONS — ${branchName.toUpperCase()}`)
      .setFontFamily('Roboto')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground(GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG)
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(2, 42);

    sheet.getRange('B3:H3').merge()
      .setValue(`Real-Time Operational Summary • Last Synced: ${Utils.formatDateTime(now)}`)
      .setFontFamily('Roboto')
      .setFontSize(9)
      .setFontStyle('italic')
      .setBackground(GSS_CONFIG.UI_COLORS.SECONDARY_HEADER_BG)
      .setFontColor(GSS_CONFIG.UI_COLORS.SECONDARY_HEADER_TEXT)
      .setHorizontalAlignment('center');

    // 3. Render KPI Grid
    const kpiCards = [
      ['Total Employees', totalEmployees, 'Active Users', activeUsers, 'Today Logged In', todayLoggedIn],
      ['Total HR', totalHR, 'Total Admin', totalAdmin, 'Today Logged Out', todayLoggedOut],
      ['Total Tasks', totalTasks, 'Assigned', assignedTasks, 'On Progress', onProgressTasks],
      ['Completed Tasks', completedTasks, 'Partially Stopped', partiallyStoppedTasks, 'Overdue Tasks', overdueTasks],
      ['Total Students', totalStudents, 'Active Students', activeStudents, 'Completion Rate', totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '0%']
    ];

    let startRow = 5;
    kpiCards.forEach((row, rIdx) => {
      const curRow = startRow + (rIdx * 2);
      // Card 1
      sheet.getRange(curRow, 2).setValue(row[0]).setFontWeight('bold').setFontSize(9).setFontColor('#5F6368');
      sheet.getRange(curRow + 1, 2).setValue(row[1]).setFontWeight('bold').setFontSize(14).setFontColor(row[0] === 'Overdue Tasks' && row[1] > 0 ? GSS_CONFIG.UI_COLORS.DANGER_TEXT : '#202124');
      
      // Card 2
      sheet.getRange(curRow, 4).setValue(row[2]).setFontWeight('bold').setFontSize(9).setFontColor('#5F6368');
      sheet.getRange(curRow + 1, 4).setValue(row[3]).setFontWeight('bold').setFontSize(14).setFontColor('#202124');

      // Card 3
      sheet.getRange(curRow, 6).setValue(row[4]).setFontWeight('bold').setFontSize(9).setFontColor('#5F6368');
      sheet.getRange(curRow + 1, 6).setValue(row[5]).setFontWeight('bold').setFontSize(14).setFontColor(row[4] === 'Overdue Tasks' && row[5] > 0 ? GSS_CONFIG.UI_COLORS.DANGER_TEXT : '#202124');

      // Borders and backgrounds
      sheet.getRange(curRow, 2, 2, 1).setBackground('#FFFFFF').setBorder(true, true, true, true, false, false);
      sheet.getRange(curRow, 4, 2, 1).setBackground('#FFFFFF').setBorder(true, true, true, true, false, false);
      sheet.getRange(curRow, 6, 2, 1).setBackground('#FFFFFF').setBorder(true, true, true, true, false, false);
    });

    // 4. Employee-Level Task Summary Table
    const tableHeaderRow = 17;
    sheet.getRange(tableHeaderRow - 1, 2).setValue('EMPLOYEE TASK & ATTENDANCE PERFORMANCE SUMMARY')
      .setFontWeight('bold')
      .setFontSize(11)
      .setFontColor(GSS_CONFIG.UI_COLORS.SECONDARY_HEADER_TEXT);

    const empTableHeaders = ['Employee ID', 'Employee Name', 'Department', 'Status', 'Tasks Assigned', 'Tasks Completed', 'Students Assigned'];
    sheet.getRange(tableHeaderRow, 2, 1, empTableHeaders.length).setValues([empTableHeaders])
      .setBackground(GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    const tableRows = employees.slice(0, 25).map(e => {
      const empTasks = tasks.filter(t => String(t.Assigned_To_Multiple || '').includes(e.Employee_ID) || t.Assigned_To_ID === e.Employee_ID);
      const empCompleted = empTasks.filter(t => t.Status === GSS_CONFIG.TASK_STATUS.COMPLETED).length;
      const empStudents = students.filter(s => s.Assigned_To_ID === e.Employee_ID).length;

      return [
        e.Employee_ID,
        e.Employee_Name,
        e.Department || 'Engineering',
        e.Status,
        empTasks.length,
        empCompleted,
        empStudents
      ];
    });

    if (tableRows.length > 0) {
      sheet.getRange(tableHeaderRow + 1, 2, tableRows.length, empTableHeaders.length).setValues(tableRows);
      sheet.getRange(tableHeaderRow + 1, 2, tableRows.length, empTableHeaders.length).setBorder(true, true, true, true, true, true, GSS_CONFIG.UI_COLORS.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
    }

    // Auto-fit columns
    for (let c = 2; c <= 8; c++) {
      sheet.autoResizeColumn(c);
      if (sheet.getColumnWidth(c) < 140) sheet.setColumnWidth(c, 150);
    }

    Logger.log('[Dashboard] Branch dashboard refreshed with latest KPIs.');
  }
};
