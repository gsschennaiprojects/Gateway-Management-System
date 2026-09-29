# GSS Branch and Workforce Operations Architecture

## Architecture decision

The target system is a Next.js web application backed by Firebase Authentication and Cloud Firestore for identity, role, branch membership, approvals, and audit metadata. Google Sheets is the operational record for branch tasks, daily worklogs, students, student attendance, and student progress. A server-side data-access layer is the only application writer to Sheets. Apps Script is reserved for spreadsheet-native validation, formulas, scheduled jobs, and controlled provisioning; it must not independently create competing records.

```text
Staff / HR / Admin browser
          │ HTTPS, session from Firebase Auth
          ▼
Next.js UI ── Next.js API (authorization, validation, audit, idempotency)
                         │                    │
                         ▼                    ▼
               Firebase Auth             Firestore
               credentials/UID      users, branches, approvals,
                                     settings, audit, sheet pointers
                         │                    │
                         └────────┬───────────┘
                                  ▼
                       Sheets data-access layer
                                  │
                   One operational spreadsheet per branch
                   (master tabs + ID-keyed personal tabs)
                                  ▲
                       Apps Script adapter/triggers
```

### Source of truth and sync direction

| Data | Source of truth | Other-system relationship |
|---|---|---|
| Password, sign-in, UID, password reset | Firebase Authentication | Firestore stores UID/profile pointer only |
| Role, branch membership, account state, approval | Firestore | API reads before every protected operation |
| Attendance, worklog, task, student, student attendance/progress | Branch Google Sheet | Web API reads/writes; Apps Script automates spreadsheet-side operations |
| Sheet IDs, provisioning state, job checkpoints | Firestore | Pointer and operational metadata only |
| Important changes and task status history | Append-only audit/history store | Never infer history from the mutable current task row |

The application must use stable IDs (`Branch_ID`, `User_ID`, `Task_ID`, `Student_ID`) as keys. Names and sheet row numbers are labels/locations, not identity. A task has one main row and a separate assignee mapping; status edits update that row and append history.

## Branch spreadsheet structure

Provision one spreadsheet per branch, with standard tabs:

| Tab | Key columns / purpose |
|---|---|
| `00_Branch_Details` | Branch_ID, name/code, location/address, manager/admin, HR, opening/status, created/updated timestamps |
| `01_Admin_Details` | Admin_ID, Branch_ID, contact, designation, permissions, Firebase_UID, account status, timestamps |
| `02_HR_Details` | HR_ID, Branch_ID, contact, designation, permissions, Firebase_UID, account status, timestamps |
| `03_Employee_Details` | Employee_ID/code, Branch_ID, contact, job/department/domain, manager, HR/Admin IDs, employment/shift/status, skills, Firebase_UID, timestamps |
| `04_Intern_Details` | Intern_ID, branch, college/department/domain, mentor, join/end dates, project/status, attendance/task status |
| `05_Task_Allocation` | Task_ID, dates, creator, title/description, priority/category, status/progress, remarks, timestamps; one row per task |
| `06_Task_Assignees` | Task_ID, Employee_ID, Employee_Name; one mapping per assignee |
| `07_Task_History` | Task_ID, prior/new status, actor, reason, changed timestamp |
| `08_Student_Master` | Student_ID, branch, student/contact/college/course, tutor, dates, fee/project/status, remarks |
| `09_Student_Attendance` | Student_ID, date/day, attendance, login/logout/training hours, tutor, remarks |
| `10_Student_Progress` | Progress_ID, Student_ID, date, tutor, topic/task/status/percentage, practical/assignment/test, next task, remarks |
| `11_Dashboard` | Branch summaries derived from operational tabs; no manually duplicated source data |
| `12_Branch_Settings` | Working hours/days, Sunday/holiday policy, timezone (`Asia/Kolkata`), date format and required-reason policy |
| `13_Audit_Log` | Actor, action, target ID, before/after summary, reason, timestamp, request/job ID |

Each staff member gets logical, ID-keyed sections/tabs for working progress, student details, student attendance, and student progress. Personal sections are views over branch records where possible; duplicate copies must not become a second source of truth. Each worklog is unique by `(Employee_ID, local work date)` and stores day/date generated server-side, login/logout timestamps, planned/completed task IDs, pending reasons, status, calculated duration, and remarks.

## Firestore collections

- `users/{uid}`: employeeId, name, email, normalized mobile, branchId, role, designation, department, status, accountStatus, permissions, createdAt, updatedAt, lastLogin, profileImage.
- `branches/{branchId}`: branchCode, branchName, location, status, adminIds, hrIds, createdAt, updatedAt, settings reference.
- `approvals/{requestId}`: requested user profile, requested role/branch, pending/approved/rejected status, reviewer UID, decision time, rejection reason.
- `sheetsIndex/{branchId}`: spreadsheetId, schemaVersion, provisioning state, provisionedAt, lastSyncAt.
- `auditLog/{entryId}`: actor UID, action, entity type/ID, before/after summary, reason, timestamp, request/job ID (append-only).
- Optional `jobs/{jobId}`: idempotent provisioning/sync job status and retry metadata.

Do not store passwords or authentication tokens in Firestore or Sheets. Firebase Authentication owns credentials. Security Rules deny client writes to role, branch, approval, audit, and provisioning fields; privileged changes go through authenticated server routes.

## Role-permission matrix

| Capability | Super Admin | Branch Admin | HR | Employee | Intern |
|---|---:|---:|---:|---:|---:|
| Manage branches/settings | All | Own branch (delegated) | Read own branch | — | — |
| Approve accounts / manage staff | All | Own branch | Assigned approval scope | — | — |
| Assign and review tasks | All branches | Own branch | Own branch | View/update assigned | View/update assigned |
| Worklog punch and own history | Own | Own | Own | Own | Own |
| Review staff attendance/worklogs | All | Own branch | Own branch | — | — |
| Manage students and progress | All | Own branch | Own branch/assigned | Assigned students | Assigned students |
| View audit/reporting | All | Own branch | Limited own branch | Own records | Own records |

Every permission is enforced in the API after loading the current Firestore profile. Hiding a button is not authorization. Branch-scoped queries must include `branchId` on the server.

## Workflows

### Task

```text
Authorized manager creates Task_ID and one task row
 → assignees recorded in Task_Assignees
 → employee sees assigned task in today's worklog
 → first On Progress transition sets Start_Date
 → Completed sets Completed_Date; Partially Stopped requires reason
 → update the same task row and append Task_History + Audit_Log
```

Valid states are Assigned, On Progress, Completed, and Partially Stopped. Date order is assigned ≤ start ≤ completion. Completion date is blank until Completed. All writes validate allowed transitions, branch ownership, and IDs on the server.

### Employee daily work and punch-out

```text
Firebase sign-in + active Firestore profile
 → server creates/loads unique daily row in branch-local date
 → server records login timestamp and supplies assigned tasks
 → employee records completed tasks and per-task incomplete reasons
 → server validates every incomplete planned task has a reason
 → confirmed punch-out writes logout timestamp and computed hours
```

The confirmation dialog is a review step only. The API must independently enforce the incomplete-reason rule and idempotently update the existing `(Employee_ID, date)` row. Working hours are derived only when both timestamps exist. Sunday and holiday attendance behavior follows branch settings.

### Student

```text
Authorized branch staff assigns Student_ID and tutor
 → one Student_Master row
 → date-keyed attendance row per student/day (no Sunday row unless configured)
 → progress update references Student_ID and date
 → dashboards aggregate attendance/progress from those records
```

### Account approval

```text
Request → Pending → HR/Admin review
 → rejection with reason OR approval
 → server creates/enables Firebase Auth identity
 → writes Firestore profile and branch roster
 → idempotent job provisions ID-keyed operational sections
 → audit outcome and provisioning state
```

Account creation and sheet provisioning must be retry-safe. Partial failures remain pending/recoverable and must not show as fully approved until required steps complete.

### Automation

| Trigger | Work |
|---|---|
| API request / form submit | Validate and persist approval/task/worklog/student mutations; append audit/history |
| Apps Script onEdit | Validate allowed spreadsheet edits, normalize fields, record controlled change history |
| Time-driven hourly | Retry failed idempotent provisioning/sync jobs; surface failures |
| Daily | Apply configured attendance calendar, send operational summaries, export backups/checkpoints |
| Scheduled backup | Versioned Sheets export and Firestore export to restricted Drive/Cloud Storage location |

Apps Script triggers must use service ownership, least-privilege access, bounded batch operations, explicit timezone, and observable error logs. The web app remains the authority for user identity and role checks.

## Security, failure handling, rollout

- Enforce Firebase ID token/session validation and Firestore role/branch checks on every protected route. Rotate session secrets; never use a committed fixed signing key.
- Validate schemas, date order, status transitions, required reasons, uniqueness, and branch scope before external writes.
- Make writes idempotent using request IDs and natural keys; report partial failures clearly and retry only safe operations.
- Preserve append-only audit/history and use soft deletion for critical records.
- Back up daily, retain weekly/monthly exports, and periodically test restoration in a non-production project.
- Deploy to a separate Firebase/Sheets staging environment first. Do not seed fabricated example records into live sheets; sample rows belong in an isolated demo fixture.

## Current implementation gap (verified from this repository)

This document describes the requested target architecture, not a claim that it is already deployed. The repository currently has a Next.js application, Firebase Admin integration, Google API dependencies, in-memory fallback stores, and worklog/task/student UI. It does not yet implement the complete branch-per-spreadsheet Apps Script layer or Firebase Authentication sign-in flow described above. Existing `Architecture.md`, `Database_Schema.md`, and the UI should be reconciled against this target before production rollout. Live Firebase and Google Sheets behavior has not been exercised as part of this local change.
