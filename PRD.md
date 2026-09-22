# PRD — Gateway Software Solutions Management System

**Version:** 1.0 · **Status:** Draft for build · **Owner:** GSS Leadership

---

## 1. Overview

Gateway Software Solutions (GSS) is an IT & ITES company that builds software **and** runs training/internship programs for students. Today, employee attendance, intern/student tracking, tutor attendance, HR lead intake from Internshala, and daily task logging live in scattered spreadsheets and manual processes. The GSS Management System (GMS) consolidates all of this into a single, role-based, premium-feeling web portal, backed by free-tier infrastructure, built to later extend to a React Native Android app on the same backend.

## 2. Goals

- One login for every employee, with permissions strictly scoped to role.
- Give Admin/Super Admin a single pane of glass into every employee's attendance, students, and daily output.
- Give employees (who double as tutors) a fast, low-friction way to log daily attendance for themselves and their students, plus planned/completed tasks.
- Give HR a repeatable, de-duplicated pipeline for turning Internshala exports into tracked candidate leads, with the ability to email candidates from their own official Gmail.
- Ship on infrastructure that costs **$0/month** at current headcount, with a documented, deliberate path to paid tiers if the company outgrows them.
- A UI that reads as premium and considered — not a generic admin-panel template — because this is the tool GSS's own team will judge the company's software craft by.

## 3. Non-Goals (v1)

- Payroll, salary, or compensation processing.
- Biometric/geofenced attendance (this is a self-reported + admin-verified system).
- Student/intern login access — students are data, not users, of this system.
- Multi-organization / multi-tenant support — this is a single-company system.
- Native iOS app (Android via React Native is the only planned mobile client, and is Phase 2).

## 4. Personas

| Persona | Who they are | Primary jobs-to-be-done |
|---|---|---|
| **Super Admin** | Founder/CXO-level | Control who has access to what; the only role that can delete an account or change another user's role; sees everything every other role sees |
| **Admin** | Operations manager | Onboard/approve employees, monitor every employee's attendance and profile, oversee HR's lead pipeline, view all student data |
| **HR** | Recruiter/HR executive | Upload Internshala exports, dedupe and manage candidate leads, update status/remarks, send scheduled emails from their own Gmail |
| **Employee (incl. Tutor)** | Developer/trainer who also mentors interns | Log their own daily attendance, log login/logout with planned & completed tasks, maintain their roster of associated students and mark those students' daily attendance |
| **Student/Intern** (data subject, not a user) | College student in a GSS program | Has a record (name, college, domain, tutor, fee status, dates, project flag) maintained *by* their tutor; never logs in |

## 5. Functional Requirements

### 5.1 Authentication & Account Lifecycle
- **Registration form:** Name, Gmail, Mobile Number, Requested Role, Start Month & Year at GSS, Password (+ confirm).
- **Uniqueness:** Gmail and Mobile Number are each unique across the system; registration blocks on collision with a clear inline error.
- New registrations are created with `status: pending`, `role: employee` regardless of the role requested on the form (see PRD assumption #1 in the README) — an Admin or Super Admin must approve and can set the real role at approval time.
- **Login:** Gmail *or* Mobile Number + Password. No OTP, no magic link.
- **Password reset:** standard "forgot password" email flow via Firebase Auth.
- **Super Admin controls:**
  - Change any user's role (Employee ↔ HR ↔ Admin ↔ Super Admin), gated by a **double-confirmation modal**: (1) confirm the specific change in plain language ("Change Priya Sharma from Employee to HR?"), (2) re-type the user's name or type `CONFIRM` before the action commits.
  - Delete a user's account/ID, gated by the same double-confirmation pattern, with a mandatory reason field logged to the audit trail. Deletion is a **soft delete** (30-day recoverable hold) before permanent purge, to prevent accidental data loss.

### 5.2 Employee Profile & Attendance
- Every employee has a profile: identity fields from registration, current role, start date, tenure (computed), and a live attendance summary.
- Employees mark **their own daily attendance** is actually entered by Admin/Super Admin (per spec — employees don't self-mark their own presence, to avoid self-reporting bias); employees *do* self-log login/logout time and tasks (§5.4).
- Attendance values: `Present / Absent / Holiday`. **Sundays are excluded entirely** — they never appear as a markable day in any attendance grid or calculation.
- Attendance is visualized per employee as a **speedometer/gauge chart** (0–100% attendance rate for the selected month), visible to the employee (their own), Admin, and Super Admin.

### 5.3 Student / Intern Management (per Employee-as-Tutor)
- Each employee maintains a roster of associated students: `Name, College, Domain, Tutor (self), Fee Status (Paid/Partial/Pending), Start Date, Duration, Has Project (boolean)`.
- For each student, the tutor marks **daily attendance** (`Present/Absent/Holiday`, Sundays excluded) via a tick control, plus a separate tick for **"previous day's task completed."**
- All student data and student attendance rolls up into the employee's profile, visible to Admin and Super Admin.

### 5.4 Daily Login / Logout & Task Log
- **Login:** employee logs their login time (defaults to "now," editable) plus one or more **planned tasks for the day** — a text input with a **`+` button to add more tasks** (unbounded list).
- **Logout:** employee logs their logout time plus one or more **completed tasks** — same free-text, `+`-to-add pattern.
- This creates one daily log entry per employee: `{date, loginTime, plannedTasks[], logoutTime, completedTasks[]}`.

### 5.5 HR — Lead / Candidate Pipeline
- HR downloads a candidate export from Internshala (CSV/XLSX) and uploads it to GMS.
- On upload, the system **deduplicates against all previously stored candidates** using **Gmail + Mobile Number as a composite uniqueness key** — a record is only "new" if *both* differ from every existing record (configurable to "either" if GSS prefers a stricter rule — flagged as a config toggle, not hardcoded).
- Cleaned, deduplicated candidates are stored and displayed in the standard column format: `Name, Gmail, Mobile, City, Status, Remark`.
- HR and Admin can edit **Status** and **Remark** on any candidate. Super Admin inherits all HR/Admin privileges.
- HR and Admin can each connect **their own Gmail account via SMTP** (an App Password, not OAuth) to send scheduled outreach emails to candidates from their own official Gmail address (see Architecture.md §7 for the credential flow, the provider-agnostic design that keeps this reliable and scalable as volume grows, and Gmail's daily/per-message sending caps, which the UI must surface to the user rather than let them silently fail).

### 5.6 Reporting
- **Month-end downloadable report per employee**, containing: students maintained (with status), tasks completed (aggregated from daily logs), daily login/logout times for the month, college sessions attended, and domains handled. Delivered as PDF (primary) with an Excel export option.

### 5.7 Data Storage Split (as specified)
- **Google Sheets:** attendance data and "maintenance" data (student rosters, tutor attendance, HR work-status, candidate master sheet) — auto-provisioned per user as described in `Database_Schema.md`.
- **Firebase:** registration, login/identity, and email (SMTP) credential data.

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Security** | RBAC enforced server-side on every API route, not just hidden in the UI; encrypted-at-rest SMTP App Passwords; audit log for every role change, deletion, and credential connection |
| **Privacy** | Gmail, mobile number, and candidate PII are personal data under India's DPDP Act 2023 — consent language at registration, a documented retention/deletion policy, and encryption of anything sensitive |
| **Performance** | Dashboard interactions feel instant (<300ms) for a 10–150 person org; report generation may run async and notify on completion |
| **Reliability** | Every external dependency (Sheets API, SMTP) is called through retry-with-backoff, not a bare call; failures are queued/retried and surfaced, never silently dropped (Architecture.md §7.3, §14) |
| **Scalability** | No component has a hardcoded ceiling baked into business logic — mail sending, data storage, and hosting each have a documented, code-light upgrade path (Architecture.md §14) so growth is a config/provider change, not a rewrite |
| **Availability** | No formal SLA at free tier; target 99%+ observed uptime; documented degraded-mode behavior if Google API quotas are hit |
| **Cost** | $0/month infrastructure at current scale; every design decision that risks a paid tier is flagged in `Architecture.md` |
| **Accessibility** | WCAG 2.1 AA: keyboard navigable, visible focus states, color-contrast-safe even through glass/blur surfaces |
| **Responsiveness** | Fully usable at mobile widths (this is also the design surface most likely to be used on the shop floor by tutors marking attendance between sessions) |
| **Extensibility** | Shared TypeScript types/validation schemas structured so the planned React Native Android app can reuse them against the same API |

## 7. Assumptions (consolidated — see README for the full rationale)

1. Self-registration cannot grant a privileged role; approval workflow required.
2. Password-based auth using Gmail or Mobile as identifier; no OTP.
3. Admin/Super Admin edit employee attendance; HR has read-only visibility on it (flagged conflict in source brief).
4. One Sheet per Employee, one Sheet per HR user, one shared Master Candidates Sheet.
5. Scale assumption: 10–150 employees, single org, Asia/Kolkata timezone.
6. Fixed enums for Fee Status, Attendance, Lead Status (listed in §5 and `Database_Schema.md`).
7. Monthly report = PDF + Excel.
8. Email credentials are per-user Gmail SMTP (App Password) connections, not OAuth and not a shared platform credential — architected to swap to a higher-volume provider later without a rewrite.

## 8. Success Metrics

- 100% of active employees have a completed daily login/logout log by end of pilot month.
- Time to onboard a new HR lead batch (upload → deduped → actionable) under 2 minutes for a 500-row Internshala export.
- Zero unauthorized role changes or deletions (every one traceable in the audit log with double-confirmation evidence).
- Monthly report generated and downloaded for 100% of employees within 3 business days of month-end.

## 9. Release Phases

| Phase | Scope |
|---|---|
| **MVP** | Auth + RBAC + approval flow, employee profile, employee attendance (Admin-marked), speedometer chart |
| **v1** | Student/tutor module, daily login/logout + task log, Super Admin role/delete controls |
| **v1.1** | HR Internshala pipeline, dedupe engine, Gmail SMTP connection + scheduled email |
| **v1.2** | Month-end report generation (PDF/Excel) |
| **v2** | React Native Android app on the same backend |
