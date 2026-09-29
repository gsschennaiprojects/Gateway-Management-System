# GMS Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing GMS application into alignment with the supplied Firebase Auth + Firestore-canonical + Sheets-projection architecture, while protecting current production data and proving behavior with automated checks.

**Architecture:** Keep the current Next.js App Router application. Replace custom password/session authority with Firebase Auth and verified Firebase session cookies; load role/branch/status from Firestore profiles. Store application entities and durable mutations in Firestore, with an idempotent projection outbox to branch spreadsheets. Use a shared, configurable Apps Script project for noncanonical spreadsheet setup/automation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase JS SDK 12, Firebase Admin SDK 14, Cloud Firestore, Google Sheets API v4, Google Apps Script, Jest 30, Playwright 1.63, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-09-29-gms-production-readiness-design.md`

## Global Constraints

- Firebase Auth alone validates passwords; do not store plaintext or password hashes in Firestore, Sheets, logs, or client storage.
- Firestore is canonical for application data. Google Sheets is an idempotent projection and must never be used as a silent fallback source of truth.
- Keep employee IDs stable and distinct from Firebase UIDs; use branch IDs/codes consistently in persisted records.
- Server routes derive actor, role, and branch from a verified Firebase session plus the current Firestore profile, never request body or stale cookie claims.
- No process-local store is a durable fallback; no request may return a durable-success response after the canonical Firestore write failed.
- Do not access, modify, migrate, or delete live Firebase/Sheets data in this implementation. Keep migrations dry-run by default and preserve all unknown records/tabs.
- Preserve the existing UI and routes unless they conflict with validated security or data-integrity rules.
- Do not add dependencies unless the installed project cannot implement the required behavior; do not run browser checks outside the mandated gstack `/browse` workflow.

## Review Focus

- Unknown email/mobile and wrong password must have indistinguishable login failures and create no session.
- A pending/rejected/disabled user or a user whose branch/role changed after login must not retain stale access.
- Duplicate/replayed punch, task transition, approval, and projection requests must not create extra logical records.
- An authenticated actor cannot spoof audit metadata or read/write another branch's data through query/body IDs.
- Firestore success with Sheets failure must be reported as canonical success plus pending projection; Firestore failure must never be reported as success.

## File and Interface Map

- Modify `apps/web/src/lib/auth/session.ts` to own Firebase session-cookie issue/verify/clear and return the current profile.
- Modify `apps/web/src/lib/firebase/firebase-admin.ts` or split focused repositories under `src/lib/firebase/` for Auth users, profiles, outbox, and operational records; remove password fields and memory fallback adapters from runtime paths.
- Modify auth routes under `apps/web/src/app/api/auth/` for Firebase Auth login, registration, profile, approval, role/status edits, and deletion.
- Add a shared `src/lib/api/` access guard/input/origin utilities; migrate every API route to it.
- Replace mixed persistence in `src/app/api/worklogs/route.ts`, `tasks/route.ts`, `notifications/route.ts`, and `sheets/route.ts` with canonical repositories and projection jobs.
- Modify `firestore.rules`; add `firestore.indexes.json`, `firebase.json`, and emulator-backed rule tests only after confirming local Firebase CLI availability or adding the pinned dev tooling.
- Add projection worker/routes and `src/lib/projections/` adapters; use stable entity IDs and branch index records from Firestore.
- Refactor `google-apps-script/Config.gs`, `Code.gs`, `Utils.gs`, and branch modules to use script properties, schema versions, idempotent provisioning, protected source tabs, and safe trigger install/remove.
- Add `scripts/migrate-auth-and-profiles.ts` and reconciliation reports in dry-run mode; never run apply mode against production.
- Update `SYSTEM_ARCHITECTURE.md`, `.env.example`, deployment instructions, and audit/checklist documents after behavior is implemented.

## Tasks

### Task 1: Establish safe test and schema baseline

**Files:**
- Create tests under `apps/web/src/lib/auth/`, `src/lib/api/`, `src/lib/projections/`, and route-level test directories.
- Modify `apps/web/package.json`, `firebase.json`, and `firestore.indexes.json` only if tool availability and queries require them.

- [ ] Record current `npm test -- --runInBand`, `tsc --noEmit`, `eslint .`, `npm run build`, and `git diff --check` results without altering env files.
- [ ] Add failing unit cases for profile mapping (uid vs employeeId, branchId, role/status), idempotency-key validation, worklog local-date key, legal task transitions, and generic login errors.
- [ ] Add an isolated Firebase Emulator Suite config and rules test harness; use emulator ports only and refuse to run when emulator host points at a production project.
- [ ] Run the new tests to prove they fail for the current implementation; do not seed remote data.

**Deliverable:** repeatable local checks and a schema/test baseline that cannot address the configured production project.

### Task 2: Firebase Auth session and current-profile guard

**Files:**
- Modify `apps/web/src/lib/auth/session.ts`, `src/lib/firebase/firebase-admin.ts`, `src/types/auth.ts`.
- Create `apps/web/src/lib/auth/profile-mapper.ts`, `src/lib/api/session-guard.ts`, and tests alongside them.

- [ ] Define `FirebaseProfile` with `uid`, stable `employeeId`, `branchId`, display branch, role, status, and timestamps; reject malformed/unknown role or branch values.
- [ ] Implement `setSessionCookie(idToken)` using Admin `createSessionCookie`; cookie max age must satisfy Firebase's supported range and use HttpOnly, SameSite=Lax, Secure in production, path `/`.
- [ ] Implement `getSession({allowPending})` with `verifySessionCookie(cookie, true)`, then load `users/{uid}` from Firestore. Clear/deny absent, disabled, rejected, or deleted profiles; return pending only to the pending/me experience.
- [ ] Remove deterministic/fixed signing secrets and the old HMAC user-payload token. Make logout clear the cookie and avoid writing attendance.
- [ ] Test invalid, expired, revoked, missing-profile, pending, inactive, updated-role, and updated-branch session cases with mocked Auth/Firestore plus emulator coverage when available.

**Deliverable:** all callers can obtain a current, server-verified profile without trusting cookie-supplied role/branch.

### Task 3: Firebase Auth account lifecycle and legacy migration

**Files:**
- Modify `apps/web/src/app/api/auth/login/route.ts`, `register/route.ts`, `me/route.ts`, `users/route.ts`.
- Modify `src/lib/firebase/firebase-admin.ts`, `src/lib/auth/user-store.ts`, `src/lib/auth/password.ts`, `src/context/AuthContext.tsx`, login/register screens.
- Create `src/lib/auth/firebase-identity-toolkit.ts`, migration script, and auth API tests.

- [ ] Implement Firebase Auth email/password verification via the configured Firebase Identity Toolkit endpoint; for mobile login, resolve normalized mobile through server-only Firestore `phoneIndex`, then submit credentials to Firebase Auth. Return the same public error for unknown identifier and invalid password.
- [ ] On successful Firebase Auth validation, issue Firebase session cookie and return the sanitized current Firestore profile. Enforce generic rate limits and same-origin POST requirements.
- [ ] Registration validates the public role allowlist and branch/domain fields, creates Firebase Auth identity, writes pending `users/{uid}` plus `phoneIndex` transactionally/idempotently, and compensates Auth creation on Firestore failure.
- [ ] Approval/rejection/role edit/delete use Firebase Admin Auth and Firestore together as retryable, idempotent lifecycle operations. Approval updates status/enabled state and enqueues roster projection; elevated roles require Super Admin.
- [ ] Remove `passwordHash` and `password` from Firestore profile writes/mappers and client-visible responses. Remove production authentication use of `user-store.ts` and its implicit mock/in-memory fallback.
- [ ] Create migration command with `--dry-run` default. It inventories legacy IDs/emails/mobile and produces a redacted collision report; apply mode creates/links Firebase users in disabled/reset-required state and removes legacy credential fields only after explicit confirmation and successful mapping. Never print passwords, hashes, private keys, or tokens.
- [ ] Test migration idempotency, duplicate email/mobile/UID collisions, rollback on partial failure, and password reset-required flow. Do not execute apply mode on live collections.

**Deliverable:** Firebase Auth owns credentials and account status changes; old hashes are not copied into Auth or retained in exposed profile documents.

### Task 4: Central API authorization and audit integrity

**Files:**
- Create `apps/web/src/lib/api/authorize.ts`, `same-origin.ts`, and validation helpers/tests.
- Modify all route handlers in `apps/web/src/app/api/**/route.ts`, especially `admin/audit`, `admin/seed-branches`, `sheets`, `users`, `tasks`, `worklogs`, and `notifications`.
- Modify `src/lib/audit/audit-service.ts` and RBAC tests.

- [ ] Require active Firebase-backed session for every private endpoint; explicitly mark only login, registration, reset request, and health readiness as public.
- [ ] Require same-origin/anti-CSRF validation for cookie-authenticated mutations.
- [ ] Derive audit actor UID/employee ID/role/branch from the verified session; reject client-supplied actor identity fields and protect audit read/write endpoints by role.
- [ ] Enforce the documented capability matrix and branch scope on resources after loading their canonical Firestore profile; HR and branch admins cannot query or mutate another branch.
- [ ] Validate request schemas, enums, dates, and body sizes; use stable generic error envelopes without exception or credential leakage.
- [ ] Add negative route tests for anonymous, pending, rejected, suspended, wrong-branch, insufficient-role, body-spoofed actor, malformed query, and cross-resource-ID access.

**Deliverable:** every API has a tested authorization boundary independent of UI hiding.

### Task 5: Firestore canonical repositories and atomic domain mutations

**Files:**
- Create focused repository files under `apps/web/src/lib/firestore/` or `src/lib/data/` for branches, users, tasks, worklogs/attendance, students/progress, notifications, and projection jobs.
- Modify `src/lib/firebase/firebase-admin.ts`, task/worklog stores, and all consumers.

- [ ] Define common persisted fields `id`, `branchId`, `createdAt`, `updatedAt`, `createdByUid`, and `requestId`; maintain explicit user/assignee/student relationships.
- [ ] Implement Firestore transactions/batches for create/update with uniqueness and idempotency checks. Store tasks once with assignee IDs/mapping; record status history separately.
- [ ] Validate task states Assigned, On Progress, Completed, Partially Stopped; enforce date ordering and a reason for partially stopped tasks; update the same task document.
- [ ] Validate student assignment, attendance, progress, and branch ownership against Firestore entities; do not fall back to seed/demo content when canonical reads fail.
- [ ] Persist notifications from task mutations through a durable outbox and scope mark-read to the authenticated recipient.
- [ ] Remove process-local task/user/worklog/notification state from route response paths; retain only bounded cache for reads that do not mask failed canonical reads.
- [ ] Add tests for duplicate requests, concurrent updates, non-existent IDs, mismatched branches/assignees, and atomic history/notification creation.

**Deliverable:** canonical repositories return success only after durable Firestore writes and enforce data relationships.

### Task 6: Correct worklog and attendance lifecycle

**Files:**
- Modify `apps/web/src/app/api/worklogs/route.ts`, `api/auth/logout/route.ts`, `src/lib/worklogs/useDailySession.ts`, `src/lib/worklogs/worklog-store.ts`, and worklog helpers/types/tests.

- [ ] Key each daily record by stable employee ID and branch-local ISO date; calculate the date/day using configured IANA timezone, not server UTC.
- [ ] Restrict punch-in/out to today's record and the authenticated employee; remove client-supplied arbitrary log IDs and arbitrary clear/delete operations.
- [ ] Punch-in is a single transition from not-punched-in to punched-in; punch-out is allowed once, requires task completion data and a minimum-length reason for each incomplete task, and computes hours from validated timestamps.
- [ ] Return conflict for invalid/replayed/out-of-order transitions; writes are idempotent by request ID and do not fabricate 8.5-hour records.
- [ ] Make logout clear the Firebase session only. Require the user to perform explicit validated punch-out before sign-out if they have an open worklog; logout cannot auto-complete attendance.
- [ ] Remove Firestore/Sheets dual writes and memory response fallback; worklog canonical write and projection job enqueue occur in one Firestore transaction.
- [ ] Test Kolkata date boundary, DST-safe IANA calculation, duplicate punch, invalid time ordering, missing per-task reasons, existing open record, logout without punch-out, and branch/user isolation.

**Deliverable:** truthful attendance/work-hour records with durable, branch-timezone-aware punch transitions.

### Task 7: Idempotent Sheets projection and branch index

**Files:**
- Create `apps/web/src/lib/projections/sheets-projector.ts`, projection worker route, Firestore job repository and tests.
- Modify `apps/web/src/app/api/sheets/route.ts`, `src/lib/sheets/sheets-service.ts`, `src/lib/seed-branches.ts`, `.env.example`.

- [ ] Replace finite hardcoded branch-to-spreadsheet map in runtime reads with Firestore `branches/{branchId}` and `sheetsIndex/{branchId}` records; validate spreadsheet pointer before any call.
- [ ] Implement job lease, attempt count, retry-after, last error redaction, and completion state; make job keys unique on entity/type/revision.
- [ ] Project by stable ID using find-and-update/upsert; repeated execution updates the same row. Batch writes within API limits and do not append duplicate snapshots.
- [ ] Remove sheet/Firestore fallback reads from canonical UI APIs. Keep compatibility query routes but make them read Firestore and return explicit projection status; only Super Admin can manage projection retries.
- [ ] Treat absent spreadsheet config as a visible setup state. Treat Sheets API failure as projection-pending, never as canonical data loss.
- [ ] Test routing to each configured branch, unknown branch denial, retry idempotency, stale job lease recovery, duplicate existing rows, and quota/error propagation.

**Deliverable:** Sheets accurately reflect Firestore and can recover after outages without duplicate records.

### Task 8: Branch Apps Script provisioning and automation

**Files:**
- Refactor `google-apps-script/Config.gs`, `Code.gs`, `Utils.gs`, `Validation.gs`, `Attendance.gs`, `Task.gs`, and branch feature modules.
- Create versioned manifest, setup/install scripts where supported, schema smoke tests, and `docs/runbooks/apps-script-provisioning.md`.

- [ ] Remove hardcoded production spreadsheet IDs, API keys, branch lists, and credentials from source. Load `BRANCH_ID`, `SPREADSHEET_ID`, schema version, and timezone from Script Properties.
- [ ] Create an idempotent `provisionBranchSpreadsheet(spreadsheetId, branchConfig)` that ensures required tab names, headers, formatting, date/role/status validation, timezone, formulas, and protections without deleting unknown tabs/rows.
- [ ] Add idempotent trigger setup/teardown with one named edit trigger and scheduled maintenance trigger per registered spreadsheet; identify branch from the event spreadsheet and reject unknown IDs.
- [ ] Protect canonical projected tabs from direct record edits; allow dashboard/report cells only. Script updates do not create canonical entities or bypass app permissions.
- [ ] Remove the existing auto-logout/fixed-hour behavior in GAS and route punch behavior to the app's validated canonical workflow or leave cells protected.
- [ ] Add Apps Script unit/smoke checks for all headers, required columns, duplicate-safe provisioning, date/status rules, trigger count, and unknown branch refusal.

**Deliverable:** one reusable, versioned, safe branch spreadsheet setup that supports adding branches by configuration.

### Task 9: Firestore rules, indexes, environment, and operational readiness

**Files:**
- Modify `firestore.rules`, create/modify `firestore.indexes.json`, `firebase.json`, `.env.example`, health route and deployment docs.

- [ ] Align profile IDs and role/branch fields with the implemented persisted schema; default deny everything except the minimum authenticated profile reads. Deny all client writes to identity, approval, operations, outbox, and audit collections.
- [ ] Add required composite indexes for branch/date, status/branch, assignee/status, student/attendance date, and due-task queries discovered from repositories.
- [ ] Add environment startup validation for Firebase project, service account/ADC, Sheets credentials, session cookie settings, app URL, and optional Apps Script deployment; return configuration names only, never values.
- [ ] Replace speculative health claims with liveness plus readiness checks for configured/available Firestore and Sheets and measured metrics. Return 503 when required canonical persistence is unavailable.
- [ ] Add idempotent backup/restore runbooks and verify restore in emulator/staging only; document scheduler, alert thresholds, rate limits, secret rotation, deployment, rollback, and migration preflight.
- [ ] Add emulator tests proving client users cannot read credential fields or write privileged collections and cannot cross branch boundaries.

**Deliverable:** production configuration and security behavior are explicit, testable, and accurately observable.

### Task 10: Full regression audit and readiness report

**Files:**
- Update `SYSTEM_ARCHITECTURE.md`, `README.md`, and create `docs/production-readiness-audit.md` with route/role/branch/feature/data lineage/test/defect matrices.

- [ ] Run lint, typecheck, complete unit suite, emulator suite, production build, and all local API integration tests after each migration task.
- [ ] Run browser route/form/responsive/accessibility flows through `/browse` only when its daemon is healthy. If unavailable, mark those checks unverified.
- [ ] Verify test environment uses staging Firebase, staging spreadsheets, synthetic IDs, and a before/after baseline. Clean only records created by the current test run and verify original data is unchanged.
- [ ] Audit every API route and feature against role, branch, canonical data, projection, notifications, and audit logging; record actual test ID/result and any blocker.
- [ ] Perform a final secret scan by filename/pattern without printing secret values; ensure generated credentials are ignored and not tracked.
- [ ] Report production status as READY only if migration, staging data flows, role/branch tests, Sheets projection, browser, backup restore, and rollback are all verified; otherwise report NOT READY with concrete remaining operator action.

**Deliverable:** accurate, evidence-backed readiness report; no fabricated success claims.
