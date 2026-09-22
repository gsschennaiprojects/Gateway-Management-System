# Design.md — GSS Management System

## 1. Design Brief, Grounded

**Subject:** an internal operations tool for a company that builds software *and* trains people — half engineering-room, half classroom. The audience is GSS's own staff (Employees, HR, Admins), using it daily, often between meetings or tutoring sessions, sometimes on a phone in a hallway. The tool's job is to make attendance, student tracking, and lead management feel fast and trustworthy — not decorative. "Liquid morphism / glassmorphism" is the requested visual language: translucent, layered glass surfaces over a deep, calm base, evoking precision instrument panels more than a marketing site.

**Design plan (before building anything):**

- **Color:** a deep ink-navy base (not pure black — a company that teaches people shouldn't feel cold), layered translucent glass panels, and a single warm amber accent reserved for primary actions and the one data visualization that deserves attention (the attendance gauge). No terracotta, no acid-green, no default SaaS-card grey shadows.
- **Type:** one distinctive serif for section headers and page titles (personality, a sense of an institution — this is a training company after all), one clean grotesk sans for every UI label, table, form, and body string (legibility at data-dense density), and a monospace face reserved *only* for genuinely tabular data — timestamps, IDs, dates — because this product is data-dense enough that a monospace column of times actually improves scannability, not decoration for its own sake.
- **Layout:** left-rail navigation + content canvas, left-aligned content (not centered marketing-style), dense information tables with generous internal padding to survive glass-blur legibility, one hero glass panel per page maximum — everything else sits flatter and quieter.
- **Principles:** the accent color is spent in exactly one place per screen; motion is a single orchestrated moment (a panel arriving, a confirmation succeeding) never a scroll-triggered fade parade; every empty state tells the person what to do next, in the product's voice.

## 2. Design Tokens

### 2.1 Color

| Token | Hex | Use |
|---|---|---|
| `--ink-950` | `#0A0F1C` | App background base (deepest layer) |
| `--ink-900` | `#101828` | Base gradient stop / sidebar background |
| `--ink-800` | `#182238` | Elevated flat surfaces (non-glass) |
| `--glass-surface` | `rgba(255,255,255,0.06)` | Glass panel fill (paired with blur) |
| `--glass-border` | `rgba(255,255,255,0.14)` | 1px hairline border on every glass panel |
| `--ink-text-primary` | `#F3F5F9` | Primary text on dark |
| `--ink-text-secondary` | `#98A2B8` | Secondary/meta text |
| `--accent-amber` | `#E8A33D` | Primary actions, active nav state, the gauge needle/fill |
| `--accent-amber-dim` | `rgba(232,163,61,0.16)` | Accent-tinted hover/selected backgrounds |
| `--status-success` | `#35C97B` | Present, Paid, Enrolled |
| `--status-warning` | `#F0B84C` | Partial, Pending, Contacted |
| `--status-danger` | `#E5555F` | Absent, Rejected, destructive actions |
| `--status-neutral` | `#5B6B8C` | Holiday, Sunday-excluded cells |

### 2.2 Typography

| Role | Family | Notes |
|---|---|---|
| Display / page titles | **Fraunces** (variable, optical size high) | Used at 28–40px, weight 480–560; gives the institution feel without shouting |
| UI / body / tables | **Inter** | 13–16px for body, 12–13px for table/dense UI, weight 400–600 |
| Tabular data (timestamps, IDs, dates, counts) | **JetBrains Mono** | Only in table cells that are literally numbers/times — never for labels or headings |

Type scale: `12 / 13 / 14 / 16 / 20 / 24 / 32 / 40` (px), line-height 1.4 for body, 1.15 for display. Line length capped around 70ch for any prose (help text, empty-state copy).

### 2.3 Layout & Spacing

- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` px.
- Grid: fixed left rail (`themes: 240px expanded / 72px collapsed`) + fluid content area, max content width 1280px, left-aligned.
- Radius: `12px` for glass panels and cards, `8px` for inputs/buttons, `999px` only for pills/status chips — never applied uniformly to "everything," per hierarchy.

### 2.4 The Glass Recipe (concrete, not vibes)

```css
.glass-panel {
  background: var(--glass-surface);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.08) inset,   /* top hairline highlight */
    0 20px 40px rgba(0,0,0,0.35);            /* soft ambient depth */
}
```
Glass panels always sit over the `--ink-950`/`--ink-900` gradient base with a few soft, low-opacity color blooms (amber + a muted blue) positioned behind content, never over it — this is what gives "liquid" depth without hurting text contrast. **Rule: body text never sits directly on unblurred glass at less than 4.5:1 contrast** — verify with the ink/glass combination in code, not by eye.

### 2.5 Motion

- One entrance animation per page load: the primary glass panel fades + rises 8px over 220ms, ease-out. Nothing else animates on load.
- Micro-interactions only respond to user action: a saved checkbox flips with a 120ms scale-tick, a submitted form's button shows a spinner-to-check morph, a destructive-action modal shakes once if confirmation text doesn't match.
- Respect `prefers-reduced-motion`: fall back to instant state changes.

## 3. Screens

### 3.1 Login
- Centered single glass panel (the one exception to "left-aligned" — a login screen is the one place a centered moment is correct because there's no other content to relate to).
- Fields: Gmail-or-Mobile (single input, placeholder explains both work), Password, "Forgot password?" link.
- No role selector, no OTP field anywhere — reinforce via absence that this product doesn't use OTP.

### 3.2 Registration
- Name, Gmail, Mobile Number, Requested Role (dropdown — copy clarifies "An admin will confirm your role"), Start Month & Year (month/year picker), Password + confirm.
- On submit: a plain confirmation state — "Your account is pending approval. An Admin will activate it shortly." No dashboard peek before approval.

### 3.3 Employee Dashboard (home for Employee role)
- **Hero glass panel:** the attendance **speedometer/gauge** for the current month (own attendance), amber fill, numeric % centered, small "Present / Absent / Holiday" legend beneath. This is the one screen-level moment the accent color and the glass treatment are both spent on together.
- Below: a **Daily Login/Logout card** — a login button (captures time), a stacked list of planned-task text inputs with a `+ Add task` affordance below the list, and once logged in, a mirrored logout control with completed-task inputs.
- Below that: **My Students** table (Name, College, Domain, Fee Status chip, Duration, Project boolean as a small icon) with a row-level attendance tick control (`Present/Absent/Holiday`, Sunday columns simply don't render in the calendar strip) and a separate "yesterday's task done" tick.

### 3.4 Student / Intern Attendance Grid
- A calendar-style grid: rows = students, columns = days of the current month **with Sundays omitted from the grid entirely** (not shown greyed-out — genuinely absent, so the grid reads as a real working-day calendar).
- Cell = tap-to-cycle `Present → Absent → Holiday`, colored via the status tokens; a distinct row beneath each student for the previous-day task-completion tick.

### 3.5 Admin — Employee Directory
- A searchable/filterable table of all employees: Name, Role, Start Date, Tenure, live Attendance % (small inline gauge, not the full hero version).
- Row click → **Employee Profile** (Admin view): identity block, the full-size attendance gauge, the employee's own daily-log history, and their Students table/grid — i.e., everything the employee sees about themselves, visible read-through to Admin/Super Admin.

### 3.6 Admin — Employee Attendance Master Grid
- Same grid pattern as 3.4 but employees-as-rows instead of students, editable by Admin/Super Admin only (HR sees it read-only per the RBAC resolution in the PRD), with the live date/day/year header pinned at the top so "today's column" is always obvious without scrolling.

### 3.7 HR — Leads Dashboard
- Upload zone (drag-and-drop CSV/XLSX) with a clear "we'll check for duplicates by Gmail + Mobile" caption before upload.
- Post-upload summary panel: "X new, Y duplicates skipped" before committing, so HR isn't surprised by silent dedupe.
- Candidate table: Name, Gmail, Mobile, City, Status (editable chip/dropdown), Remark (inline-editable text). Filter by Status.
- "Connect Email" card (if not yet connected): Gmail address + App Password fields, a plain-language explainer ("An App Password lets GSS send email as you over SMTP — it's not your normal password; the card links to Google's own 2-Step Verification / App Password setup"), and a "Send test email" action that must succeed before the card shows as connected. Once connected, a compose/schedule panel showing remaining daily send quota and, if applicable, a "reconnect required" banner (amber, non-blocking to the rest of the page) if the credential has been revoked externally.

### 3.8 Super Admin — User & Role Management
- Table of all users including `pending` ones (pending rows visually distinct — amber-outlined, "Approve" / "Reject" actions inline).
- Role change and Delete both open the same **double-confirmation modal** pattern: step 1 states the exact change in plain language with the affected person's name and photo/initial; step 2 requires typing a short confirmation phrase before the action button enables. Destructive (delete) actions use the danger color on the modal's confirm button; role changes use neutral/amber.

### 3.9 Monthly Report
- A simple preview screen per employee: the same data sections as the PDF (students maintained, tasks completed, login/logout log, sessions attended, domains handled), with "Download PDF" / "Download Excel" actions — no separate builder UI needed since the report content is fixed per PRD §5.6.

## 4. Responsive Behavior

- Left rail collapses to a bottom tab bar under 768px; the gauge and daily-log card stack vertically as the primary two blocks on mobile (this is the screen tutors will actually use standing up).
- Grids (3.4/3.6) become horizontally scrollable with the row label column sticky, rather than reflowing into unreadable stacked cards — attendance grids lose their value if you can't see a week at a glance.

## 5. Accessibility Checklist

- All interactive elements reachable by keyboard in a logical order; visible focus ring using `--accent-amber` at 2px offset (glass surfaces must not swallow focus rings).
- Color is never the only signal: status chips carry a short text label alongside color (`Present`, `Pending`, etc.), not color alone.
- Contrast-check every text/glass combination against WCAG AA at build time, not by eye — glass blur plus low background contrast is the easiest place for this product to quietly fail accessibility.
- `prefers-reduced-motion` disables all non-essential motion described in §2.5.
