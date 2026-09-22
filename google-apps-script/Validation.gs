/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Validation.gs
 * DESCRIPTION: Business Rules, Duplicate Prevention & Strict Logout Verification
 * ============================================================================
 */

const Validation = {
  /**
   * Validates if logout is permitted based on planned task completion & explanations
   * 
   * LOGIC:
   * IF all planned tasks are completed -> ALLOW LOGOUT
   * ELSE IF incomplete task exists AND Reason_For_Not_Completed is not empty -> ALLOW LOGOUT
   * ELSE -> BLOCK LOGOUT
   * 
   * @param {Object} workRow Current working progress row object
   * @param {string} [workRow.Planned_Task]
   * @param {string} [workRow.Completed_Task]
   * @param {string} [workRow.Pending_Task]
   * @param {string} [workRow.Reason_For_Not_Completed]
   * @param {string} [workRow.Status]
   * @returns {{ allowed: boolean, message: string }}
   */
  validateLogout(workRow) {
    if (!workRow) {
      return { allowed: false, message: 'Invalid working record: Record not found.' };
    }

    const plannedTask = String(workRow.Planned_Task || '').trim();
    const completedTask = String(workRow.Completed_Task || '').trim().toLowerCase();
    const pendingTask = String(workRow.Pending_Task || '').trim();
    const reason = String(workRow.Reason_For_Not_Completed || '').trim();
    const status = String(workRow.Status || '').trim().toLowerCase();

    // If no tasks were planned today, allow logout
    if (!plannedTask || plannedTask === '-' || plannedTask === 'None') {
      return { allowed: true, message: 'No planned tasks recorded for today. Logout permitted.' };
    }

    // Determine if work is fully completed
    const isCompleted = (completedTask === 'yes' || completedTask === 'completed' || status === 'completed') &&
                        (!pendingTask || pendingTask === '-' || pendingTask === 'none');

    if (isCompleted) {
      return {
        allowed: true,
        message: 'All planned tasks are completed. Logout permitted.'
      };
    }

    // Work is incomplete: verify reason exists and meets minimum length
    if (reason.length >= GSS_CONFIG.WORKING_HOURS.MIN_REASON_LENGTH) {
      return {
        allowed: true,
        message: 'Incomplete tasks verified with documented reason. Logout permitted.'
      };
    }

    // Block logout
    return {
      allowed: false,
      message: 'Logout cannot be completed.\n\nPlease provide a valid explanation in "Reason_For_Not_Completed" for every incomplete task before logging out.'
    };
  },

  /**
   * Checks if an identifier already exists in a given sheet column
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} colIndex 1-based column index
   * @param {string} value Value to verify uniqueness for
   * @param {number} [excludeRow=-1] Row to ignore (for edits/updates)
   * @returns {boolean} true if unique, false if duplicate exists
   */
  isUnique(sheet, colIndex, value, excludeRow = -1) {
    if (!sheet || !value) return true;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return true;

    const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    const targetStr = String(value).trim().toLowerCase();

    for (let i = 0; i < values.length; i++) {
      const currentRow = i + 2;
      if (currentRow === excludeRow) continue;

      const cellVal = String(values[i][0]).trim().toLowerCase();
      if (cellVal === targetStr) {
        return false; // Found duplicate
      }
    }
    return true;
  },

  /**
   * Validates chronological sequence of dates: Assigned_Date <= Start_Date <= Completed_Date
   * @param {Date|string} assignedDate
   * @param {Date|string} [startDate]
   * @param {Date|string} [completedDate]
   * @returns {{ valid: boolean, message: string }}
   */
  validateDateSequence(assignedDate, startDate, completedDate) {
    const parse = (d) => {
      if (!d) return null;
      if (d instanceof Date) return d.getTime();
      const parts = String(d).split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
      }
      return new Date(d).getTime();
    };

    const tAssigned = parse(assignedDate);
    const tStart = parse(startDate);
    const tCompleted = parse(completedDate);

    if (tAssigned && tStart && tStart < tAssigned) {
      return { valid: false, message: 'Start Date cannot be earlier than Assigned Date.' };
    }

    if (tStart && tCompleted && tCompleted < tStart) {
      return { valid: false, message: 'Completed Date cannot be earlier than Start Date.' };
    }

    if (tAssigned && tCompleted && tCompleted < tAssigned) {
      return { valid: false, message: 'Completed Date cannot be earlier than Assigned Date.' };
    }

    return { valid: true, message: 'Date sequence valid.' };
  },

  /**
   * Validates if a task status is permitted
   * @param {string} status
   * @returns {boolean}
   */
  isValidTaskStatus(status) {
    const validStatuses = Object.values(GSS_CONFIG.TASK_STATUS);
    return validStatuses.includes(status);
  },

  /**
   * Ensures email format is valid
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).trim());
  },

  /**
   * Ensures mobile number has at least 10 digits
   * @param {string} mobile
   * @returns {boolean}
   */
  isValidMobile(mobile) {
    if (!mobile) return false;
    const digits = String(mobile).replace(/\D/g, '');
    return digits.length >= 10;
  }
};
