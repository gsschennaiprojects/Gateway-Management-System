# Enterprise Security, Authentication & RBAC Architecture

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `DOC-SEC-001`  
**Classification:** Enterprise Security Architecture Specification  
**Status:** Production Ready  
**Last Updated:** 2026-09-30  

---

## 1. Security Architecture Overview

The GSS Management System implements an enterprise-grade, defense-in-depth security model designed to satisfy stringent corporate governance and multi-tenant regional compliance requirements across all four branches (**Chennai**, **Coimbatore**, **Madurai**, **Erode**).

```
                                [ CLIENT SURFACE ]
                                        │
           HTTPS + TLS 1.3 / Strict Content-Security-Policy / Subresource Integrity
                                        ▼
                           [ NEXT.JS EDGE / API GATEWAY ]
             - Rate Limiter (IP-based Sliding Window, 100 req/min)
             - CSRF Mitigation (Origin + Referer Header Verification)
             - HTTP-Only, Secure, SameSite=Lax Session Tokens (HMAC-SHA256)
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              [ PRIVILEGED BACKEND ]        [ CLOUD FIRESTORE LAYER ]
           - Firebase Admin SDK (Node)    - Declarative Rules (firestore.rules)
           - Service Account Isolation    - Hardware Token Validation
           - Zero-Cache Memory Client     - Branch-Bound Isolation
```

---

## 2. Role-Based Access Control (RBAC) Matrix

The system defines **five discrete corporate roles**, strictly bound to either universal or regional operational scopes:

| Capability / Route | Super Admin (`superadmin`) | Branch Admin (`admin`) | HR Manager (`hr`) | Staff / Mentor (`employee`) | Trainee (`intern`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Operational Scope** | Universal (`ALL` Branches) | Branch-Scoped | Branch-Scoped | Branch-Scoped | Branch-Scoped |
| **Personal Dashboard (`/dashboard`)** | Full | Full | Full | Full | Self |
| **Daily Worklog & Punch (`/worklog`)** | Full | Full | Full | Self | Self |
| **Assigned Tasks (`/tasks`)** | Global Management | Branch Management | Branch Allocation | Assigned Only | Assigned Only |
| **My Students (`/my-students`)** | Universal Roster | Branch Roster | Read Only | Assigned Cohort | None |
| **Student Directory (`/students`)** | Full (Export/Edit) | Branch (Export/Edit)| Branch (Read/Export)| Branch (Read) | None |
| **Candidate Inquiries (`/leads`)** | Full Pipeline | Branch Pipeline | Full Pipeline | None | None |
| **Staff Directory (`/admin/directory`)**| Universal Master | Branch Master | Branch Master | None | None |
| **Attendance Grid (`/admin/attendance`)**| Universal Edit | Branch Edit | Branch Edit | None | None |
| **Executive Reports (`/reports`)** | Global Exports | Branch Exports | Branch Exports | Personal Dossier | None |
| **User Administration (`/admin/users`)**| Universal Management| Branch Management | None | None | None |
| **Account Approvals (`/admin/approvals`)**| Universal Approval | Branch Approval | None | None | None |
| **Security Audit Logs (`/admin/audit`)** | Full Audit Ledger | Branch Logs | None | None | None |
| **Role Elevation (Dual Confirmation)**| Permitted | Permitted (Non-Super)| Prohibited | Prohibited | Prohibited |

---

## 3. Branch Boundary Governance

Branch scoping prevents cross-branch operational leakage between autonomous regional centers:

* **Super Admin Privilege:** Authorized with `branch = 'ALL'`. Bypasses branch filters to execute multi-branch audits, corporate reallocations, and consolidated reporting.
* **Regional Roles (`CHN`, `CBE`, `MDU`, `ERD`):** Unconditionally constrained to their designated regional branch code. Any API request or Firestore query targeting records belonging to another branch is rejected at the database rules layer (`permission-denied`, 403 Forbidden).
* **Bidirectional Branch Mapping:** System recognizes both 3-letter regional codes (`CHN`, `CBE`, `MDU`, `ERD`) and full enterprise branch identifiers (`BR_CHN_01`, `BR_CBE_02`, `BR_MDU_03`, `BR_ERD_04`).

---

## 4. Zero-Cache Architecture & Workstation Security

To ensure absolute confidentiality on shared training laboratory terminals and administrative workstations, the application enforces a strict **Zero-Cache Client Model**:

1. **Elimination of `localStorage` for Business Data:**
   * No employee records, tasks, worklogs, or student portfolios are cached in browser `localStorage` or `sessionStorage`.
   * Only non-sensitive UI preferences (e.g., collapsed sidebar state, UI theme toggle) are permitted in local storage.
2. **Firestore In-Memory Cache Enforcement:**
   * Client-side Firestore SDK is configured exclusively with `memoryLocalCache()` via `initializeFirestore()`.
   * Browser IndexedDB offline caching is explicitly disabled. When a user closes the browser tab or signs out, all client memory is immediately flushed.
3. **HTTP Cache Control:**
   * All dynamic authenticated Route Handlers emit:
     ```http
     Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
     Pragma: no-cache
     Expires: 0
     ```

---

## 5. Session Management & Dual Confirmation Workflows

### 5.1 Cryptographic Session Tokens
* Authenticated sessions are anchored by cryptographic HMAC-SHA256 signed session cookies (`gms_session`).
* Cookies are delivered with enterprise attributes:
  * `HttpOnly: true` (Inaccessible to browser JavaScript / XSS protection)
  * `Secure: true` (Transmitted strictly over HTTPS in production)
  * `SameSite: Lax` (Mitigates Cross-Site Request Forgery)
  * `Path: /` (Universal routing scope)

### 5.2 Two-Step Punch-Out & Task Completion Guard
* Punch-out requests require verification that all planned daily deliverables are completed.
* If completed tasks are fewer than planned tasks, punch-out is conditionally blocked until the employee provides a documented justification in `incompleteReason`.
* The server validates this constraint during the punch-out mutation, preventing premature departure without administrative documentation.

### 5.3 Double-Confirmation Role Elevation
* Changing user roles in `/admin/users` requires a two-step confirmation dialogue.
* Elevating accounts to administrative standing requires explicit password or MFA verification by the executing administrator.
* State transitions are immediately recorded in the immutable `audit_logs` collection.

---

## 6. Service Account & Secret Isolation

```
                                [ SECRETS MANAGEMENT ]
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
[ CLIENT-FACING ENV (.env.local) ]                       [ PRIVILEGED SERVER ENV ]
- NEXT_PUBLIC_FIREBASE_API_KEY                           - GOOGLE_SERVICE_ACCOUNT_EMAIL
- NEXT_PUBLIC_FIREBASE_PROJECT_ID                        - GOOGLE_PRIVATE_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN                       - SPREADSHEET_ID_CHN / CBE / MDU / ERD
(Safe for browser consumption)                          (Accessible ONLY to server runtime)
```

### Critical Rules
1. **Never Commit Secrets:** Service account private keys (`management-system-*.json`, `firebase-admin-key.json`) and `.env*.local` are strictly excluded from version control via `.gitignore`.
2. **Environment Variable Injection:** In cloud hosting (Vercel, Docker, Cloud Run), private keys are injected as base64-encoded strings or secret references.
3. **Server-Side Only Operations:** Google Sheets API and privileged Firestore admin operations execute exclusively in server-side Route Handlers. Client applications never connect directly to Google Sheets API.
