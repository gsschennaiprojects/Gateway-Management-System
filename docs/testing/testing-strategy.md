# Automated Testing Architecture & Quality Assurance Strategy

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `DOC-QA-001`  
**Classification:** Quality Assurance & Test Engineering Standard  
**Status:** Production Ready  
**Last Updated:** 2026-09-30  

---

## 1. Testing Philosophy & Quality Gates

The GSS Management System enforces an automated quality assurance model spanning unit, integration, end-to-end, concurrency benchmark, and synthetic audit testing.

```
                    ┌────────────────────────────────────────┐
                    │      E2E & Synthetic Tests (Playwright) │
                    │   Cross-browser, viewports, PWA, auth  │
                    └───────────────────┬────────────────────┘
                                        │
                    ┌───────────────────▼────────────────────┐
                    │    Integration & Route Tests (Jest)    │
                    │  API routes, sessions, RBAC, Firestore │
                    └───────────────────┬────────────────────┘
                                        │
                    ┌───────────────────▼────────────────────┐
                    │       Unit & Utility Tests (Jest)      │
                    │  Permissions, security, export, hashes │
                    └────────────────────────────────────────┘
```

---

## 2. Test Suite Breakdown

### 2.1 Unit & Integration Tests (Jest)
Configured in `apps/web/jest.config.js`. 19 test suites verifying 61 test scenarios across authentication, RBAC, export formats, API route contracts, and state stores.

| Test File | Target Module | Scope |
| :--- | :--- | :--- |
| `src/lib/auth/user-store.test.ts` | In-memory user store | User CRUD, credential lookups, fallback |
| `src/lib/auth/session.test.ts` | Session management | HMAC token creation, validation, tampering |
| `src/lib/auth/password.test.ts` | Password crypto | Scrypt hashing, verification, plain upgrade |
| `src/lib/auth/login-rate-limit.test.ts` | Brute-force protection| IP-based sliding window rate limiter |
| `src/lib/rbac/permissions.test.ts` | RBAC Matrix | Role permissions across all 5 roles |
| `src/lib/api/request-security.test.ts`| CSRF & Origin | Origin/Referer header verification |
| `src/lib/export-utils.test.ts` | Document generation | Excel `.xlsx` and Word `.docx` generators |
| `src/types/student.test.ts` | Student domain types | Data schema validation and defaults |
| `src/app/api/auth/login/route.test.ts` | `/api/auth/login` | Authentication, rate limiting, cookies |
| `src/app/api/auth/logout/route.test.ts`| `/api/auth/logout` | Session teardown, cookie invalidation |
| `src/app/api/auth/me/route.test.ts` | `/api/auth/me` | Current session resolution, profile data |
| `src/app/api/auth/users/route.test.ts` | `/api/auth/users` | User management, role filtering |
| `src/app/api/auth/register/route.test.ts`| `/api/auth/register` | Self-registration pipeline, pending state |
| `src/app/api/auth/password-reset/route.test.ts`| `/api/auth/password-reset` | Password reset link dispatch |
| `src/app/api/health/route.test.ts` | `/api/health` | Health probe uptime and service status |
| `src/app/api/tasks/route.test.ts` | `/api/tasks` | Task FSM transitions, permissions |
| `src/app/api/worklogs/route.test.ts` | `/api/worklogs` | Daily punch-in/out, hours computation |
| `src/app/api/sheets/route.test.ts` | `/api/sheets` | Google Sheets projection bridge |
| `src/app/api/admin/audit/route.test.ts`| `/api/admin/audit` | Audit ledger query and branch scoping |

### 2.2 End-to-End Tests (Playwright)
Configured in `apps/web/playwright.config.ts`. Tests user interaction in real browser engines (Chromium, Firefox, WebKit):

* **`auth-and-routes.spec.ts`:** Full user login flow, role-based dashboard redirects, unauthorized route protection.
* **`legal-and-help.spec.ts`:** Public accessibility of Help Center, Privacy Policy, Terms of Service.
* **`responsive-viewports.spec.ts`:** Mobile (375x667), Tablet (768x1024), and Desktop (1920x1080) responsive layouts and navigation drawers.

### 2.3 Automated Master Audit Harness (`antigravity-master-audit.mjs`)
A 40-checkpoint automated deep audit script verifying:
1. **Zero-Cache Compliance:** Inspects source code to ensure `localStorage` business data caching is eliminated and `memoryLocalCache()` is enforced.
2. **Session Token Cryptography:** Validates HMAC-SHA256 signatures, cookie options, and expiration timestamps.
3. **Finite State Machine Validity:** Validates task transitions (`not_started` $\to$ `in_progress` $\to$ `completed` $\to$ `blocked`).
4. **Live Data Pipeline:** Validates Firestore round-trip read/write capabilities under synthetic test identities.

---

## 3. Test Data Governance & Cleanup Policy

To maintain database hygiene and prevent test records from contaminating production analytics:

1. **Unique Run Lifecycle:** All automated test records are assigned a deterministic prefix:
   ```text
   ANTIGRAVITY_QA_<RUN_ID>
   ```
2. **Zero Orphan Guarantee:** Every test suite that writes to Firestore or Google Sheets registers an automated `afterAll()` cleanup hook that sweeps and purges all documents matching the test execution run ID.
3. **Production Guard:** Automated test fixtures detect `NODE_ENV === 'production'` and abort execution if run against non-whitelisted database instances without explicit override flags.

---

## 4. Test Execution Commands

```bash
# Execute all Jest unit and integration tests (from repo root)
npm test

# Execute Playwright End-to-End test suites
npm run test:e2e

# Execute load and concurrency benchmark
npm run test:benchmark

# Execute the 40-checkpoint master security and lifecycle audit
node apps/web/scripts/antigravity-master-audit.mjs
```
