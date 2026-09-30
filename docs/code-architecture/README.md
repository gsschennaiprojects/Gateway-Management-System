# Gateway Software Solutions (GSS) — Enterprise Code Architecture

## 1. Executive Architectural Overview

The Gateway Software Solutions (GSS) Management System is architected as an enterprise-grade, monorepo-structured Next.js full-stack web application. It enforces strict separation of concerns across presentation, state management, authoritative data access, and asynchronous reporting projections.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        BROWSER RUNTIME (CLIENT)                        │
│                                                                        │
│   React 19 Server/Client Components  ──▶  useDailySession / useAuth    │
│            ▲                                     │                     │
│            │ (Server Actions & JSON)             ▼ (Fetch with Cookie) │
└────────────┼─────────────────────────────────────┼─────────────────────┘
             │                                     │
             ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS APP ROUTER (SERVER)                       │
│                                                                        │
│   API Route Handlers (/api/*)  ◀──  Request Security & CSRF Guard     │
│            │                                                           │
│            ├──▶ Session Auth Verification (HMAC-SHA256 Token)         │
│            └──▶ RBAC & Branch Permission Guard (permissions.ts)        │
│                         │                                              │
│                         ▼                                              │
│               firebase-admin.ts Service                                │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
┌─────────────────────────┐  ┌──────────────────────────────────────────┐
│     CLOUD FIRESTORE     │  │      GOOGLE SHEETS PROJECTION LAYER      │
│  (AUTHORITATIVE TRUTH)  │  │                                          │
│                         │  │  Queue (projection_jobs)                 │
│  • users                │  │       │                                  │
│  • students             │  │       ▼                                  │
│  • tasks & history      │──┼──▶ sheets-service.ts                     │
│  • daily_worklogs       │  │       │                                  │
│  • audit_logs           │  │       ▼                                  │
│                         │  │  Regional Branch Spreadsheets            │
│                         │  │  (CBE, CHN, MDU, ERD)                    │
└─────────────────────────┘  └──────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities & Module Map

### 2.1 Presentation & UI Layer (`apps/web/src/app` & `components`)
* **Framework:** Next.js 16 (App Router) + React 19.
* **Component Paradigm:** Modern functional components with strict TypeScript prop contracts.
* **Styling:** CSS Design Tokens (`globals.css`) with curated Google Workspace typography (Outfit, Inter, Google Sans) and theme context (`ThemeContext.tsx`).
* **Zero Sensitive Storage:** Neither session tokens nor administrative data are stored in `localStorage` or `sessionStorage`. Browser storage is strictly reserved for non-sensitive UX preferences (`gss_theme`, `gss_sidebar_collapsed`).

### 2.2 Client State & Custom Hooks (`apps/web/src/context` & `lib/worklogs`)
* **`AuthContext.tsx`:** Manages authenticated user state in memory. Hydrates on mount via `GET /api/auth/me`. Coordinates the enterprise logout dialog (`LogoutConfirmationModal.tsx`).
* **`useDailySession.ts`:** Real-time punch-in/out hook calculating elapsed working hours, live timestamps, task deliverable completion, and punch-out validation.
* **`SidebarContext.tsx`:** Manages layout collapse state across desktop and mobile viewports.

### 2.3 Server API & Security Boundary (`apps/web/src/app/api` & `lib/api`)
* **`request-security.ts`:**
  * Enforces same-origin verification (`isSameOriginRequest`) to prevent cross-site request forgery (CSRF).
  * Automatically recognizes Vercel system domains (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL`, and `*.vercel.app`).
  * Enforces request body size limits (`hasOversizedBody`) preventing memory exhaustion attacks.
* **`session.ts`:** Cryptographically generates and validates HMAC-SHA256 session tokens stored in secure, `httpOnly`, `sameSite: 'lax'` cookies (`gss_session`).

### 2.4 Authoritative Data Access Layer (`apps/web/src/lib/firebase/firebase-admin.ts`)
* **Execution Runtime:** Server-side Node.js / Serverless only. Never bundled or leaked to the client browser.
* **Authority:** All mutations against Cloud Firestore run through privileged Firebase Admin SDK methods (`getAdminFirestore()`, `getAdminAuth()`).
* **Atomicity:** Critical multi-entity operations (e.g. staff status changes, task state changes, student enrollment) use Firestore Transactions (`db.runTransaction`) to guarantee ACID compliance.

### 2.5 Operational Projection Layer (`apps/web/src/lib/sheets`)
* **`sheets-config.ts`:** Tab name templates (`WL_<staffId>`, `STU_<staffId>`, `TSK_<staffId>`, `ATT_<staffId>`, `02_Staff_Directory`, etc.) and column layout schemas.
* **`sheets-service.ts`:** Rate-limited Google Sheets API client authenticated via Cloud IAM Service Account (`gss-508@management-system-509313.iam.gserviceaccount.com`).
* **Asynchronous Isolation:** Google Sheets API errors are non-blocking; failed updates queue into `projection_jobs` for background retry without reverting primary database operations.

---

## 3. Role-Based Access Control (RBAC) & Branch Partitioning

Access control is enforced at both the API boundary and Firestore query level:

| Enterprise Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **`superadmin`** | Global (All 4 Branches) | Full access: user approvals, role assignments, system audits, cross-branch analytics. |
| **`admin`** | Regional Branch | Branch management: approve branch staff, assign tasks to HR/Employees/Interns, view branch logs. |
| **`hr`** | Regional Branch | People operations: view staff directory, monitor attendance, track student rosters. |
| **`employee`** | Regional Branch | Technical execution: mentor assigned students, complete assigned tasks, submit daily worklogs. |
| **`intern`** | Regional Branch | Learning contributor: view assigned mentors, complete deliverables, punch in/out daily. |

### Branch Isolation Guarantee
Regional branches (**Coimbatore**, **Chennai**, **Madurai**, **Erode**) operate under strict data partitioning. An administrator in Chennai cannot view, update, or assign tasks to employees or students belonging to Coimbatore.

---

## 4. Error Handling & False-Success Prevention

To guarantee enterprise data integrity, the codebase enforces strict reliability rules:
1. **No Silent Catches:** Catch blocks must log errors or return explicit error payloads with meaningful HTTP status codes (400, 401, 403, 404, 409, 413, 429, 503).
2. **Persistence Confirmation:** UI feedback (toast, modal transition) must wait for server acknowledgment. Optimistic UI is never used for security-critical actions (punch out, role assignment, student fee updates).
3. **Audit Trail:** All sensitive administrative mutations automatically append an immutable audit record to the `audit_logs` collection.
