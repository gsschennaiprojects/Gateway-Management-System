# Enterprise Role Workflows & User Operations Guide

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `DOC-USR-001`  
**Classification:** Enterprise Operational User Manual  
**Status:** Production Ready  
**Last Updated:** 2026-09-30  

---

## 1. Role Governance & Personas

The GSS Management System provides tailored user interfaces and permissions based on five standardized corporate personas:

```
                  ┌────────────────────────────────────────────────┐
                  │           SUPER ADMIN (Universal Scope)        │
                  │  Executive oversight, cross-branch governance  │
                  └───────────────────────┬────────────────────────┘
                                          │
                  ┌───────────────────────▼────────────────────────┐
                  │            BRANCH ADMIN (Regional Scope)       │
                  │  Operational management, user approvals, tasks │
                  └───────┬────────────────────────────────┬───────┘
                          │                                │
      ┌───────────────────▼───────────┐    ┌───────────────▼───────────────┐
      │       HR MANAGER (Regional)   │    │     EMPLOYEE / MENTOR         │
      │  Leads, onboarding, attendance│    │  Worklogs, cohorts, deliverables│
      └───────────────────────────────┘    └───────────────┬───────────────┘
                                                           │
                                           ┌───────────────▼───────────────┐
                                           │        INTERN / TRAINEE       │
                                           │  Daily tasks, learning logs   │
                                           └───────────────────────────────┘
```

---

## 2. Super Administrator Workflow

### Primary Objectives:
* Universal governance across all 4 branches (**Chennai**, **Coimbatore**, **Madurai**, **Erode**).
* Institutional policy configuration, audit trail inspection, and administrative role elevation.

### Core Workflows:
1. **Multi-Branch Operational Inspection:**
   * Navigate to `/dashboard` to view consolidated metrics across branches.
   * Switch branch filters (`ALL`, `CHN`, `CBE`, `MDU`, `ERD`) to drill into regional performance.
2. **User Administration & Elevation:**
   * Navigate to `/admin/users` to review all accounts across the company.
   * To elevate a user's role, click **Edit Role**, select the target standing, and confirm via the dual-confirmation dialogue.
3. **Audit Ledger Review:**
   * Navigate to `/admin/audit` to review immutable audit logs. Filter by actor, branch, or action type (e.g. `USER_ROLE_ELEVATED`).
4. **Consolidated Executive Reporting:**
   * Navigate to `/reports` to generate cross-branch monthly attendance, student tenure, and productivity reports in Excel (`.xlsx`) or Word (`.docx`).

---

## 3. Branch Administrator Workflow

### Primary Objectives:
* Regional branch management, user account approvals, task allocation, and daily attendance validation.

### Core Workflows:
1. **User Account Activation & Approvals:**
   * Navigate to `/admin/approvals` to review incoming registrations from newly onboarded branch personnel.
   * Review applicant identity and credentials; click **Approve** to activate the account or **Reject** with documented justification.
2. **Task Delegation & Workload Balancing:**
   * Navigate to `/tasks` and click **New Task Allocation**.
   * Define task title, requirements, deadline, priority (`low`, `medium`, `high`, `urgent`), and assign to individual staff members or team cohorts.
   * Track status progression in the interactive Kanban board (`not_started` $\to$ `in_progress` $\to$ `completed`).
3. **Master Attendance Grid:**
   * Navigate to `/admin/attendance` to inspect the 26-day working calendar grid.
   * Click any cell to cycle attendance statuses (`Present`, `Absent`, `Half Day`, `On Duty`, `Leave`).
   * Working days exclude Sundays per corporate calendar policy.

---

## 4. HR Manager Workflow

### Primary Objectives:
* Candidate admissions intake, applicant tracking, personnel onboarding, and staff attendance monitoring.

### Core Workflows:
1. **Candidate Lead Pipeline:**
   * Navigate to `/leads` to manage incoming applicant inquiries.
   * Import candidate batches via drag-and-drop CSV or Excel spreadsheet.
   * Automated deduplication identifies and merges duplicate candidate submissions based on Gmail address and mobile number.
   * Update lead progression stages (`New Inquiry` $\to$ `Contacted` $\to$ `Interview Scheduled` $\to$ `Enrolled`).
2. **Staff Directory & Roster Review:**
   * Navigate to `/admin/directory` to inspect active branch personnel dossiers, designations, and contact channels.

---

## 5. Employee / Mentor Workflow

### Primary Objectives:
* Daily worklog tracking, punch-in/out logging, deliverable execution, and student mentorship tracking.

### Core Workflows:
1. **Morning Punch-In:**
   * Upon opening the portal, navigate to `/worklog` or click the punch card on `/dashboard`.
   * Click **Punch In**. The system captures the login timestamp.
   * Enter daily planned deliverables in the **Planned Tasks** section.
2. **Task Execution:**
   * Navigate to `/tasks` to review assigned deliverables.
   * Update task status as work progresses (`In Progress`, `Completed`).
3. **Evening Punch-Out (Two-Step Verification):**
   * Navigate to `/worklog` at the end of the shift.
   * Check off completed deliverables.
   * If any planned deliverables remain uncompleted, document the operational reason in **Incomplete Reason**.
   * Click **Punch Out** and confirm in the confirmation modal. Total working hours are automatically computed.
4. **Student Mentorship Management:**
   * Navigate to `/my-students` to manage assigned student cohorts.
   * Update daily attendance for trainees, review milestone submissions, and grade practical assignments.

---

## 6. Common Issues & Troubleshooting

| Issue / Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **Punch-Out button is blocked** | Planned tasks are unchecked and no incomplete reason is provided | Either mark all tasks as completed or fill in the "Incomplete Reason" textarea. |
| **"Permission Denied" on a student or task** | The record belongs to a different regional branch | Regional personnel can only access records from their own branch. Contact Super Admin if branch reassignment is needed. |
| **Account shows "Pending Approval"** | The account has registered but awaits Admin activation | Contact your branch administrator to approve your account in `/admin/approvals`. |
| **Offline status notification displayed** | Internet connection interrupted | The portal maintains UI state. Reconnect to resume synchronization to Cloud Firestore. |
