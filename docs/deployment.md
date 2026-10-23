# Electify Production Deployment & Operations Guide

> **Partly superseded (23 Oct 2026).** This file is kept for history. It is out of date on database migration steps (`npm run db:migrate` is not a supported path). Use [documentation/PROJECT_MAINTENANCE_MANUAL.md](../documentation/PROJECT_MAINTENANCE_MANUAL.md) and the guides next to it.

## 1. Hosting Architecture Recommendations

Electify is a hybrid Next.js 16 full-stack application. It can be deployed via:
- **Vercel** (recommended for serverless compute, global edge routing, and automated preview branches).
- **Self-Hosted Docker / Node.js** (e.g. AWS ECS, GCP Cloud Run, DigitalOcean, or on-prem university servers).

---

## 2. Environment Variables Checklist

Ensure the following variables are defined in your production environment:

| Variable | Description | Example / Note |
| -------- | ----------- | -------------- |
| `DATABASE_URL` | Transaction connection pooler URL (e.g., Supabase port `6543`, Neon pooled string) | `postgresql://user:pass@pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Direct connection URL for Drizzle migrations (port `5432`) | `postgresql://user:pass@pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | Secure key for signed authentication cookies | Must be `>= 32` characters. Generate: `openssl rand -base64 32` |
| `SETUP_SECRET` | Secret required to authorize admin provisioning via `/api/health?setup=true` | Secret string for controlled bootstrap |
| `INITIAL_ADMIN_PASSWORD` | Optional password override for initial admin user creation | Strong passphrase |
| `NEXT_PUBLIC_APP_URL` | Canonical URL of the production application | `https://electify.srmist.edu.in` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for realtime seat subscriptions | `https://[project-ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous public API key | `sb_publishable_...` |

---

## 3. Database Pooling & Connection Sizing

Electify is built for burst traffic during elective selection windows (thousands of simultaneous requests).
- **PgBouncer / Connection Pooler**: You must connect the application to PostgreSQL using a pooled connection string (port 6543 on Supabase or Neon's pooled endpoint).
- **Connection Limits**: Configure maximum client connections in your pooler to accommodate expected concurrent student sessions (recommended: at least 50-100 pool size).
- **SSL Configuration**: Production database connections automatically enforce SSL encryption.

---

## 4. Deployment Steps

### Step 1: Database Migration
Before directing user traffic to a newly deployed version, apply pending database migrations:
```bash
# In CI/CD or your deployment pipeline:
DIRECT_URL="$DIRECT_URL" DATABASE_URL="$DATABASE_URL" npm run db:migrate
```

### Step 2: Build Application
```bash
npm run build
```
Verify that the output shows `Route (app)` successfully compiled without dynamic server rendering errors.

### Step 3: Health & Readiness Verification
Once deployed, perform an automated health check:
```bash
curl -I https://electify.srmist.edu.in/api/health
```
Expected response: HTTP `200 OK` with JSON payload confirming `database.connected: true` and all tables present.

---

## 5. Rollback & Disaster Recovery Procedures

1. **Application Rollback**:
   - In Vercel: Click **Rollback** on the deployment dashboard to revert immediately to the previous deployment artifact.
   - In Docker/Kubernetes: Re-deploy the previous container image tag.
2. **Database Rollback**:
   - Migrations in `drizzle/` are tracked sequentially.
   - For specific migrations (e.g., waitlist removal), dedicated rollback SQL files exist in `drizzle/rollback/`.
   - Never run `db:push` directly against a live production database.
