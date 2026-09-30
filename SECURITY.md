# Security Policy

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `SEC-POL-001`  
**Classification:** Public Security Policy  
**Effective Date:** 2026-09-30  

---

## 1. Supported Versions

Security updates and critical patches are actively provided for the following releases:

| Version | Supported | Security Maintenance Status |
| :--- | :---: | :--- |
| `1.0.x` | ✅ Yes | Actively maintained with security fixes |
| `< 1.0.0` | ❌ No | Deprecated development prototypes |

---

## 2. Reporting a Vulnerability

Gateway Software Solutions takes the security of its infrastructure, workforce data, and student privacy seriously. If you discover a security vulnerability, we request that you follow responsible disclosure guidelines:

1. **Do NOT open a public GitHub issue.**
2. Send an email report directly to:
   * **Security Team:** `security@gatewaysolutions.com`
   * **Engineering Lead:** `tech-lead@gatewaysolutions.com`
3. Include the following details in your report:
   * A clear summary of the issue (e.g., authentication bypass, privilege escalation, data leakage).
   * Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
   * The potential impact on corporate data or branch operations.
   * Any recommended remediation steps.

### Our Commitment
* We will acknowledge receipt of your vulnerability report within **24 hours**.
* We will provide a formal vulnerability assessment and resolution timeline within **72 hours**.
* We request that you maintain confidentiality until an official fix is deployed to production.

---

## 3. Core Security Controls

The GSS Management System enforces the following automated security safeguards:

1. **Zero-Cache Client Memory:**
   * Browser `localStorage` is prohibited from caching sensitive business records.
   * Firestore client SDK uses `memoryLocalCache()`, guaranteeing that session data is wiped when tabs close.
2. **Hardware-Isolated Branch Scoping:**
   * Regional roles (`admin`, `hr`, `employee`, `intern`) cannot access documents from external branches (`CHN`, `CBE`, `MDU`, `ERD`).
3. **Cryptographic Session Tokens:**
   * Sessions are signed using HMAC-SHA256 and stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
4. **Secret Isolation:**
   * Service account private keys are stored exclusively in server environments and strictly ignored by Git.
5. **Rate Limiting & CSRF Protection:**
   * Sliding window IP rate limiting mitigates brute-force attacks on `/api/auth/login`.
   * Origin and Referer header verification mitigates Cross-Site Request Forgery (CSRF).

---

## 4. Secret Management Standards

* **No Secrets in Source Control:** Private keys (`*.pem`, `*.key`, `management-system-*.json`, `firebase-admin-key.json`) and `.env*.local` files are strictly excluded via `.gitignore`.
* **CI/CD Hygiene:** Automated CI pipelines reject commits that contain suspected API keys or credential patterns.
