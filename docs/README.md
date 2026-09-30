# GSS Enterprise Management System — Technical Documentation Portal

**Gateway Software Solutions (GSS)**  
**Classification:** Enterprise Engineering & Operations Manual  
**Status:** Production Ready  
**Version:** 1.0.0  
**Last Updated:** 2026-09-30  

---

## Welcome to the GSS Documentation Hub

This documentation portal provides comprehensive architectural specifications, developer manuals, operational runbooks, and security governance standards for the **Gateway Software Solutions Management System**.

---

## Documentation Navigation Matrix

```
docs/
├── architecture/
│   ├── system-architecture.md         — System architecture & data flow
│   ├── design-system.md               — UI design tokens, glassmorphism & visual styling
│   └── implementation-roadmap.md      — Architectural evolution & milestones
│
├── database/
│   ├── firestore-schema.md            — Canonical Firestore collections, rules & indexes
│   └── branch-spreadsheet-schema.md   — Google Sheets 4-branch tabular specifications
│
├── security/
│   └── security-and-rbac.md           — Defense-in-depth security, RBAC matrix & token management
│
├── development/
│   └── local-setup.md                 — Local development environment onboarding
│
├── testing/
│   └── testing-strategy.md            — Automated testing architecture, Jest & Playwright suites
│
├── deployment/
│   └── production-deployment.md       — Vercel, Docker multi-stage & PM2 clustering release guide
│
├── operations/
│   ├── google-sheets-projection.md    — 1-way operational projection & quota resilience
│   ├── branch-governance-manual.md    — 4-branch enterprise governance master operations manual
│   └── production-readiness-audit.md  — System audit & remediation verification report
│
├── integrations/
│   ├── google-apps-script.md          — Google Apps Script architecture & bindings
│   └── firebase-admin.md              — Privileged server-side Admin SDK operations
│
├── user-guides/
│   └── role-workflows.md              — Operational workflows for Super Admin, Admin, HR & Staff
│
└── business/
    ├── management-platform-overview.md— Executive B2B overview & business model
    └── prd.md                         — Product Requirements Document (PRD)
```

---

## Quick Reference Links by Audience

### For Engineering & Developers
* [Local Setup & Development](file:///c:/Users/jasva/Desktop/project/GMS/docs/development/local-setup.md)
* [System Architecture](file:///c:/Users/jasva/Desktop/project/GMS/docs/architecture/system-architecture.md)
* [Firestore Database Schema](file:///c:/Users/jasva/Desktop/project/GMS/docs/database/firestore-schema.md)
* [Automated Testing Strategy](file:///c:/Users/jasva/Desktop/project/GMS/docs/testing/testing-strategy.md)

### For DevOps & Release Engineers
* [Production Deployment Guide](file:///c:/Users/jasva/Desktop/project/GMS/docs/deployment/production-deployment.md)
* [Google Sheets Operational Projection](file:///c:/Users/jasva/Desktop/project/GMS/docs/operations/google-sheets-projection.md)
* [Apps Script Provisioning Runbook](file:///c:/Users/jasva/Desktop/project/GMS/docs/runbooks/apps-script-provisioning.md)

### For Security & Compliance Auditors
* [Security & RBAC Architecture](file:///c:/Users/jasva/Desktop/project/GMS/docs/security/security-and-rbac.md)
* [Production Readiness Audit](file:///c:/Users/jasva/Desktop/project/GMS/docs/operations/production-readiness-audit.md)
* [Root Security Policy](file:///c:/Users/jasva/Desktop/project/GMS/SECURITY.md)

### For Administrators & End Users
* [Role Workflows & User Operations](file:///c:/Users/jasva/Desktop/project/GMS/docs/user-guides/role-workflows.md)
* [Branch Governance Operations Manual](file:///c:/Users/jasva/Desktop/project/GMS/docs/operations/branch-governance-manual.md)
* [Management Platform Business Overview](file:///c:/Users/jasva/Desktop/project/GMS/docs/business/management-platform-overview.md)
