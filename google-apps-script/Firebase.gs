/**
 * ============================================================================
 * GATEWAY SOFTWARE SOLUTIONS (GSS) — MULTI-BRANCH ENTERPRISE HRMS
 * MODULE: Firebase.gs
 * DESCRIPTION: Cloud Firestore REST API Synchronization (Users, Tasks, Students)
 * ============================================================================
 */

const Firebase = {
  /**
   * Checks if Firebase API credentials have been configured in Script Properties
   * @returns {boolean}
   */
  isConfigured() {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('FIREBASE_API_KEY');
    return Boolean(apiKey && apiKey.length > 10);
  },

  /**
   * Helper to retrieve Script Property safely
   * @param {string} key
   * @returns {string|null}
   */
  getProperty(key) {
    return PropertiesService.getScriptProperties().getProperty(key);
  },

  /**
   * Converts a JavaScript primitive/object into Firestore REST field format
   * @param {*} val
   * @returns {Object}
   */
  encodeFirestoreValue(val) {
    if (val === null || val === undefined) {
      return { nullValue: null };
    }
    if (typeof val === 'boolean') {
      return { booleanValue: val };
    }
    if (typeof val === 'number') {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (val instanceof Date) {
      return { timestampValue: val.toISOString() };
    }
    if (Array.isArray(val)) {
      return {
        arrayValue: {
          values: val.map(item => this.encodeFirestoreValue(item))
        }
      };
    }
    if (typeof val === 'object') {
      const fields = {};
      for (const k of Object.keys(val)) {
        fields[k] = this.encodeFirestoreValue(val[k]);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  },

  /**
   * Converts a JavaScript object into Firestore document fields
   * @param {Object} data
   * @returns {Object} { fields: { ... } }
   */
  encodeFirestoreDocument(data) {
    const fields = {};
    for (const key of Object.keys(data)) {
      fields[key] = this.encodeFirestoreValue(data[key]);
    }
    return { fields };
  },

  /**
   * Upserts a document into Firestore using PATCH with updateMask
   * @param {string} collectionPath e.g. "users", "tasks", "students"
   * @param {string} documentId e.g. "uid_123", "TASK_001"
   * @param {Object} data
   * @returns {Object|null}
   */
  upsertDocument(collectionPath, documentId, data) {
    if (!this.isConfigured()) {
      Logger.log(`[Firebase Notice] Firestore REST key not set. Skipping remote sync for ${collectionPath}/${documentId}`);
      return null;
    }

    try {
      const apiKey = this.getProperty('FIREBASE_API_KEY');
      const url = `${GSS_CONFIG.FIREBASE.FIRESTORE_REST_BASE}/${collectionPath}/${encodeURIComponent(documentId)}?key=${apiKey}`;
      const payload = this.encodeFirestoreDocument(data);

      const options = {
        method: 'patch',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const res = UrlFetchApp.fetch(url, options);
      const statusCode = res.getResponseCode();

      if (statusCode >= 200 && statusCode < 300) {
        return JSON.parse(res.getContentText());
      } else {
        Logger.log(`[Firebase Sync Warning] ${statusCode} on ${collectionPath}/${documentId}: ${res.getContentText()}`);
        return null;
      }
    } catch (e) {
      Logger.log(`[Firebase Sync Error] Exception syncing to ${collectionPath}/${documentId}: ${e.message}`);
      return null;
    }
  },

  /**
   * Synchronizes user profile to Firestore 'users/{uid}'
   * @param {Object} user
   */
  syncUserToFirestore(user) {
    const uid = user.firebaseUid || user.Firebase_UID || user.employeeId || user.Employee_ID;
    if (!uid) return;

    const payload = {
      uid: uid,
      employeeId: user.employeeId || user.Employee_ID || '',
      name: user.employeeName || user.Employee_Name || user.name || '',
      email: user.email || user.Email || '',
      mobile: user.mobile || user.Mobile || '',
      role: user.role || user.Designation || 'EMPLOYEE',
      branchId: user.branchId || user.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      designation: user.designation || user.Designation || '',
      department: user.department || user.Department || '',
      status: user.status || user.Status || 'Active',
      accountStatus: user.accountStatus || user.Account_Status || 'Active',
      permissions: user.permissions || ['READ', 'WRITE_OWN'],
      updatedAt: new Date().toISOString()
    };

    return this.upsertDocument('users', uid, payload);
  },

  /**
   * Synchronizes task to Firestore 'tasks/{taskId}'
   * @param {Object} task
   */
  syncTaskToFirestore(task) {
    const taskId = task.taskId || task.Task_ID;
    if (!taskId) return;

    const assignedMultiple = task.assignedToMultiple || task.Assigned_To_Multiple || '';
    const assignedList = String(assignedMultiple).split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      taskId: taskId,
      branchId: task.branchId || task.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      assignedById: task.assignedById || task.Assigned_By_ID || '',
      assignedByName: task.assignedByName || task.Assigned_By_Name || '',
      assignedToId: task.assignedToId || task.Assigned_To_ID || '',
      assignedToName: task.assignedToName || task.Assigned_To_Name || '',
      assignedToMultiple: assignedList,
      taskTitle: task.taskTitle || task.Task_Title || '',
      taskDescription: task.taskDescription || task.Task_Description || '',
      priority: task.priority || task.Priority || 'Medium',
      category: task.category || task.Category || 'General',
      startDate: task.startDate || task.Start_Date || '',
      expectedCompletionDate: task.expectedCompletionDate || task.Expected_Completion_Date || '',
      completedDate: task.completedDate || task.Completed_Date || '',
      status: task.status || task.Status || 'Assigned',
      progressPercentage: parseInt(task.progressPercentage || task.Progress_Percentage || 0, 10),
      remarks: task.remarks || task.Remarks || '',
      updatedAt: new Date().toISOString()
    };

    return this.upsertDocument('tasks', taskId, payload);
  },

  /**
   * Synchronizes student to Firestore 'students/{studentId}'
   * @param {Object} student
   */
  syncStudentToFirestore(student) {
    const studentId = student.studentId || student.Student_ID;
    if (!studentId) return;

    const payload = {
      studentId: studentId,
      studentName: student.studentName || student.Student_Name || '',
      branchId: student.branchId || student.Branch_ID || GSS_CONFIG.BRANCHES.BRANCH_01.ID,
      college: student.college || student.College || '',
      department: student.department || student.Department || '',
      year: student.year || student.Year || '',
      email: student.email || student.Email || '',
      mobile: student.mobile || student.Mobile || '',
      domain: student.domain || student.Domain || '',
      course: student.course || student.Course || '',
      assignedToId: student.assignedToId || student.Assigned_To_ID || student.Tutor_ID || '',
      assignedToName: student.assignedToName || student.Assigned_To_Name || student.Tutor_Name || '',
      startDate: student.startDate || student.Start_Date || '',
      expectedEndDate: student.expectedEndDate || student.Expected_End_Date || '',
      feeStatus: student.feeStatus || student.Fee_Status || 'Pending',
      projectStatus: student.projectStatus || student.Project_Status || 'Not Started',
      studentStatus: student.studentStatus || student.Student_Status || 'Active',
      updatedAt: new Date().toISOString()
    };

    return this.upsertDocument('students', studentId, payload);
  },

  /**
   * Synchronizes audit log entry to Firestore 'audit_logs/{id}'
   * @param {Object} entry
   */
  syncAuditEntry(entry) {
    const auditId = Utils.generateUniqueId('AUDIT');
    return this.upsertDocument('audit_logs', auditId, entry);
  }
};
