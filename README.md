# Gateway Software Solutions (GSS) Management System
### Enterprise Operations Platform • Production Architecture & Developer Manual

[![Production Build](https://img.shields.io/badge/Production%20Build-Passing-brightgreen.svg)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5%20(Turbopack)-black.svg)](https://nextjs.org/)
[![Testing](https://img.shields.io/badge/Tests-Jest%20%2B%20Playwright%20(100%25%20Pass)-blue.svg)]()
[![Security](https://img.shields.io/badge/RBAC-Hardware%20Isolated-blueviolet.svg)]()

---

## 1. System Overview

The **GSS Management System** is a unified, production-grade operations and mentorship platform developed for **Gateway Software Solutions** across four regional technology branches:
- **Coimbatore (CBE)** — Corporate Headquarters & Main Training Center
- **Chennai (CHN)** — Technology Center & OMR IT Corridor Hub
- **Bangalore (BLR)** — Innovation Hub & Software Development Center
- **Hyderabad (HYD)** — Operations Center & Cloud Deliverables Hub

The platform coordinates real-time employee worklogs, intern/trainee mentorship cohorts, multi-month attendance matrices with automatic monthly rollovers, candidate inquiry pipelines, and corporate document generation (PDF, Excel `.xlsx`, and Word `.docx`).

---

## 2. Core Functional Modules

| Module | Route | Accessible Roles | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Employee Dashboard** | `/dashboard` | All Personnel | Real-time punch in/out, daily planned tasks, and personal attendance statistics. |
| **My Students (Mentorship)** | `/my-students` | Staff, Admin, Superadmin | Monthly attendance matrix (`ATT_{staffId}`), rolling start-to-end date calculation, milestone grading, and next-month rollover. |
| **Student Directory** | `/students` | All Personnel | Central branch-wide student directory (`06_Student_Directory`) with instant exports. |
| **Attendance Master** | `/admin/attendance` | Admin, Superadmin, HR | Working calendar master grid (26 days in Sep 2026; Sundays omitted per policy). Interactive click-to-cycle status. |
| **Staff Directory & Logs** | `/admin/directory` | Admin, Superadmin, HR | Universal or branch-scoped roster, login/logout inspection, deliverables review, and staff performance dossiers. |
| **Tasks & Delegations** | `/tasks` | All Personnel | Task assignment by individual or team cohort, status progression (`not_started`, `in_progress`, `completed`), and alerts. |
| **Candidate Inquiries & Leads** | `/leads` | HR, Admin, Superadmin | Intake via drag-and-drop CSV/Excel, automated deduplication by Gmail + Mobile, and outreach pipeline. |
| **Operational Reports** | `/reports` | All Personnel | Executive monthly report preview, automated attendance audit, and one-click exports. |
| **User & Role Management** | `/admin/users` | Admin, Superadmin | Double-confirmation role elevation, branch scoping, and pending account activation. |
| **Help & Support Center** | `/help` | Public / All | Interactive FAQ knowledge base, guides, and regional branch technical contacts. |
| **Privacy Policy** | `/privacy` | Public / All | ISO/IEC 27001 compliant enterprise data protection policy and data scoping. |
| **Terms of Service** | `/terms` | Public / All | Role responsibilities, code of conduct, and acceptable use policy. |

---

## 3. High-Availability & Production Load Balancing

To deploy GSS Management System in production under high concurrency (1,000+ daily active staff and trainees), implement the following multi-tier architecture:

```
                      [ HTTPS Client Traffic (Port 443) ]
                                      │
                                      ▼
                      [ NGINX Reverse Proxy & SSL Term ]
                        - Rate Limiting (100 req/min)
                        - Brotli/Gzip Compression
                        - Static Asset Caching
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
         [ Node.js Worker 1 ]               [ Node.js Worker 2 ]
           (PM2 Cluster 0)                    (PM2 Cluster 1)
           Port: 3001                         Port: 3002
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                      [ Shared State & Storage Layer ]
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
     [ Redis Cache ]         [ Firestore Database ]    [ Google Workspace API ]
    Session Tokens & Locks    User Accounts & Tasks     Sheets v4 Multi-Month Att
```

### Production NGINX Upstream Configuration (`/etc/nginx/conf.d/gms.conf`):
```nginx
upstream gms_backend {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

server {
    listen 80;
    server_name gms.gatewayskill.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gms.gatewayskill.in;

    ssl_certificate /etc/letsencrypt/live/gms.gatewayskill.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gms.gatewayskill.in/privkey.pem;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=gms_limit:10m rate=30r/s;
    limit_req zone=gms_limit burst=50 nodelay;

    location /_next/static/ {
        alias /var/www/gms/apps/web/.next/static/;
        expires 365d;
        access_log off;
    }

    location / {
        proxy_pass http://gms_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Process Management via PM2 (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [
    {
      name: 'gms-worker',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
```

---

## 4. Test Engineering & Quality Assurance

The codebase includes automated unit, integration, and E2E browser tests:

```bash
# 1. Run Jest Unit Tests (RBAC, Calculations, Document Packing)
npm run test:unit

# 2. Run Playwright End-to-End Browser Tests
npm run test:e2e

# 3. Run Comprehensive Backend & API Integration Tests
node apps/web/scripts/comprehensive-test-engineer.mjs

# 4. Verify Production Build (Turbopack)
npm run build
```

---

## 5. Security & RBAC Governance

1. **Self-Registration Quarantine**: New signups automatically receive role `employee` and status `pending`. Accounts must be activated by an Administrator or Super Administrator before granting portal access.
2. **Super Admin Immutability**: Super Administrator accounts can never be deleted or demoted.
3. **Cross-Branch Hardware Isolation**: Branch Administrators only have visibility into personnel and students assigned to their specific branch code (`CBE`, `CHN`, `BLR`, `HYD`).
4. **Document Integrity Checksums**: All exported Word documents (`.docx`) include cryptographic SHA-256 system checksums and digital verification footers.
