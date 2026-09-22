# Database_Schema.md — GSS Management System

Two stores, two jobs: **Firestore = identity & security**, **Google Sheets = operational/tabular data**. Nothing is duplicated between them except a pointer (`sheetsIndex`) so the API layer knows which spreadsheet belongs to which user.

---

## 1. Firestore Collections

### `users/{uid}`
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `gmail` | string | unique, also the Firebase Auth email |
| `mobile` | string | unique, E.164 or normalized 10-digit format |
| `role` | enum: `super_admin \| admin \| hr \| employee` | defaults to `employee` on self-registration regardless of requested role |
| `requestedRole` | enum (same as above) | what the user asked for at signup, shown to the approver |
| `status` | enum: `pending \| active \| suspended \| deleted` | gates all authenticated access |
| `startMonthYear` | string (`"2026-07"`) | |
| `createdAt` / `updatedAt` | timestamp | |
| `approvedBy` / `approvedAt` | uid / timestamp, nullable | set on activation |

### `phoneIndex/{mobileNumber}`
| Field | Type | Notes |
|---|---|---|
| `uid` | string | |
| `email` | string | resolved target for mobile-number login |

### `emailCredentials/{uid}` (SMTP)
| Field | Type | Notes |
|---|---|---|
| `smtpHost` / `smtpPort` | string / number | `smtp.gmail.com` / `465` by default; kept configurable so a future non-Gmail provider fits the same document shape |
| `encryptedAppPassword` | string (AES-256-GCM ciphertext) | the 16-character Gmail App Password, never sent to client after initial entry |
| `fromEmail` | string | the Gmail address actually connected — shown in UI so the user can confirm it's the right account |
| `verifiedAt` | timestamp | set when the one-time test send (Architecture.md §7.2) succeeds |
| `needsReconnect` | boolean | flipped by the scheduled health-check when Google rejects the credential (e.g. password changed) |
| `provider` | enum: `gmail_smtp \| brevo \| ses \| postmark` | which `EmailProvider` implementation this credential belongs to — defaults to `gmail_smtp`, exists so a future scale-out provider (Architecture.md §7.3) is just a new row shape, not a new collection |

### `sheetsIndex/{uid}`
| Field | Type | Notes |
|---|---|---|
| `spreadsheetId` | string | the employee's or HR's own spreadsheet |
| `spreadsheetType` | enum: `employee \| hr` | |
| `provisionedAt` | timestamp | |

### `auditLog/{entryId}` (append-only)
| Field | Type | Notes |
|---|---|---|
| `actorUid`, `actorName` | string | who did it |
| `action` | enum: `role_change \| delete \| restore \| credential_connect \| credential_disconnect \| lead_upload \| status_edit` | |
| `targetUid` (nullable) | string | who/what it was done to |
| `before` / `after` | map, nullable | for role/status changes |
| `reason` | string, nullable | required for `delete` |
| `timestamp` | timestamp | |

### `systemConfig/leadDedupe`
| Field | Type | Notes |
|---|---|---|
| `matchRule` | enum: `AND \| OR` | AND = must match both Gmail+Mobile to be a duplicate; OR = either matching is enough (stricter dedupe) |
| `attendanceStatuses` | string[] | default `["Present","Absent","Holiday"]` |
| `feeStatuses` | string[] | default `["Paid","Partial","Pending"]` |
| `leadStatuses` | string[] | default `["New","Contacted","Interested","Not Interested","Enrolled","Rejected"]` |

**Firestore Security Rules summary:** `users/{uid}` readable by the owner and by `admin`/`super_admin`; writable only via server (Admin SDK) except a user's own non-sensitive profile fields. `emailCredentials`, `auditLog`, `phoneIndex`, `systemConfig` are **server-only** — zero direct client access, enforced in rules as defense-in-depth on top of the API-layer RBAC check.

---

## 2. Google Sheets Structure

### 2.1 Per-Employee Spreadsheet — `GSS-Employee-<uid>`

**Tab: `Attendance`** *(this employee's own attendance — written by Admin/Super Admin only)*
| Date | Day | Status (Present/Absent/Holiday) | MarkedBy | MarkedAt |
|---|---|---|---|---|
Sundays are never inserted as rows when the sheet is provisioned/extended for a new month.

**Tab: `Students`**
| StudentID | Name | College | Domain | Tutor (=this employee) | FeeStatus | StartDate | Duration | HasProject (TRUE/FALSE) | AddedAt |
|---|---|---|---|---|---|---|---|---|---|

**Tab: `StudentAttendance`** *(one row per student per working day)*
| Date | Day | StudentID | Status (Present/Absent/Holiday) | PrevDayTaskDone (TRUE/FALSE) |
|---|---|---|---|---|

**Tab: `DailyLog`**
| Date | LoginTime | PlannedTasks (delimited or JSON string) | LogoutTime | CompletedTasks (delimited or JSON string) |
|---|---|---|---|---|

### 2.2 Per-HR Spreadsheet — `GSS-HR-<uid>`

**Tab: `WorkStatus`**
| Date | CandidateID | ActionTaken (Called/Emailed/Followed-up) | Outcome | Notes |
|---|---|---|---|---|

### 2.3 Shared Master Candidates Spreadsheet — `GSS-Candidates-Master`

**Tab: `Candidates`**
| CandidateID | Name | Gmail | Mobile | City | Status | Remark | Source | UploadedBy | UploadedAt | DedupeKey |
|---|---|---|---|---|---|---|---|---|---|---|

- `DedupeKey` = a normalized hash of Gmail+Mobile (lowercased, whitespace-stripped) computed at ingest time — this is what the dedupe engine actually compares against, not raw string equality, to avoid false "new" records from formatting differences (e.g. `+91` prefix, casing).
- `CandidateID` is a stable system-generated ID (not the row number), so Status/Remark edits and future re-uploads can target the exact record even if rows are re-sorted.

### 2.4 Provisioning Rule
A spreadsheet is created via the Drive/Sheets API **the moment a user's account is approved into a role that needs one** (Employee → personal sheet; HR → personal sheet), owned by the GSS service account, and shared as Editor with that user's Google account and as Viewer with all Admin/Super Admin accounts — so every sheet is inspectable directly in Google Sheets by leadership even outside the app.

---

## 3. Sync & Consistency Notes

- The Next.js API layer is the **only** writer to any Sheet (Architecture.md §1, Principle 4) — this is what makes the cache/rate-limit strategy and the audit log trustworthy.
- Firestore never stores a copy of attendance/student/lead rows — only the pointer (`sheetsIndex`) to where they live. This avoids two-system drift entirely; there is exactly one source of truth per data type.
- **Backups:** Google Sheets' built-in version history covers accidental edits; additionally, schedule a monthly export of each spreadsheet to a dedicated Drive backup folder (via a scheduled function) and a Firestore data export to Cloud Storage, both within free-tier limits at this scale.
