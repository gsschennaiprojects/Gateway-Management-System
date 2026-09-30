# Local Development & Engineering Setup Guide

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `DOC-DEV-001`  
**Classification:** Developer Onboarding Guide  
**Status:** Production Ready  
**Last Updated:** 2026-09-30  

---

## 1. Prerequisites

Before setting up the project locally, ensure your development environment satisfies the following baseline requirements:

* **Node.js:** `v20.0.0` or higher (`node -v`)
* **npm:** `v10.0.0` or higher (`npm -v`)
* **Git:** `v2.40.0` or higher (`git --version`)
* **OS:** Windows 10/11, macOS, or modern Linux distribution

---

## 2. Step-by-Step Repository Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/gsschennaiprojects/Gateway-Management-System.git
cd Gateway-Management-System
```

### Step 2: Install Dependencies
The repository is configured as an npm workspace monorepo. Install dependencies from the repository root:
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the environment template to create your local `.env.local` file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your development credentials:
```ini
NODE_ENV=development
NEXT_PUBLIC_APP_NAME="Gateway Software Solutions Management System"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Firebase Client Configuration (Web Client SDK)
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyBdu8_..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="gss-management-system-eef75.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="gss-management-system-eef75"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="gss-management-system-eef75.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="528394878333"
NEXT_PUBLIC_FIREBASE_APP_ID="1:528394878333:web:..."

# Google Cloud Service Account (Server-Side privileged operations)
GOOGLE_SERVICE_ACCOUNT_EMAIL="gss-508@management-system-509313.iam.gserviceaccount.com"
GOOGLE_PROJECT_ID="management-system-509313"

# 4 Operational Branch Spreadsheets
SPREADSHEET_ID_CHN="1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY"
SPREADSHEET_ID_CBE="1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA"
SPREADSHEET_ID_MDU="1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8"
SPREADSHEET_ID_ERD="1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY"
```

> ⚠️ **Security Warning:** Never commit `.env.local` or real service account JSON keys to Git. Keep credentials strictly in local environment files.

---

## 3. Available Development Scripts

All core development commands can be executed from the **repository root**:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with Turbopack at `http://localhost:3000` |
| `npm run build` | Compiles the production application bundle and validates routing |
| `npm run start` | Serves the compiled production build locally |
| `npm run lint` | Runs ESLint across `src/` to verify code standards |
| `npm run typecheck` | Runs TypeScript compiler (`tsc --noEmit`) to verify type safety |
| `npm test` | Runs all 19 Jest unit and integration test suites |
| `npm run test:e2e` | Runs Playwright End-to-End browser tests |
| `npm run test:benchmark` | Runs synthetic concurrency and latency benchmark |

---

## 4. Local Development Workflow

1. **Branching:** Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature-name
   ```
2. **Developing:** Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
3. **Pre-Commit Verification:** Run the local quality checks:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
4. **Pull Request:** Push your feature branch and open a PR against `main`. Ensure all CI checks pass.
