# Contributing to the GSS Management System

**Gateway Software Solutions (GSS) Engineering Guide**  
**Document ID:** `ENG-CON-001`  
**Classification:** Internal Developer Standards  
**Status:** Active  

---

## 1. Code of Conduct & Engineering Principles

We adhere to rigorous software engineering standards to maintain an enterprise-grade, clean, maintainable, and reliable codebase. Every contributor is expected to respect:

1. **Architecture Preservation:** Never rebuild or bypass established architectural boundaries (Next.js 16 + React 19 + Firebase + Cloud Firestore + Google Sheets projection).
2. **Quality Gates:** Code cannot merge without passing all automated tests, TypeScript type checks, and linting rules.
3. **Zero Secrets in Git:** Never commit secrets, service account credentials, or local environment files.

---

## 2. Branching & Release Strategy

We employ a structured Git branching model:

```
main (Production Deployable)
  ▲
  ├── release/v1.1.0 (Release Staging)
  │     ▲
  │     ├── feature/attendance-speedometer
  │     └── feature/candidate-dedup
  │
  └── hotfix/security-patch
```

* **`main`:** Production-ready code only. Directly deployable to staging and production.
* **`feature/<feature-name>`:** New feature development. Branched from `main` and merged via Pull Request.
* **`bugfix/<issue-description>`:** Defect remediations.
* **`hotfix/<cve-or-incident>`:** Urgent production security patches.

---

## 3. Commit Message Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Allowed Types:
* `feat`: A new user-facing capability or API feature.
* `fix`: A bug fix or defect remediation.
* `docs`: Documentation updates or additions.
* `refactor`: Code changes that neither fix a bug nor add a feature.
* `test`: Adding or correcting tests without production code changes.
* `perf`: Performance optimizations.
* `chore`: Build tooling, dependency bumps, or script maintenance.

---

## 4. Pre-Commit Quality Checklist

Before submitting a Pull Request, ensure that every command in this quality suite passes locally:

```bash
# 1. Run ESLint across the source code
npm run lint

# 2. Run TypeScript compiler type checking
npm run typecheck

# 3. Run Jest unit and integration tests
npm test

# 4. Run production build verification
npm run build
```

---

## 5. Pull Request Submission Checklist

When opening a PR, include the following checklist in the description:

* [ ] `npm run lint` passes with 0 errors and 0 warnings.
* [ ] `npm run typecheck` passes with 0 compilation errors.
* [ ] `npm test` passes with 100% of test suites green.
* [ ] `npm run build` generates the production bundle without errors.
* [ ] No secrets, `.env.local` files, or service account keys are committed.
* [ ] New features include corresponding unit or integration tests.
* [ ] Relevant documentation under `docs/` is updated.
