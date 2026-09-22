# Implementation_Plan.md — GSS Management System
## Master build plan: from scratch to deployed

---

## 1. Repository Structure

```
gss-management-system/
├── apps/
│   └── web/                          # Next.js 15 App Router app (UI + API)
│       ├── app/
│       │   ├── (auth)/login/
│       │   ├── (auth)/register/
│       │   ├── (dashboard)/employee/
│       │   ├── (dashboard)/admin/
│       │   ├── (dashboard)/hr/
│       │   ├── (dashboard)/super-admin/
│       │   └── api/
│       │       ├── auth/[...]/
│       │       ├── users/[...]/
│       │       ├── attendance/[...]/
│       │       ├── students/[...]/
│       │       ├── leads/[...]/
│       │       ├── credentials/[...]/
│       │       └── reports/[...]/
│       ├── components/               # UI components (glass panels, gauge, tables, modals)
│       └── lib/                      # feature modules, see §2
├── packages/
│   └── shared/                       # Zod schemas + TS types shared with the future RN app
├── functions/                        # scheduled/background jobs (reports, email queue, backups)
└── .github/workflows/                # CI/CD
```

## 2. Feature Modules & Utilities (one file, one job — per your production-grade requirement)

| Module | File(s) | Responsibility |
|---|---|---|
| Auth | `lib/auth/session.ts`, `lib/auth/login.ts`, `lib/auth/register.ts` | session cookie issue/verify, login (gmail/mobile resolution), registration |
| RBAC | `lib/rbac/permissions.ts`, `lib/rbac/middleware.ts` | central permission matrix (§4) + the guard every API route calls first |
| Users | `lib/users/approve.ts`, `lib/users/changeRole.ts`, `lib/users/deleteUser.ts` | approval flow, double-confirmation role change, soft delete |
| Attendance | `lib/attendance/employeeAttendance.ts`, `lib/attendance/studentAttendance.ts`, `lib/attendance/gauge.ts` | read/write attendance rows, compute the %-for-gauge |
| Students | `lib/students/roster.ts` | CRUD on a tutor's student list |
| Daily Log | `lib/dailylog/loginLogout.ts` | login/logout + planned/completed task entries |
| Leads | `lib/leads/parseUpload.ts`, `lib/leads/dedupe.ts`, `lib/leads/updateStatus.ts` | CSV/XLSX parsing, the Gmail+Mobile dedupe engine, status/remark edits |
| Email credentials | `lib/email/credentials.ts`, `lib/email/crypto.ts` | connect/verify/disconnect an SMTP App Password credential, AES encrypt/decrypt |
| Email sending | `lib/email/provider.ts` (the `EmailProvider` interface), `lib/email/gmailSmtpProvider.ts`, `lib/email/queue.ts`, `lib/email/retry.ts` | provider-agnostic send contract, the day-one Gmail SMTP/Nodemailer implementation, the send queue, backoff/dead-letter handling — see Architecture.md §7 |
| Sheets client | `lib/sheets/client.ts`, `lib/sheets/provision.ts`, `lib/sheets/cache.ts` | one shared authenticated Sheets client, spreadsheet provisioning, the read-through cache |
| Reports | `lib/reports/monthly.ts`, `lib/reports/pdf.ts`, `lib/reports/excel.ts` | assemble report data, render PDF, render Excel |
| Cross-cutting utils | `lib/utils/dateExcludingSunday.ts`, `lib/utils/rateLimiter.ts`, `lib/utils/audit.ts` | working-day calendar generator (the "no Sunday" rule lives in exactly one place), token-bucket limiter, audit-log writer |

Rule of thumb: **any function that touches Sheets or email-sending quota lives behind `lib/sheets/*` or `lib/email/*` and nowhere else, and feature code only ever calls `EmailProvider`, never a Nodemailer transport directly** — this is what keeps both the rate-limiting guarantee in Architecture.md §8 and the "swap providers without a rewrite" promise in §7.3 true as the codebase grows.

## 3. API Route Map

| Route | Method | Role(s) | Purpose |
|---|---|---|---|
| `/api/auth/register` | POST | public | create pending user |
| `/api/auth/login` | POST | public | gmail/mobile + password → session |
| `/api/users` | GET | admin, super_admin | list/search users |
| `/api/users/:uid/approve` | POST | admin, super_admin | activate a pending user, set final role |
| `/api/users/:uid/role` | PATCH | super_admin | double-confirmed role change |
| `/api/users/:uid` | DELETE | super_admin | double-confirmed soft delete |
| `/api/attendance/employee/:uid` | GET/POST | self (read), admin/super_admin (write) | employee attendance grid |
| `/api/attendance/student/:studentId` | GET/POST | owning employee, admin, super_admin | student attendance + prev-day task tick |
| `/api/students/:uid` | GET/POST/PATCH | owning employee, admin, super_admin | student roster CRUD |
| `/api/dailylog/:uid` | GET/POST | self, admin, super_admin (read) | login/logout + task log |
| `/api/leads/upload` | POST | hr, admin, super_admin | Internshala file → dedupe → commit |
| `/api/leads` | GET/PATCH | hr, admin, super_admin | list/search, edit status+remark |
| `/api/credentials/email/connect` | POST | hr, admin | save + test-verify a Gmail SMTP App Password |
| `/api/credentials/email/disconnect` | POST | hr, admin | remove a connected credential |
| `/api/email/send` | POST | hr, admin | enqueue outreach email(s) via `EmailProvider`, as connected user |
| `/api/reports/monthly/:uid` | GET | self, admin, super_admin | generate/download report |

## 4. RBAC Permission Matrix

| Capability | Employee | HR | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|
| View own profile/attendance/gauge | ✅ | ✅ | ✅ | ✅ |
| Log own login/logout + tasks | ✅ | ✅ | ✅ | ✅ |
| Manage own students + student attendance | ✅ | — | ✅ (view) | ✅ (view) |
| Mark own employee attendance | ❌ (Admin does this) | ❌ | ✅ | ✅ |
| View all employee profiles | ❌ | Read-only (per PRD resolution) | ✅ | ✅ |
| Edit employee attendance (any) | ❌ | ❌ | ✅ | ✅ |
| Upload/dedupe Internshala leads | ❌ | ✅ | ✅ | ✅ |
| Edit lead status/remark | ❌ | ✅ | ✅ | ✅ |
| Connect own email account (SMTP) for sending | ❌ | ✅ | ✅ | ✅ |
| Approve pending users | ❌ | ❌ | ✅ | ✅ |
| Change any user's role | ❌ | ❌ | ❌ | ✅ (double-confirm) |
| Delete a user | ❌ | ❌ | ❌ | ✅ (double-confirm) |
| Download monthly report (own) | ✅ | ✅ | ✅ | ✅ |
| Download monthly report (any) | ❌ | ❌ | ✅ | ✅ |

*(If GSS actually wants HR to have edit rights on employee attendance per the literal brief, flip that one cell — everything else in the matrix is unaffected.)*

## 5. Build Phases

| Phase | Deliverable | Depends on |
|---|---|---|
| **0 — Setup** | Repo scaffold, Firebase project (dev+staging+prod), Cloudflare Pages project, CI pipeline skeleton, design tokens ported into Tailwind config | Architecture.md §3–4, Design.md §2 |
| **1 — Auth & RBAC** | Registration, login (gmail+mobile), session cookies, approval flow, RBAC middleware + permission matrix wired into every route stub | Phase 0 |
| **2 — Employee Core** | Employee profile, Admin-marked attendance + gauge chart, student roster CRUD, student attendance grid (Sunday-excluded calendar util) | Phase 1 |
| **3 — Daily Log** | Login/logout capture, planned/completed task lists with `+`-add UI | Phase 2 |
| **4 — Admin Oversight** | Employee directory, employee profile drill-down, employee attendance master grid | Phase 2 |
| **5 — Super Admin Controls** | User management table, double-confirmation role-change & delete flows, audit log viewer | Phase 1 |
| **6 — HR Leads Pipeline** | Upload parser, dedupe engine (+ `systemConfig` toggle), candidate table, status/remark editing | Phase 1 |
| **7 — Email Integration** | SMTP App Password connect + test-verify flow, encrypted credential storage, `EmailProvider`/Gmail SMTP send with connection pooling, quota display, queue + retry + dead-letter handling | Phase 6 |
| **8 — Sheets Provisioning & Caching** | Auto-provision per-user/master spreadsheets, read-through cache, batched writes, rate limiter | Phases 2, 6 |
| **9 — Reports** | Monthly PDF + Excel generation as a background job, download UI | Phases 2, 3, 4, 6 |
| **10 — Hardening** | Firestore security rules, audit log completeness pass, accessibility pass, load test against Sheets quota with cache in place | All prior |
| **11 — Deploy** | Staging → production promotion, monitoring/alerting wired | Phase 10 |
| **12 — (v2) React Native Android** | RN client against the existing API, shared `packages/shared` schemas | Phase 11 |

## 6. Local Development Setup

Required environment variables (never committed):
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
CREDENTIAL_ENCRYPTION_KEY=          # 32-byte key for AES-256-GCM, used to encrypt stored SMTP App Passwords
SHEETS_SERVICE_ACCOUNT_EMAIL=
SHEETS_SERVICE_ACCOUNT_KEY=
DEFAULT_SMTP_HOST=smtp.gmail.com
DEFAULT_SMTP_PORT=465
UPSTASH_REDIS_URL= / REST token     # or omit if using Firestore-based cache
SENTRY_DSN=
```
Seed script (`scripts/seed.ts`) should create one Super Admin account directly in Firestore/Auth (bootstrap problem: the very first Super Admin can't be "approved" by anyone) — this is the one account created outside the normal registration flow.

## 7. Testing Strategy

- **Unit:** every `lib/*` module above, especially `dedupe.ts` (dedupe correctness is a business-trust issue) and `dateExcludingSunday.ts` (get this wrong once and every attendance report is wrong).
- **Integration:** API routes against a Firebase emulator + a mocked Sheets client, covering the RBAC matrix (every role × every route, expect 200 or 403 as per §4).
- **E2E:** Playwright (free) covering the double-confirmation delete/role-change flow end-to-end, since that's the highest-consequence user journey in the product.

## 8. CI/CD Pipeline

1. PR opened → GitHub Actions: install, typecheck, lint, unit + integration tests, Firebase emulator spin-up for integration tests.
2. Merge to `main` → build → deploy to staging (Cloudflare Pages preview / Vercel preview against `gss-mgmt-staging` Firebase project) → Playwright smoke test against staging URL.
3. Manual approval gate → promote same build to production.

## 9. Deployment Runbook (Cloudflare Pages target)

1. Create Firebase projects: `gss-mgmt-staging`, `gss-mgmt-prod`.
2. No Google Cloud OAuth consent screen is needed for the SMTP approach (this is one of the practical upsides of SMTP over OAuth — nothing to register or get verified with Google); each Admin/HR user just needs 2-Step Verification on and an App Password generated on their own Google account.
3. `npx @opennextjs/cloudflare build` (or the current equivalent adapter command) to produce the Cloudflare-compatible output.
4. Connect the GitHub repo to a Cloudflare Pages project; set environment variables per §6 in the Cloudflare dashboard for each environment.
5. First deploy → run the seed script against the target Firebase project to bootstrap the first Super Admin.
6. Point the company's subdomain (e.g. `ops.gatewaysoftwaresolutions.com`) at the Cloudflare Pages project via CNAME; Cloudflare issues the TLS certificate automatically.

## 10. Monitoring on Free Tier

- Sentry free tier for exception tracking (client + server).
- Cloudflare's built-in analytics for traffic/requests.
- A simple weekly scheduled function that reads current Firestore/Sheets usage counters and emails Admin if any quota is above 70% of its documented ceiling (Architecture.md §13) — cheap insurance against a surprise 429 storm or an unplanned bill.

## 11. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Sheets API 429s under load | Attendance/leads UI breaks | Caching + batching (Architecture §8); alerting at 70% quota |
| Vercel Hobby non-commercial ToS violation | Account/project suspension risk | Default to Cloudflare Pages target (Architecture §4) |
| Gmail daily send cap (500/2,000) or 100-recipients-per-message cap silently exceeded | Outreach emails fail mid-batch | Quota display + automatic message-splitting + next-day queueing in the send UI (Architecture §7.4) |
| Google flags server-side SMTP sending as "unusual activity" and throttles/blocks it | Sends fail without a clear cause | Treat Gmail as a flaky upstream: retries with backoff, alerting on repeated failures, documented as an expected characteristic of Gmail SMTP (Architecture §7.1) rather than a bug to chase |
| Admin/HR's Google account password change silently revokes the stored App Password | Sending stops with no obvious cause | Scheduled credential health-check flips `needsReconnect`; UI banner prompts re-connect (Architecture §7.2) |
| Admin's personal Gmail is a single point of failure for outreach | Sending stops if that person is unavailable | Encourage a shared Workspace alias for HR outreach where possible, though scoping stays "per-user"; the `EmailProvider` abstraction also makes a company-wide provider (Brevo/SES) a fallback option without a rewrite |
| Gmail SMTP throughput/reliability becomes the binding constraint as GSS grows | Outreach volume outpaces what Gmail SMTP can reliably deliver | Swap in `BrevoProvider`/`SesProvider` behind the same `EmailProvider` interface (Architecture §7.3) — no business-logic changes |
| First Super Admin bootstrap | Nobody can approve the first account | Documented seed script (§6), run once per environment |
| Large Internshala upload causes function timeout | Upload fails on big files | Parse + dedupe as a background job for uploads above a row-count threshold, not inline |
| Free-tier org growth beyond ~150 people | Firestore/Sheets ceilings approached | Cost Ceiling Reference (Architecture §13) is the trigger to reassess, not a surprise |

## 12. Open Items for GSS to Confirm Before Build

- Final call on the HR-attendance-edit-rights ambiguity (§4 note).
- Dedupe rule: AND vs OR on Gmail/Mobile (`systemConfig.leadDedupe.matchRule`).
- Whether "college sessions attended" and "domains handled" in the monthly report are derived from existing student/roster data (assumed) or need a separate manual log — currently assumed derivable from `Students` + `StudentAttendance` tabs.
- Subdomain/DNS ownership for go-live (§9 step 6).
