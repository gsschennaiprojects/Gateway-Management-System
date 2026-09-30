# Enterprise Production Deployment & Hosting Guide

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `DOC-DEP-001`  
**Classification:** DevOps & Release Engineering Standard  
**Status:** Production Ready  
**Last Updated:** 2026-09-30  

---

## 1. Supported Deployment Topologies

The GSS Management System supports two enterprise deployment topologies:

```
[ TOPOLOGY A: Vercel Edge Serverless ]           [ TOPOLOGY B: High-Availability Docker / NGINX ]
             Users                                                Users
               │                                                    │
               ▼                                                    ▼
    Vercel Anycast Edge (bom1)                             NGINX Reverse Proxy (Port 443)
               │                                                    │
               ▼                                      ┌─────────────┴─────────────┐
    Next.js Route Handlers                            ▼                           ▼
        (Auto-scaled)                         Node.js Worker 1            Node.js Worker 2
               │                               (PM2 Cluster)               (PM2 Cluster)
               ▼                                      │                           │
  Firestore + Google Workspace                        └─────────────┬─────────────┘
                                                                    ▼
                                                       Firestore + Google Workspace
```

---

## 2. Topology A: Vercel Cloud Serverless (Primary)

The application is natively optimized for Vercel deployment with monorepo workspace support.

### 2.1 Configuration File (`vercel.json`)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build --prefix apps/web",
  "outputDirectory": "apps/web/.next",
  "cleanUrls": true,
  "regions": ["bom1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

### 2.2 Vercel CLI Deployment Command
```bash
# Production deployment to Vercel
vercel --prod
```

---

## 3. Topology B: Multi-Stage Docker Container & NGINX Cluster

For on-premises private cloud deployment, dedicated virtual machines, or Kubernetes clusters.

### 3.1 Docker Multi-Stage Build
The root [Dockerfile](file:///c:/Users/jasva/Desktop/project/GMS/Dockerfile) implements an Alpine Linux multi-stage build:
* **Stage 1 (deps):** Installs and caches dependencies (`npm ci`).
* **Stage 2 (builder):** Compiles Next.js with Turbopack optimizations (`npm run build`).
* **Stage 3 (runner):** Executes minimal non-root production runtime with unprivileged user `nextjs` (UID 1001).

```bash
# Build the production container image
docker build -t gms-portal:latest .

# Run standalone container with healthcheck
docker run -d \
  --name gms-app \
  -p 3000:3000 \
  --env-file .env.local \
  gms-portal:latest
```

### 3.2 Orchestration via Docker Compose
The clustered configuration in [docker-compose.yml](file:///c:/Users/jasva/Desktop/project/GMS/docker-compose.yml) deploys:
* **4 Replicated App Instances:** Auto-scaled across CPU cores.
* **NGINX Reverse Proxy:** Load balances incoming traffic with least-connections algorithm, performs gzip/brotli compression, and caches static assets.

```bash
# Launch high-availability cluster
docker compose up -d

# Verify cluster status
docker compose ps
```

---

## 4. Environment Variables Reference

Configure these environment variables in your deployment environment (Vercel Project Settings or Docker `.env`):

| Variable Name | Environment Scope | Required | Description |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | Server | Yes | Set to `production` |
| `NEXT_PUBLIC_APP_NAME` | Client / Server | Yes | Portal branding title |
| `NEXT_PUBLIC_APP_URL` | Client / Server | Yes | Base URL (e.g. `https://gms.gatewayskill.in`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client / Browser | Yes | Firebase Web Client API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client / Browser | Yes | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client / Browser | Yes | Firebase Project ID (`gss-management-system-eef75`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Client / Browser| Yes | Firebase Storage bucket URL |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`| Client / Browser| Yes | Cloud Messaging Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client / Browser | Yes | Firebase Web App App ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Server Only | Yes | Cloud IAM service account email |
| `GOOGLE_PROJECT_ID` | Server Only | Yes | Google Cloud Project ID |
| `GOOGLE_PRIVATE_KEY` | Server Only | Yes | PEM formatted RSA private key |
| `SPREADSHEET_ID_CHN` | Server Only | Yes | Chennai Branch Spreadsheet ID |
| `SPREADSHEET_ID_CBE` | Server Only | Yes | Coimbatore Branch Spreadsheet ID |
| `SPREADSHEET_ID_MDU` | Server Only | Yes | Madurai Branch Spreadsheet ID |
| `SPREADSHEET_ID_ERD` | Server Only | Yes | Erode Branch Spreadsheet ID |
| `SESSION_SECRET` | Server Only | Yes | Cryptographic HMAC-SHA256 signing secret |

---

## 5. Health Checks & Synthetic Monitoring

The portal exposes an unauthenticated health probe endpoint for container orchestrators, load balancers, and synthetic uptime checkers:

* **Endpoint:** `GET /api/health`
* **Response Payload:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-30T04:15:00.000Z",
    "uptime": 86400,
    "version": "1.0.0",
    "services": {
      "firestore": "connected",
      "sheetsApi": "reachable"
    }
  }
  ```

---

## 6. Post-Deployment Smoke Verification Checklist

After deploying a new release, execute the following smoke verification sequence:

1. **Synthetic Health Check:** Verify `curl -I https://gms.gatewayskill.in/api/health` returns `200 OK`.
2. **Security Headers Verification:** Verify responses include `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`.
3. **Authentication Verification:**
   * Login with Super Admin credentials.
   * Verify redirect to `/dashboard`.
   * Verify session cookie `gms_session` is present, `HttpOnly`, and `Secure`.
4. **Worklog Punch Verification:** Test punch-in on `/worklog`; confirm Firestore reflects the new session timestamp.
5. **Operational Audit Trail:** Verify that the login event generated an entry in the audit ledger (`/admin/audit`).
