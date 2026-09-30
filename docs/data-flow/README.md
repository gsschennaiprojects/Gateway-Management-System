# Gateway Software Solutions (GSS) — Data Flow & Lineage Architecture

## 1. End-to-End Data Flow Maps

### 1.1 Authentication & Session Hydration Flow

```text
User Submits Credentials (Email/Mobile + Password)
  │
  ▼
Browser: POST /api/auth/login
  │ (origin check + body size check + rate limit)
  ▼
Next.js API Handler (`apps/web/src/app/api/auth/login/route.ts`)
  │
  ├─▶ Lookup user from Cloud Firestore (`users` collection)
  ├─▶ Verify bcrypt password hash (`apps/web/src/lib/auth/password.ts`)
  ├─▶ Check account status: MUST BE 'active' (rejects 'pending' / 'disabled')
  │
  ▼
Generate Cryptographic Session Token (`apps/web/src/lib/auth/session.ts`)
  │ (HMAC-SHA256 signature with 32+ byte secret)
  ▼
Set HTTP-Only Cookie: `gss_session` (SameSite=Lax, Max-Age=7 Days)
  │
  ▼
Browser: AuthContext State Updated (Zero tokens in localStorage)
  │
  ▼
Client Redirect: /dashboard (or /pending if status='pending')
```

---

### 1.2 Staff Registration & Approval Flow

```text
Applicant: /register Form
  │ (name, email, mobile, requestedRole, branch, specializations)
  ▼
POST /api/auth/register
  │ (origin check + body limit)
  ▼
Firestore: Create user document with status: 'pending'
  │
  ▼
Branch Administrator / Super Admin Reviews Pending Queue (`/admin/approvals`)
  │
  ▼
Admin Approves / Assigns Role (`PATCH /api/auth/users`)
  │
  ▼
Firestore Atomic Transaction (`db.runTransaction`):
  ├── 1. Update `users/{uid}`: status='active', role=assignedRole
  ├── 2. Create `phoneIndex/{mobile}`: maps phone number to UID
  ├── 3. Enqueue Projection Job: `projection_jobs/staff:{uid}:{uuid}`
  └── 4. Write Audit Log: `audit_logs/{auditId}` (USER_UPDATE_STATUS)
  │
  ▼
Sheets Background Sync: Synchronizes new staff to `02_Staff_Directory`
```

---

### 1.3 Student Enrollment, Daily Attendance & Progress Flow

```text
Staff / Admin / HR Enrolls Student (`/students` Modal)
  │
  ▼
POST /api/sheets?type=student
  │ (validates branch access, mentor assignment, fee status)
  ▼
Firestore: `syncStudentToFirestore` (`students/{studentId}`)
  │
  ├── Writes canonical student record
  ├── Daily Attendance map: `dailyAttendance[day] = 'present' | 'absent' | 'holiday'`
  └── Daily Tasks map: `dailyTasks[day] = { title, completed }`
  │
  ▼
Dual Projection:
  ├── 1. Per-Staff Sheet Tab: `STU_<mentorStaffId>`
  ├── 2. Central Branch Directory: `06_Student_Directory`
  └── 3. Monthly Progress Tracker: `ATT_<mentorStaffId>`
```

---

### 1.4 Task Assignment & State Machine Lifecycle

```text
Supervisor Creates Task (`POST /api/tasks`)
  │
  ├─▶ Target: Individual (`targetUserId`) OR Group (`targetGroup`)
  ├─▶ Priority: low | medium | high | urgent
  │
  ▼
Firestore Transaction (`db.runTransaction`):
  ├── Create `tasks/{taskId}` with status: 'pending'
  ├── Create `task_history/{taskId}:created`
  ├── Create `notifications/task_assigned:{taskId}:{recipientId}`
  └── Enqueue `projection_jobs/task:{taskId}:created`
  │
  ▼
Assignee Starts Task (`PATCH /api/tasks`):
  │ status transitions: 'pending' ──▶ 'in_progress' (startedAt stamped)
  ▼
Assignee Finalizes Task (`PATCH /api/tasks`):
  │ status transitions: 'in_progress' ──▶ 'completed' (completedAt stamped)
  │ OR 'in_progress' ──▶ 'partially_stopped' (requires reason >= 10 chars)
  ▼
Synchronize to Sheet: Updates `TSK_<staffId>` tab
```

---

### 1.5 Daily Worklog & Punch-Out Lifecycle

```text
Staff Arrives: Clicks "Punch In" (`POST /api/worklogs` action='punchIn')
  │
  ▼
Firestore: `daily_worklogs/{date}_{userId}`
  ├── `loginTime`: stamped (e.g. "09:15 AM")
  ├── `attendanceStatus`: 'present'
  └── `plannedTasks`: initialized
  │
  ▼
Mid-Day Updates: Staff updates task bullet points (`action='save'`)
  │
  ▼
Staff Departure: Clicks "Punch Out" (`POST /api/worklogs` action='punchOut')
  │
  ├── Validates: if incomplete tasks exist, require explanation (>= 10 chars)
  ├── Computes: `hoursLogged` based on loginTime and logoutTime
  └── Stamped: `logoutTime` (e.g. "06:30 PM")
  │
  ▼
Sheets Sync: Updates `WL_<staffId>` tab and branch `04_Staff_Attendance`
```

---

## 2. Complete Data Lineage Matrix

| Entity & Field | Origin | Transformation | Canonical Storage | Derived / UI Representation | External Projection |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Identity & Role** | Self-Registration / Admin Provisioning | Validated against `UserRole` & `Branch` enums; password hashed via bcrypt. | Cloud Firestore `users/{uid}` | User Profile, Sidebar badges, RBAC routing guards | `02_Staff_Directory` sheet tab |
| **Student Roster** | Student Registration Form | Normalized date strings (YYYY-MM-DD), tenure duration calculation. | Cloud Firestore `students/{studentId}` | `/students` table, `/my-students` view, attendance calendar | `STU_<staffId>`, `06_Student_Directory` |
| **Daily Attendance** | Worklog Punch-In Button | Timestamp formatted to localized 12h time string ("hh:mm A"). | Cloud Firestore `daily_worklogs/{date}_{userId}` | Attendance Gauge, Worklog calendar, Admin Attendance dashboard | `WL_<staffId>`, `04_Staff_Attendance` |
| **Task Allocation** | Task Creation Modal | Priority & deadline validation, UUID generation, assignee resolution. | Cloud Firestore `tasks/{taskId}` | `/tasks` kanban/table, Smart Alerts banner, Notification bell | `TSK_<staffId>` sheet tab |
| **Audit Logs** | Server-side administrative actions | Immutable event record containing actor UID, action name, old/new diff. | Cloud Firestore `audit_logs/{auditId}` | `/admin/audit` immutable audit viewer | `09_System_Audit_Log` sheet tab |
| **Session Security** | `/api/auth/login` | HMAC-SHA256 signed payload (Base64url encoded). | HTTP-Only Cookie (`gss_session`) | Client `user` state in `AuthContext` | N/A (Server-Only Secret) |
