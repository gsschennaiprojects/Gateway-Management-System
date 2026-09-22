/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Utils.gs
 * DESCRIPTION: Date/Time arithmetic, sheet formatting, IDs, and query utilities
 * ============================================================================
 */

const Utils = {
  /**
   * Returns current Date in Indian Standard Time (Asia/Kolkata)
   * @returns {Date}
   */
  getNowIST() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  },

  /**
   * Formats a date into dd-MM-yyyy string
   * @param {Date} [date]
   * @returns {string}
   */
  formatDate(date = this.getNowIST()) {
    if (!date) return '';
    return Utilities.formatDate(date, GSS_CONFIG.DEFAULT_TIMEZONE, GSS_CONFIG.DATE_FORMAT);
  },

  /**
   * Returns Day name (e.g., "Monday", "Tuesday") from a given Date
   * @param {Date} [date]
   * @returns {string}
   */
  getDayName(date = this.getNowIST()) {
    if (!date) return '';
    return Utilities.formatDate(date, GSS_CONFIG.DEFAULT_TIMEZONE, 'EEEE');
  },

  /**
   * Formats time into hh:mm a string (e.g. 09:05 AM)
   * @param {Date} [date]
   * @returns {string}
   */
  formatTime(date = this.getNowIST()) {
    if (!date) return '';
    return Utilities.formatDate(date, GSS_CONFIG.DEFAULT_TIMEZONE, GSS_CONFIG.TIME_FORMAT);
  },

  /**
   * Formats timestamp into full datetime string
   * @param {Date} [date]
   * @returns {string}
   */
  formatDateTime(date = this.getNowIST()) {
    if (!date) return '';
    return Utilities.formatDate(date, GSS_CONFIG.DEFAULT_TIMEZONE, GSS_CONFIG.DATETIME_FORMAT);
  },

  /**
   * Parses time string or Date and computes duration formatted as "Xh Ym"
   * @param {string|Date} loginTime
   * @param {string|Date} logoutTime
   * @returns {string} formatted duration e.g., "8h 35m"
   */
  calculateWorkingHours(loginTime, logoutTime) {
    if (!loginTime || !logoutTime) return '';
    
    let tLogin = loginTime;
    let tLogout = logoutTime;

    if (typeof loginTime === 'string') {
      tLogin = this.parseTimeStringToDate(loginTime);
    }
    if (typeof logoutTime === 'string') {
      tLogout = this.parseTimeStringToDate(logoutTime);
    }

    if (!tLogin || !tLogout) return '';

    let diffMs = tLogout.getTime() - tLogin.getTime();
    if (diffMs < 0) {
      // Handled overnight shift if necessary
      diffMs += 24 * 60 * 60 * 1000;
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return `${hours}h ${mins < 10 ? '0' + mins : mins}m`;
  },

  /**
   * Converts a time string (e.g. "09:05 AM" or "09:05:00") into a Date object on reference date
   * @param {string} timeStr
   * @returns {Date|null}
   */
  parseTimeStringToDate(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const match = timeStr.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[4] ? match[4].toUpperCase() : null;

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    const d = this.getNowIST();
    d.setHours(hours, minutes, 0, 0);
    return d;
  },

  /**
   * Generates a unique alphanumeric ID with specified prefix and padding
   * @param {string} prefix e.g. "TASK", "AUD", "HIST"
   * @param {number} [sequenceNumber]
   * @returns {string} e.g. "TASK_001" or "AUD_1695281923_001"
   */
  generateUniqueId(prefix, sequenceNumber) {
    if (sequenceNumber !== undefined && sequenceNumber !== null) {
      const padded = String(sequenceNumber).padStart(3, '0');
      return `${prefix}_${padded}`;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const rand = Math.floor(100 + Math.random() * 900);
    return `${prefix}_${timestamp}_${rand}`;
  },

  /**
   * Safely retrieves or creates a sheet inside the active spreadsheet
   * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getOrCreateSheet(ss, sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    return sheet;
  },

  /**
   * Formats sheet headers professionally with enterprise GSS visual hierarchy
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string[]} headers
   * @param {string} [headerBg]
   * @param {string} [headerText]
   */
  formatHeaderRow(sheet, headers, headerBg = GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_BG, headerText = GSS_CONFIG.UI_COLORS.PRIMARY_HEADER_TEXT) {
    // Set headers on row 1
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);

    // Freeze top row
    sheet.setFrozenRows(1);

    // Styling
    range.setBackground(headerBg)
      .setFontColor(headerText)
      .setFontFamily('Roboto')
      .setFontSize(10)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(false);

    sheet.setRowHeight(1, 38);

    // Auto-fit column widths with safety minimum
    for (let c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
      const width = sheet.getColumnWidth(c);
      if (width < 120) {
        sheet.setColumnWidth(c, 140);
      } else if (width > 300) {
        sheet.setColumnWidth(c, 300);
      }
    }
  },

  /**
   * Finds the 1-based row index in a sheet where a column matches the target value
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} colIndex 1-based column index
   * @param {*} targetValue
   * @returns {number} row index or -1 if not found
   */
  findRowIndex(sheet, colIndex, targetValue) {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return -1;

    const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    const strTarget = String(targetValue).trim().toLowerCase();

    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim().toLowerCase() === strTarget) {
        return i + 2; // offset for 1-based index and header row
      }
    }
    return -1;
  },

  /**
   * Returns all rows from a sheet as an array of objects keyed by header names
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @returns {Array<Object>}
   */
  getSheetDataAsObjects(sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) return [];

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    return data.map((row, idx) => {
      const obj = { _rowIndex: idx + 2 };
      headers.forEach((h, colIdx) => {
        const key = String(h).trim();
        obj[key] = row[colIdx];
      });
      return obj;
    });
  },

  /**
   * Sets dropdown list validation on a specified column range
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} colIndex
   * @param {string[]} options
   * @param {number} [startRow=2]
   * @param {number} [numRows=500]
   */
  setDropdownValidation(sheet, colIndex, options, startRow = 2, numRows = 500) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(options, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(startRow, colIndex, numRows, 1).setDataValidation(rule);
  }
};
