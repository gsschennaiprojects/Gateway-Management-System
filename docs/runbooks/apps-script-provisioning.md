# Apps Script branch spreadsheet setup

Apps Script manages spreadsheet structure, formatting, and dashboards. Firestore is canonical; this project intentionally has no direct Firestore REST writes. Branch-specific sheets must not be treated as canonical records until a retryable server projection worker is deployed.

## Configure a branch

1. Create or open the branch spreadsheet with the account that will own the bound Apps Script project.
2. Open **Extensions → Apps Script** and add the checked-in `google-apps-script` sources and `appsscript.json` to that bound project.
3. From the Apps Script editor, run `configureCurrentBranch(branchId, branchCode, branchName, location, timeZone)` using the approved branch record values. It records the active spreadsheet ID in Script Properties and rejects an unconfigured or mismatched spreadsheet.
4. Run `provisionCurrentBranch()` and approve the requested Google scopes. It creates/validates the known tabs idempotently, preserves unknown tabs and existing rows, and protects the recognized projection tabs against manual edits.
5. Run `setupSystemTriggers()` once. Re-running it replaces only this project's named GSS triggers, not unrelated triggers.
6. Confirm the branch details/settings rows, protections, dashboard, trigger list, and spreadsheet owner. Record the spreadsheet ID, branch ID/code, script deployment/version, operator, and date in the deployment ticket.

## Rollback

The setup does not delete rows or tabs. To roll back, disable only the two named GSS triggers and remove the protection whose description is `GSS canonical projection — app-managed` after confirming the spreadsheet owner. Do not delete the spreadsheet or any existing row during rollback.

## Current deployment limits

There is no checked-in Apps Script deployment ID or automated clasp pipeline because none was present in the repository. Provisioning has not been run against a real branch spreadsheet. Existing legacy menu handlers remain in source for compatibility but are no longer exposed in the spreadsheet menu; direct Firestore sync helpers are disabled. A production release still needs staging spreadsheets, operator authorization, and a server-side outbox worker that upserts rows by stable entity ID.
