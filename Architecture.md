# Architecture.md — Gateway Software Solutions Management System

## 1. Architecture Principles

1. **Serverless-first, single deployable.** Next.js (App Router) serves both the UI and the API (Route Handlers) as one deployable unit — no separate backend service to host, patch, or pay for.
2. **Free tier is a boundary, not a hope.** Every external quota (Firestore reads/writes, Sheets API calls, Gmail sends, function invocations) is treated as an architectural constraint the code must respect, not a number to find out about in production.
3. **Sheets and Firestore each own a domain, never the same data.** Firestore owns identity/security (who can log in, what role they have, what credentials they've connected). Sheets owns the tabular, spreadsheet-native operational data (attendance, students, leads) that non-engineers may reasonably want to eyeball or export directly.
4. **The app is the only writer to Sheets, and the only sender of mail.** No client-side Sheets API calls, ever, and no client-side SMTP calls, ever. All reads/writes to Google Sheets go through Next.js API routes using the app's own service account; all outgoing mail goes through a server-side email module authenticating as the connected user (see §7) — this is what makes rate-limiting, caching, retries, and audit logging possible at all.
5. **RBAC is enforced twice:** once in the UI (to keep the experience clean) and unconditionally again in every API route (because the UI check is a courtesy, not a security boundary).
6. **Sending mail is a swappable capability, not a Gmail-specific one.** The business logic (queueing, retries, audit logging, quota display) talks to a small `EmailProvider` interface, not to Gmail directly. Gmail SMTP is the day-one implementation because the brief requires sending as the user's own official Gmail; a higher-throughput provider (Brevo, Amazon SES, Postmark) can be dropped in later behind the same interface with no change to any feature code — this is the concrete mechanism behind "reliable, sustainable, and scalable at any time" for the mail-sending piece specifically.

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser / RN app - Phase 2)       │
│           Next.js App Router UI · shared Zod schemas/types        │
└───────────────────────────┬────────────────────────────────────┘
                            │ HTTPS (session cookie / Firebase ID token)
┌───────────────────────────▼────────────────────────────────────┐
│                  Next.js Route Handlers (API layer)               │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐ ┌─────────────────┐ │
│  │  Auth &   │ │   RBAC    │ │ Rate-limit  │ │  Audit logging   │ │
│  │  Session  │ │ middleware│ │ & queue     │ │  middleware      │ │
│  └───────────┘ └───────────┘ └────────────┘ └─────────────────┘ │
│         Feature modules: attendance · students · leads ·          │
│         reports · credentials · users (see Implementation_Plan)   │
└───────┬───────────────────┬──────────────────────┬──────────────┘
        │                   │                      │
┌───────▼────────┐  ┌───────▼─────────┐   ┌────────▼─────────────┐
│ Firebase        │  │ Google Sheets   │   │ Email Provider layer  │
│  - Auth         │  │  API v4         │   │  (EmailProvider iface)│
│  - Firestore    │  │  - per-employee │   │  → Gmail SMTP today   │
│  - (Storage:    │  │    sheet        │   │  → Brevo/SES/Postmark │
│    optional,    │  │  - per-HR sheet │   │    swap-in later      │
│    report PDFs) │  │  - master leads │   │  (per-user creds, for │
└─────────────────┘  │    sheet        │   │  HR/Admin outreach)   │
                      └─────────────────┘   └────────────────────────┘
```

Hosting: the whole box above (client + API layer) deploys as one Next.js app to **Cloudflare Pages or Vercel** (decision in §4).

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | **Next.js 15 (App Router, TypeScript)** | Per brief; one framework, one deploy, Route Handlers double as the API |
| Identity data | **Firebase Auth + Firestore** | Per brief; free Spark plan covers this scale comfortably |
| Operational data | **Google Sheets API v4** | Per brief; also gives GSS staff a spreadsheet they can eyeball without opening the app |
| UI | React + Tailwind CSS + a small headless component layer (Radix primitives) | Utility CSS keeps the glassmorphism tokens consistent; Radix gives accessible modals/menus for free |
| Charts | Recharts (or a hand-rolled SVG gauge — see Design.md) for the attendance speedometer | Free, lightweight, no paid charting license |
| Validation | Zod (shared between client forms and API route handlers) | One schema, two enforcement points; also the contract the future RN app will reuse |
| PDF/Excel report generation | `@react-pdf/renderer` or Puppeteer-free HTML→PDF via `pdf-lib`; `exceljs` for Excel | All free, no paid PDF service |
| Email sending | **Nodemailer over SMTP** (`smtp.gmail.com`, per-user App Password) behind a provider-agnostic `EmailProvider` interface, with a swap-in path to Brevo/Amazon SES/Postmark | Per brief — sends as the user's own official Gmail; the interface is what makes it "scalable at any time" without a rewrite (see §7) |
| Caching / rate-limit store | Upstash Redis **free tier** (10,000 commands/day) or, if avoiding a 3rd vendor, a Firestore-based token-bucket document | Needed to stay under Sheets' 60 req/min/user, 300 req/min/project caps |
| Background jobs (report generation, scheduled email) | Cloud Scheduler + a Firebase Cloud Function on the **free 2M invocations/month** tier, or Vercel/Cloudflare Cron | Keeps long-running work off the request path (serverless functions have hard execution-time ceilings) |
| Error monitoring | Sentry free tier (5k errors/month) | Free, standard |
| CI/CD | GitHub Actions (2,000 free minutes/month on private repos, unlimited on public) | Standard, free at this scale |

## 4. Hosting Decision — read this before scaffolding the repo

Your brief asks for "free tier" and this is a **commercial company's internal tool**, so the hosting choice has one non-obvious constraint: **Vercel's free Hobby plan is licensed for personal, non-commercial use only.** A tool built for and used by a registered company, even internally, is commercial use under Vercel's terms — the moment that's true, the honest options are Vercel Pro ($20/seat/month) or a host whose free tier explicitly allows commercial use.

| Option | Cost | Commercial use on free tier? | Next.js fit | Notes |
|---|---|---|---|---|
| **Vercel Hobby** | $0 | **No** — ToS-restricted to personal/non-commercial projects | Best-in-class (native ISR, ISR tag revalidation, zero config) | Real legal/ToS risk for a company tool; only use if you accept the risk or plan to upgrade before real usage |
| **Vercel Pro** | $20/seat/month | Yes | Best-in-class | Cleanest technical option once $0 stops being a hard requirement |
| **Cloudflare Pages (+ `@opennextjs/cloudflare` adapter)** | $0 | **Yes, explicitly allowed** | Good — App Router, SSR, ISR, middleware all supported via the adapter; a few edge cases (some ISR/ tag-revalidation patterns) may need workarounds | **Recommended default for a true $0 commercial deployment.** Unlimited bandwidth; dynamic routes run on the Workers free tier (100k requests/day, 10ms CPU/request — comfortably enough for a 10–150 person internal tool) |

**Recommendation:** build against the **Cloudflare Pages + OpenNext adapter** target as the primary, truly-free, ToS-safe option. Structure the Next.js app to avoid Vercel-only APIs (e.g., avoid `next/og` edge-only quirks, keep ISR usage simple) so it also happens to deploy cleanly to Vercel Pro later with zero rework, if GSS ever wants the smoother DX and is willing to pay $20/month.

## 5. Data Architecture

### 5.1 Firestore (identity & security domain)
- `users/{uid}` — profile, role, status (`pending/active/suspended/deleted`), start month/year, timestamps.
- `phoneIndex/{mobileNumber}` — maps mobile number → uid/email, used to resolve mobile-number login to a Firebase Auth email sign-in (Firebase Auth is natively email-keyed).
- `emailCredentials/{uid}` — encrypted SMTP App Password + connected Gmail address for the Admin/HR user who connected their account for outreach; never exposed to the client (full schema in `Database_Schema.md`).
- `auditLog/{entryId}` — append-only: role changes, deletions, credential connect/disconnect, lead uploads.
- `sheetsIndex/{uid}` — the Google Sheet ID(s) provisioned for this user (their personal Attendance/Students sheet, or their HR work-status sheet), so the API layer knows which spreadsheet to write to without re-discovering it.
- `systemConfig/leadDedupe` — the configurable dedupe rule (AND vs OR on Gmail/Mobile) and enum lists (Attendance, Fee Status, Lead Status) called out as assumptions in the PRD, so GSS can tune them without a code change.

Full field-level schema is in `Database_Schema.md`.

### 5.2 Google Sheets (operational data domain)
- **Per-employee spreadsheet** (`GSS-Employee-<uid>`): tabs for `Attendance`, `Students`, `DailyLog`.
- **Per-HR spreadsheet** (`GSS-HR-<uid>`): tab for `WorkStatus` (their outreach/call log against assigned leads).
- **One shared Master Candidates spreadsheet** (`GSS-Candidates-Master`): all deduplicated Internshala leads, editable (Status/Remark) by HR and Admin.
- Sheets are provisioned automatically via the Sheets/Drive API the first time a user's role requires one (on approval for Employees/HR), owned by a GSS service account, and shared with Admin/Super Admin as Viewer/Editor so the raw sheet is always inspectable outside the app if needed.

### 5.3 Why not put everything in Firestore, or everything in Sheets?
- Firestore alone: fine for identity, wrong tool for "a non-engineer might want to open this as a spreadsheet" data, and Firestore document reads/writes aren't free past 50k/20k/day either — no benefit to moving Sheets-shaped data there.
- Sheets alone: no real auth, no security rules, terrible fit for password hashes/SMTP credentials, and every login check would burn Sheets API quota. Wrong tool for identity.

## 6. Authentication & Login Design

1. **Registration** creates a Firebase Auth user (email/password, email = the Gmail provided) plus a Firestore `users/{uid}` doc with `status: pending, role: employee`, plus a `phoneIndex/{mobile}` doc pointing at that uid.
2. **Login by Gmail:** standard Firebase Auth `signInWithEmailAndPassword`.
3. **Login by Mobile Number:** the API layer looks up `phoneIndex/{mobile}` → resolves the associated email → calls `signInWithEmailAndPassword` server-side with that email + the submitted password, then issues the normal session. (Firebase Auth has no native "phone + password" sign-in without SMS, so this indirection is what makes "Gmail or Mobile, password-only, no OTP" possible.)
4. **Session:** Firebase ID token exchanged for an HTTP-only session cookie (Firebase Admin SDK `createSessionCookie`), so RBAC middleware on the server can trust it without a client-side token round-trip on every request.
5. **Approval gate:** any `status !== 'active'` user is blocked from all authenticated routes except a "pending approval" holding page, regardless of what role is stored.
6. **Super Admin double-confirmation** (role change / delete): the API route requires two things in the same request payload — an explicit `confirmationText` matching a server-generated challenge phrase, and re-verification that the caller's own session is still fresh (re-auth if the session is older than, e.g., 15 minutes) — so a hijacked-but-idle tab can't perform a destructive action silently.

## 7. Email Sending Architecture — SMTP, Provider-Agnostic, Built to Scale

You asked for two things that pull in slightly different directions: **send mail via SMTP** (not OAuth/API) as Admin and HR's own official Gmail, and a system that's **reliable, sustainable, and scalable at any time**. Gmail SMTP alone gets you the first; it does not, by itself, get you the second — so the design below gives you Gmail SMTP as the day-one implementation, wrapped in an abstraction that removes it as a scaling ceiling later.

### 7.1 Why SMTP (and what to know about it)
Google requires either OAuth 2.0 or an **App Password** for SMTP auth — the plain account password stopped working for third-party SMTP clients in 2022–2025 as Google phased out "less secure apps." SMTP with an App Password is simpler to build and support than OAuth (no consent-screen verification process, no refresh-token lifecycle to manage), which is almost certainly why it feels like the right fit for an internal tool — but it comes with real operational caveats worth knowing up front rather than discovering in production:

- **App Passwords require 2-Step Verification** to be enabled on the connecting Google account first.
- **App Passwords are silently revoked** if the account's main password is ever changed — the integration breaks until the user generates and re-enters a new one. The system must detect a failed auth and surface "reconnect required," not fail silently.
- **Google actively watches for "unusual" server-side sending behavior** (a data-center IP sending mail for a personal Gmail account looks like account takeover to Google's abuse systems) and can throttle or block a connection without much warning. This is a known, documented friction point of using personal Gmail SMTP for automated/production sending — it is not a bug in your implementation.
- **Hard caps regardless of method:** 500 recipients per rolling 24 hours on a personal Gmail account, 2,000/day on Google Workspace, and — this one catches people off guard — **100 recipients per message via SMTP specifically**, on both account types, so any batch larger than 100 must be split across multiple sends by your queue, not sent as one large Bcc.

None of this means "don't use SMTP" — it means treat Gmail as a real, rate-limited, occasionally-flaky upstream dependency, exactly like you'd treat any third-party API, and build the retry/queue/monitoring around it accordingly (§7.3).

### 7.2 Credential Flow
- Admin/HR open "Connect Email" → enter their Gmail address + a 16-character **App Password** (the UI links to Google's own instructions for enabling 2-Step Verification and generating one) → the system sends one test email to the user's own address via SMTP to confirm the credential works before saving it.
- The App Password is encrypted (AES-256-GCM, key from the hosting platform's secret store, never bundled into client code) and stored in `emailCredentials/{uid}` alongside the SMTP host/port and the confirmed "From" address — never exposed to the browser after initial entry.
- A scheduled health-check (§10 monitoring) periodically sends a no-op SMTP `NOOP`/auth check per connected credential and flips a `needsReconnect` flag the UI surfaces as a banner the moment Google revokes or rejects it, rather than waiting for the next real send to fail.
- Disconnecting, a role change away from HR/Admin, or account deletion all delete the stored credential immediately.

### 7.3 The `EmailProvider` Abstraction (this is the scalability mechanism)
All feature code (candidate outreach, scheduled sends, anything future) calls one internal interface, never a vendor SDK directly:

```ts
interface EmailProvider {
  send(params: { fromUid: string; to: string[]; subject: string; body: string }): Promise<SendResult>;
  getRemainingQuota(fromUid: string): Promise<number>;
}
```

- **Day one:** `GmailSmtpProvider` implements this via Nodemailer with **connection pooling** (`pool: true`, a bounded number of reused TLS connections rather than one connection per email — this alone materially improves reliability and throughput over naive per-message connects) and enforces the 100-recipients-per-message split automatically.
- **Every send goes through a queue, not the request/response cycle:** an outgoing message is written to a Firestore-backed (or Cloud Tasks) queue and processed by a background worker that (a) respects the sender's remaining daily quota, (b) retries transient SMTP errors (421, 450, 452) with exponential backoff, (c) moves anything that fails repeatedly to a **dead-letter list** surfaced in the HR UI instead of silently disappearing, and (d) spreads a large batch across the day rather than bursting it.
- **Swap-in path, when GSS outgrows Gmail SMTP:** because everything upstream only ever calls `EmailProvider`, adding `BrevoProvider` (300 free emails/day, forever, no sandbox — a realistic free next step) or `SesProvider` (essentially $0.10 per 1,000 emails at any volume, once you're past the point where "free" is the binding constraint) is a new class plus a config flag — **zero changes to queueing, retries, audit logging, RBAC, or UI.** This is what makes the mail-sending piece of the system scalable "at any time" without a rewrite: the ceiling moves, the architecture doesn't.
- If GSS ever sends outreach at volume from its own domain (rather than individual staff Gmail addresses), that migration is also the point to set up SPF/DKIM/DMARC on the company domain — not required for individual Gmail SMTP sending, but required for good deliverability on any of the scale-out providers above.

### 7.4 Sending Cap Visibility
The HR/Admin send screen always shows *remaining* quota for the connected account today (derived from `getRemainingQuota`, tracked against the queue's own send log, since Gmail doesn't expose a quota-remaining API) and queues anything over the cap for the next day automatically, with a clear "N recipients queued for tomorrow" message — never a mid-batch failure with no explanation.

## 8. Rate-Limiting & Caching Strategy (this is what keeps you inside free quotas)

Google Sheets API v4, as of 2026, allows **300 read requests/minute per project** and **60 requests/minute per user/service-account** (write quota is separate and comparable); Gmail SMTP send is capped at 500 recipients/day (personal Gmail) or 2,000/day (Workspace), with a hard **100 recipients per message** ceiling on top of that regardless of account type. None of these are "unlimited," and a naive implementation (e.g., re-reading a Sheet on every dashboard render, or one SMTP connection per email) will hit a 429/throttling wall well before headcount does.

- **Read-through cache:** every Sheets read goes through a cache layer (Upstash Redis free tier, or a Firestore-cached-snapshot document if you want to avoid a third vendor) with a short TTL (e.g., 30–60s for attendance grids, longer for rarely-changing student rosters). Dashboards read the cache; writes invalidate the specific cache key they touched.
- **Batched writes:** attendance ticks and task-log entries are debounced client-side (e.g., 2–3 seconds) and written as a single `batchUpdate` call rather than one API call per checkbox.
- **Single-writer discipline:** because the API layer is the only Sheets writer (Architecture Principle #4), you can put a simple in-process or Redis-based token bucket in front of the Sheets client and know it's the *only* thing consuming that quota — no client-side surprises.
- **Email queue:** outreach emails go into a Firestore-backed queue processed by a scheduled function via the `EmailProvider` interface (§7.3), which respects the sender's daily cap, splits any batch over 100 recipients into separate SMTP sends, retries transient failures with backoff, and spreads sends across the day rather than firing them all at upload time.

## 9. "Load Balancing" on Serverless (what actually applies here)

There is no traditional load balancer to configure — Vercel and Cloudflare Pages both run your Next.js app as edge/regional functions behind the platform's own global network, and that horizontal scaling is automatic and included in the free tier. What you *do* need to design for at this architecture:

- **Function execution limits:** Vercel Hobby/Pro functions cap at 10s/60s respectively by default; Cloudflare Workers cap CPU time per request (10ms free / 30s+ paid). **Anything long-running — report generation, batch email sending, bulk Internshala dedupe on a large upload — must run as a background job (scheduled function), not inline in the request that triggered it.** The request should enqueue the job and return immediately; the UI polls or gets notified when it's done.
- **Concurrency:** Firestore and Sheets both have per-second/per-minute ceilings, not per-request ones, so the real "load balancing" work is the caching/queueing in §8 — it's a demand-shaping problem, not a routing problem.
- **Cold starts:** free-tier serverless functions cold-start; for an internal tool used during business hours this is a non-issue in practice, but avoid designing any UX that assumes sub-100ms API latency on the very first request of the day.

## 10. Security Architecture

- **RBAC middleware** on every Route Handler: resolves the caller's role from the session, checks it against a central permission matrix (see `Implementation_Plan.md`), rejects with 403 before any business logic runs.
- **Firestore Security Rules** as defense-in-depth: even though the app is the primary write path, rules deny all direct client reads/writes to `emailCredentials`, `auditLog`, and `phoneIndex`, and scope `users` reads to "your own doc, or any doc if you're Admin/Super Admin."
- **Input validation:** every API route validates its payload against a Zod schema before touching Firestore or Sheets — this also blocks malformed Internshala CSV rows from corrupting the dedupe key.
- **Audit trail:** every role change, deletion, credential connect/disconnect, and lead-status edit writes an immutable `auditLog` entry (`who, what, when, before → after`).
- **Secrets:** service account keys and the AES encryption key live in the hosting platform's environment/secret store, never in the repo; rotate the encryption key on a documented schedule.
- **PII & compliance posture:** Gmail addresses, mobile numbers, and candidate data are personal data under India's Digital Personal Data Protection Act, 2023. Practical minimum: explicit consent copy at registration and at candidate-upload time, a documented data-retention/deletion policy, and encryption of anything beyond basic contact info. This is not legal advice — have GSS's counsel confirm before go-live if candidate data volume grows.

## 11. Deployment Pipeline

1. GitHub repo → GitHub Actions (lint, typecheck, unit tests) on every PR.
2. On merge to `main`: build → deploy to a **staging** Cloudflare Pages/Vercel environment pointing at a **separate Firebase project** (`gss-mgmt-staging`).
3. Manual promote (or a tagged release) deploys the same build artifact to **production** (`gss-mgmt-prod` Firebase project).
4. Environment variables (Firebase config, credential encryption key) are set per-environment in the hosting platform's dashboard, never committed.

## 12. Path to the React Native Android App (Phase 2)

- The API layer (Next.js Route Handlers) is already a REST-ish contract; the RN app calls the same endpoints.
- Zod schemas and TypeScript types live in a shared `packages/shared` workspace (Turborepo or plain npm workspaces) so both the web app and the RN app import the same validation/types — no drift.
- Firebase Auth has a first-class React Native SDK, so the same Firebase project serves both clients without change.
- The one thing to build RN-aware from day one: keep all UI logic out of Route Handlers (no HTML generation in the API layer) so the API is genuinely client-agnostic.

## 13. Cost Ceiling Reference (from current published limits — recheck before scaling past pilot)

| Service | Free ceiling | What breaks first at GSS's scale |
|---|---|---|
| Firebase Auth | 50,000 MAU free (email/password) | Won't be hit at 10–150 employees |
| Firestore | 50k reads/20k writes/20k deletes per day, 1GB storage | Fine at this scale with the caching strategy in §8 |
| Google Sheets API | 300 reads/min/project, 60 reads/min/user | The reason §8's cache layer is mandatory, not optional |
| Gmail SMTP send | 500/day (personal Gmail) or 2,000/day (Workspace) per sender, 100 recipients/message | Surfaced in the HR send UI; queue splits & overflows to next day (§7.4) |
| Brevo (scale-out option, if ever needed) | 300 emails/day / 9,000/month, free forever, no sandbox | Drop-in `EmailProvider` once Gmail's per-sender cap is the binding constraint |
| Amazon SES (scale-out option) | No permanent free tier (3,000/month for 12 months on new accounts), then $0.10/1,000 emails | The economical option once volume is well beyond what any free tier covers |
| Cloudflare Pages | Unlimited bandwidth, 500 builds/month, Workers free tier 100k req/day | Comfortable margin at this org size |
| Vercel Hobby (if used instead) | 100GB bandwidth, ~100k function invocations/month, **non-commercial ToS** | The ToS clause, not the numbers, is the real ceiling |
| GitHub Actions | 2,000 min/month (private repo) | Fine for a single-team CI pipeline |

## 14. Reliability & Scalability Roadmap ("built to scale at any time")

"Free tier" and "scalable at any time" are both real requirements, and the way to honor both is to make every ceiling a **config change or a provider swap, never a rewrite.** Concretely, at this architecture:

| Concern | Free-tier answer today | What changes when GSS outgrows it | What does *not* change |
|---|---|---|---|
| Mail sending | Gmail SMTP, per-user App Password | Swap in `BrevoProvider`/`SesProvider` behind `EmailProvider` (§7.3) | Queue, retries, audit log, RBAC, UI |
| Operational data | Google Sheets API | Migrate the Sheets-reading/writing modules (`lib/sheets/*`) to a real database (Postgres/Cloud SQL, or stay on Firestore) once row counts or quota pressure make Sheets the bottleneck | Route Handlers, RBAC, validation schemas — only the data-access layer underneath them changes |
| Identity | Firebase Auth + Firestore (Spark) | Upgrade to Blaze (pay-as-you-go); no migration, same APIs, just billing turned on | Everything — this is the smoothest scale step in the whole system |
| Hosting | Cloudflare Pages free / Vercel Pro | Cloudflare Workers Paid ($5/mo) or Vercel Pro's higher tiers | Deployment pipeline, code |
| Long-running work | Scheduled functions + queue | Same pattern, just more workers/concurrency | Nothing — this pattern is already the scalable one from day one |

**Reliability practices baked in regardless of scale:**
- Every external call (Sheets, SMTP) goes through retry-with-backoff and a circuit-breaker-style "stop hammering a failing dependency" guard, not a bare try/catch.
- Every destructive or externally-visible action (deletes, role changes, sends) is audit-logged before it's considered "done," so a partial failure is always traceable, not silent.
- Staging mirrors production (separate Firebase project, same code path) so a scale-affecting change is tested against realistic quotas before it reaches real users.
- The weekly quota-usage alert (Implementation_Plan.md §10) is the system's own early-warning system for "you are approaching a ceiling" — sustainability here means GSS finds out from a dashboard, not from a user complaint.

**What "scalable at any time" deliberately does *not* mean here:** provisioning infrastructure for hypothetical scale you don't have yet. Every free-tier ceiling in §13 has a documented, one-step upgrade path above — that's what makes it safe to stay on free tier by default rather than over-building for load a 10–150 person internal tool will not generate.
