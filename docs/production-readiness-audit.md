# Production readiness audit

**Status: NOT READY FOR PRODUCTION CUTOVER.** This report describes repository changes and local checks only. No live Firebase, Google Sheets, Apps Script project, browser session, backup, or production account was accessed.

## Implemented in this working tree

- Firebase Admin creates/verifies/revokes HttpOnly session cookies. Each request reloads the current credential-free Firestore profile; stale cookie role/branch claims are not used. Login verifies the password with Firebase Identity Toolkit, uses a shared generic credential error, and applies a Firestore-backed identifier/address throttle.
- Registration creates a Firebase Auth account plus a UID-keyed pending Firestore profile, phone index, and projection job transactionally. It compensates by deleting the Auth account if the Firestore transaction fails. Password reset uses Firebase's reset-email flow with a generic response.
- Auth profile reads no longer map `password` or `passwordHash`; profile writes ignore legacy credential inputs. Firebase Admin configuration no longer contains machine-specific credential paths or silently enters mock persistence mode. The checked-in environment template contains placeholders instead of the prior project key and spreadsheet IDs.
- User, task, worklog, notification, and audit paths use current session identity and Firestore-backed records. Tasks record status history and notifications in the same transaction. Worklogs use explicit server-timed transitions and never auto-punch on logout. Audit entries are attributed to the session and enqueue a projection job.
- Sheets API reads use `private, no-store` responses and branch checks. Operational records no longer fall back to process memory, sample records, or Sheets as canonical data. Student changes write Firestore plus a pending projection job. Unsupported legacy staff attendance/monthly tracker writes return an error instead of false success.
- Task records now retain `startedAt`, `completedAt`, and `stoppedAt` lifecycle timestamps; `partially_stopped` requires a reason and is recorded in task history. Firestore list helpers page through query results instead of silently truncating at 150 or 200 records.
- The staff attendance grid now leaves dates without a stored record blank; it no longer counts unrecorded days as present. The service worker caches only public static assets, never authenticated page navigation or API responses, and the install message no longer claims offline attendance logging.
- Firestore client rules default-deny all client reads/writes. Firebase deployment/emulator configuration and initial indexes are checked in.
- Apps Script no longer contains branch spreadsheet IDs or Firebase project keys. Per-spreadsheet Script Properties identify a branch; setup is repeatable, protects recognized tabs, and replaces only its named triggers. Direct Firestore REST synchronization is disabled.
- Health endpoints report liveness and a real Firestore readiness probe, without unsupported throughput claims.

## Local verification

- ESLint: passed with 0 errors and 0 warnings after final cleanup.
- Jest: 56 tests across 19 suites passed.
- TypeScript: local `tsc --noEmit` passed.
- Next.js production build: passed after the final source changes.
- `git diff --check`: passed; Git printed line-ending conversion warnings for the existing Windows checkout.
- Secret-pattern scan: no hardcoded Firebase API key, private key marker, old machine-specific path, or branch spreadsheet ID found in the checked app config/GAS sources scanned.
- Runtime smoke check: production server returned HTTP 200 for `/` and `/sw.js`; the service worker response was JavaScript and contained the updated static-cache policy. `/api/health` returned liveness. `/api/health?ready=1` returned 503 because this runtime has no usable Google Application Default Credentials, so Firestore readiness is not established.
- Browser verification: blocked. The required `/browse` daemon twice reported that another instance was starting, then timed out. The user's supplied DevTools key error is guarded in the current source; a browser console pass remains outstanding.

## Blocking production work

1. **Legacy identity migration:** existing app-store users and existing Firestore profiles do not yet have a reviewed UID/employee-ID/email/mobile reconciliation or dry-run/apply migration tool. Legacy scrypt passwords cannot be verified by Firebase Auth; eligible users need an operator-approved reset/re-enrollment plan. Existing accounts may not be able to sign in until linked to Firebase Auth profiles.
2. **Projection worker:** mutations enqueue `projection_jobs`, but no lease/retry worker or stable-ID Google Sheets upsert implementation is present. Jobs will remain pending. The Apps Script project has not been installed, authorized, or deployed to staging branch spreadsheets.
3. **Attendance feature gaps:** staff attendance directory and student monthly attendance tracker endpoints now report unavailable because those records have not been migrated to a canonical Firestore schema. They must be implemented before enabling those screens for staff.
4. **Dynamic branches/config:** account registration still accepts the current finite branch allowlist. Runtime branch creation, spreadsheet-pointer validation from Firestore, and adding a new branch without application code remain incomplete.
5. **Cloud safety evidence:** run Firestore rules/index deployment and emulator authorization tests against an isolated project; verify project ID, service account/ADC scopes, Firebase email/password provider, reset-email templates, API key restrictions, and rate-limit retention/TTL settings.
6. **Operational verification:** run migration/reconciliation dry run, test all role/branch workflows with synthetic staging accounts and spreadsheets, exercise outbox retries and quotas, verify backup restore and rollback, then complete browser/accessibility checks through `/browse`.

The feature set is not ready to receive production traffic until these blockers are closed and evidenced. No migration, deployment, credential rotation, spreadsheet provisioning, or live record mutation was performed here.
