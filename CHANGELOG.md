# Changelog

All notable changes to the **Gateway Software Solutions (GSS) Management System** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-09-30

### Added
* **Multi-Branch Operations:** Centralized governance across 4 regional technology centers:
  * Chennai (`CHN`, `BR_CHN_01`)
  * Coimbatore (`CBE`, `BR_CBE_02`)
  * Madurai (`MDU`, `BR_MDU_03`)
  * Erode (`ERD`, `BR_ERD_04`)
* **Canonical Firestore Record:** High-concurrency transactional database architecture with declarative security rules in `firestore.rules` and composite indexes in `firestore.indexes.json`.
* **Google Sheets 1-Way Projection:** Asynchronous background projection layer syncing operational data to 4 branch Google Spreadsheets via Cloud IAM Service Account.
* **5-Tier Role Governance (RBAC):** Granular permissions for `superadmin`, `admin`, `hr`, `employee`, and `intern` with hardware-isolated regional scoping.
* **Personnel Time Tracking & Worklogs:** Daily punch-in/out logging, automatic working hours computation, and two-step punch out verification requiring documented reasons for incomplete planned deliverables.
* **Student Mentorship Matrix:** Trainee admissions management, mentorship cohort assignments, milestone grading, and multi-month attendance rollovers.
* **Task Delegation Kanban:** Single-row multi-assignee task allocations, deadline monitoring, and finite state machine tracking (`not_started` $\to$ `in_progress` $\to$ `completed` $\to$ `blocked`).
* **Candidate Inquiry Pipeline:** Drag-and-drop CSV/Excel lead ingestion with automated deduplication by primary email and mobile number.
* **Corporate Reporting:** One-click corporate document generation in audit-ready Excel (`.xlsx`) and formal Word dossier (`.docx`) formats.
* **PWA & Mobile Support:** Progressive Web Application manifest, mobile viewport optimization, and responsive drawer navigation.
* **Enterprise Documentation Suite:** Centralized `docs/` technical documentation portal covering architecture, database, security, local setup, operations, testing, and role workflows.

### Security
* **Zero-Cache Architecture:** Enforced `memoryLocalCache()` on client Firestore SDK and eliminated `localStorage` business data caching to prevent cross-user data leakage on shared laboratory terminals.
* **Session Cryptography:** HMAC-SHA256 signed session tokens delivered via `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
* **Rate Limiting:** Sliding-window IP rate limiter on authentication endpoints mitigating brute-force attacks.
* **Repository Hygiene & Secret Protection:** Comprehensive `.gitignore` hardening strictly excluding service account keys (`*.json`), private keys (`*.pem`), and local environment files (`.env*.local`).

### Changed
* Reorganized root directory: migrated scattered specification files into structured `docs/` hierarchy.
* Moved administrative maintenance scripts (`initialize-branches.js`, `seed-branches-admin.js`) into `scripts/` with dual-path key resolution.
* Removed redundant exact-duplicate public assets (`logo-transparent.png`, `logo.png`) in favor of canonical `brand/gss-logo.png`.
* Standardized npm package scripts: added `typecheck` and targeted `lint` to `src/` directory.
