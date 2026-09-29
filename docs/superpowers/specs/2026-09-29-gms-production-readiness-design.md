# GMS Production Readiness Architecture and Audit

**Status:** implementation authorized by the user's request to audit and correct the system. This is an implementation design, not evidence of a completed deployment.

## User outcome

Deliver a coherent, secure, traceable multi-branch workforce system while preserving the existing Next.js application and the business behavior described by the supplied master prompts. Firebase Authentication owns credentials. Firestore is the canonical application record. Google Sheets is a controlled, retryable operational/reporting projection. Apps Script provisions and maintains branch spreadsheets without becoming a competing source of truth.

## Evidence and precedence

The supplied `ARCHITECTURE RECONCILIATION / PRECEDENCE RULES` says to prefer real project evidence, then business rules and data integrity, then current official documentation, and finally the minimal safe change. It states the target as Firebase Authentication for credentials, Firestore as canonical application data, and Sheets as a controlled projection. The current repository shows Firestore as the primary task/student/account store in parts of the application, but it does not demonstrate a live production source of truth. No live Firestore or Sheets state was accessed during this audit. Therefore this implementation will preserve data, make writes canonical in Firestore, and build a non-destructive migration/reconciliation path. It will not apply a live migration or delete existing spreadsheet records.

## Static audit findings

Findings below are project-observed from repository code; runtime behavior requiring cloud services remains unverified.

| Area | Evidence | Finding and impact |
|---|---|---|
| Authentication | `apps/web/src/app/api/auth/login/route.ts`, `register/route.ts`, `lib/auth/session.ts`, `lib/auth/user-store.ts` | Login checks app-managed password hashes and issues a custom HMAC cookie. Registration and account management use process-local user state. Authentication is not delegated to Firebase Auth. The development signing secret is fixed. |
| Credential exposure | `apps/web/src/lib/firebase/firebase-admin.ts` (`syncUserToFirestore`) and `firestore.rules` (`/users/{uid}`) | User sync writes `passwordHash` and legacy `password`; the rules permit users to read their own user document. A profile read can expose credential material. Remove credential fields and lock rules down. |
| Identity keys | user/session types, Firebase user helpers, auth routes | The code treats the GSS employee ID as a Firebase UID in some flows. The implementation needs distinct `uid` and stable `employeeId` fields and an explicit mapping for existing records. |
| Session freshness | `lib/auth/session.ts`, `api/auth/me/route.ts` | The custom cookie embeds a full user profile. `/me` falls back to claims embedded in the cookie when the profile store is unavailable, so revoked or changed role/branch state can remain trusted. |
| Worklogs | `api/worklogs/route.ts`, `lib/worklogs/worklog-store.ts`, Firestore helpers | Worklogs are read/written through Firestore, process memory, and multiple Sheets tabs. External writes are swallowed or time-limited while the route can still return success. This permits divergence and non-durable success responses. |
| Punch-out | `api/auth/logout/route.ts`, `api/worklogs/route.ts` | Logout records an automatic attendance punch-out using a fixed 8.5 hours, separate from the validated punch-out workflow. It can fabricate hours and bypass incomplete-task reasons. Background work is not awaited. |
| Tasks | `api/tasks/route.ts`, `lib/tasks/task-store.ts`, Firestore and Sheets helpers | Task reads merge memory and Firestore; create/status writes can succeed in memory after Firestore failure; projection uses append paths that can duplicate rows. PATCH lacks demonstrated task ownership/branch/status-transition validation and history guarantees. |
| Students / Sheets API | `api/sheets/route.ts`, `lib/sheets/sheets-service.ts` | One route mixes Firestore reads/writes, Sheets reads/writes, cached results and fallback datasets. Its access helper allows HR across branches, conflicting with the supplied own-branch permission matrix. Branch and feature authorization need per-operation checks. |
| Notifications | `api/notifications/route.ts`, `lib/tasks/task-store.ts` | Reads merge process memory and Firestore. Mark-read operations update both without a durable result contract and do not demonstrate ownership checks for an arbitrary notification ID. |
| Audit API | `api/admin/audit/route.ts` | GET and POST do not authenticate the caller. POST accepts actor identity, role, branch, and action from the request body, allowing spoofed audit entries. |
| Firestore rules | `firestore.rules` | Rules expect uppercase role claims and `branchId` claims while the app uses lowercase roles and branch names. The web code does not demonstrate setting those custom claims. Rules and actual documents need one schema; all client writes to privileged records must be denied. |
| Branch provisioning | `google-apps-script/Config.gs`, `Code.gs`, `Utils.gs`, role modules; `lib/sheets/sheets-service.ts` | GAS contains useful schemas and manual menu setup, and the server already has employee-tab creation helpers. However, branch IDs/spreadsheet IDs are hardcoded, there is no deployable versioned manifest/CI workflow, no single schema version gate, and no retryable branch provisioning job. This is incomplete rather than wholly absent. |
| Operations/configuration | `api/health/route.ts`, environment examples, package config | Health output advertises unverified concurrency and sub-millisecond guarantees. Firebase emulator/index/deployment configuration was not found in the inspected project files. Live integrations, backups, restore, rate limiting, and scheduled projection retries were not verified. |
| Verification | Jest and Playwright configuration | Local unit tests cover selected helpers but no emulator-backed authorization, API lifecycle, branch-isolation, Apps Script deployment, or complete browser workflows were evidenced. Browser verification was blocked because the `/browse` daemon timed out. |

## Target architecture

### Identity and authentication

- Firebase Auth is the only password verifier and credential store. Firestore contains no password, password hash, ID token, or session token.
- A successful Firebase Auth ID token is exchanged server-side for an HttpOnly, Secure-in-production, SameSite cookie using Firebase Admin session-cookie APIs. The API session resolves the current Firestore profile by Firebase UID on each request; it never trusts role or branch copied into an old cookie.
- Profiles use `users/{uid}` and store a separate stable `employeeId`, normalized `branchId`, lowercase application role, status, and timestamps. `phoneIndex/{normalizedE164}` is server-only. Phone/password login must route credential validation through Firebase Auth and return the same generic failure for unknown phone/email and wrong password.
- Registration is an idempotent saga: create Auth identity, create pending Firestore profile and phone index, then enqueue branch-roster projection. On Firestore failure, compensate by deleting the newly-created Auth identity. Approval enables the Firebase user/profile; rejection disables it. Elevated roles are never accepted from public registration.
- Existing scrypt/plaintext app-store accounts require an explicit reset migration. The migration tool is dry-run by default, never copies hashes into Auth, Firestore, or Sheets, and uses Firebase password-reset flows. Existing records and Sheets remain preserved until reconciliation is reviewed.

### Canonical data and projection

- Firestore is canonical for users/branches/approvals, tasks/assignees/history, worklogs/attendance, students/progress, notifications, audit entries, and projection jobs.
- Every mutation validates input, current profile/status, role, branch, ownership, legal state transition, and idempotency key in the API/data layer before a Firestore transaction/batch.
- Projection outbox jobs are written with canonical mutations. A retry-safe worker projects entities to configured branch spreadsheets using stable IDs and row upserts. A projection failure remains visible and retryable; it does not roll back or falsely report a failed canonical save. UI reports saved-to-Firestore and projection state distinctly.
- Sheets are not read as fallback truth for missing Firestore records. Existing records are imported only by a separate dry-run/reconciliation command with collision reports. Sheets tabs are protected from competing edits; Apps Script formulas, dashboards, formatting, validation, and scheduled jobs cannot create a second canonical record.
- Process memory is limited to disposable cache. It is never a fallback store for credentials, user records, tasks, worklogs, notifications, or any other durable entity.

### Branch and Apps Script provisioning

- Branch ID, branch code, timezone/settings, spreadsheet ID, schema version, and provisioning status live in Firestore. There is no hardcoded finite branch map in runtime logic.
- Provisioning is an idempotent job: create or attach a spreadsheet, create/validate standard tabs and headers, apply timezone/format/validation/protections, record the spreadsheet pointer and schema version, and create ID-keyed views/tabs only where needed. Retries update known resources and never delete unknown tabs or rows.
- The shared GAS source reads per-branch Script Properties, validates its spreadsheet and branch identity, and installs named installable triggers idempotently. It does not contain service account private keys or Firebase passwords. Deployment artifacts and a human-operated authorization/runbook are checked in; production deployments are not run from this task without explicit staging/production credentials.

### Security and reliability

- Shared server helpers provide verified-session enforcement, current-profile loading, branch-scoped resource access, same-origin checks for cookie-authenticated mutations, input validation, safe error responses, and audit actor attribution from the verified profile.
- Firestore client rules default-deny and allow only the minimum profile reads required by the UI. All privileged writes remain in authenticated server routes. Add emulator tests for allowed/denied role and branch combinations and required composite indexes.
- Worklog punch-in/punch-out are explicit, idempotent state transitions on `(employeeId, localDate)`. Dates use branch timezone settings. Logout only clears the auth cookie; it never fabricates attendance or working hours. Punch-out is blocked unless every incomplete planned task has a sufficiently detailed reason.
- Task status changes update one task document, preserve assignment mappings, enforce dates/status transitions, append immutable task history/audit records, and create notifications atomically or via an outbox.
- Health checks report actual dependency/configuration readiness and never claim untested throughput.

## Scope and rollout constraints

The implementation covers application source, tests, Firestore rules/indexes, versioned Apps Script source/configuration, dry-run migration/reconciliation tools, and deployment documentation. It does not write to live Firebase/Sheets, send real reset emails, alter cloud rules, deploy GAS, or delete existing records. Production cutover requires a staging Firebase project, staging branch spreadsheets, authorized Firebase/Google credentials, named role test accounts, a successful data reconciliation, and an operator-approved rollout/rollback window.

The gstack `/browse` binary exists, but the shared daemon timed out while starting. External official-document research and visual/E2E verification remain blocked until that daemon is healthy. No browser alternative is used.

## Acceptance criteria

1. No runtime auth path reads, writes, or verifies app-managed password hashes; Firestore user documents contain no `password` or `passwordHash` fields.
2. Login/session/me/logout and every protected API route use a verified Firebase Auth session and the current active Firestore profile.
3. Pending users have only the pending experience; disabled, rejected, deleted, and branch-moved users lose access immediately.
4. Admin API mutations cannot spoof actor identity, cross branch boundaries, assign invalid roles, or operate on resources outside their permission scope.
5. Firestore is the only canonical writer for supported operational entities; durable mutations are idempotent and create projection jobs. Memory or Sheets failure never produces a false durable success.
6. Repeating a worklog punch, task update, notification update, or projection job does not duplicate the logical record. Logout never creates attendance.
7. A branch can be provisioned and retried from Firestore settings without adding application code for that branch; unknown spreadsheet content is preserved.
8. Security rules and indexes match the deployed schema and are covered by emulator tests.
9. Unit, integration/emulator, lint, typecheck, production build, and available browser checks pass. Missing staging/cloud/browser evidence is called out rather than claimed.
