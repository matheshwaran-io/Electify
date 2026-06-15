# Electify – Smart Elective Registration System

**Electify** is a reliable, high-performance, and secure full-stack elective registration portal designed specifically for a single MCA batch (approx. 58 students). It ensures a first-come, first-served seat selection process with concurrency safeguards to prevent overbooking.

## 🚀 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19 (Release Candidate), TypeScript, Tailwind CSS, shadcn/ui (Base UI preset)
- **Backend**: Next.js Server Actions, Next.js Middleware (Edge session guard)
- **Database**: PostgreSQL (Neon / Supabase), Prisma ORM (v7.8.0 with Driver Adapters)
- **Security**: Bcryptjs password hashing, database-backed brute-force lockout, Edge-compatible signed JWT cookies

---

## 🔑 User Roles & Permissions

| Feature | Student | Faculty | Super Admin |
| :--- | :---: | :---: | :---: |
| Authenticate & Sign In | ✅ | ✅ | ✅ |
| View Countdown / Scheduled Time | ✅ | ✅ | ✅ |
| Select & Register Electives | ✅ | ❌ | ❌ |
| Edit Selections (If enabled) | ✅ | ❌ | ❌ |
| View Occupancy Charts & Stats | ❌ | ✅ | ✅ |
| Change Seats / Configure Electives | ❌ | ✅ | ✅ |
| Open / Close Registration Portal | ❌ | ✅ | ✅ |
| Import Student Directory via CSV | ❌ | ✅ | ✅ |
| Reset Student Password to Reg No | ❌ | ✅ | ✅ |
| Export Registration Reports (CSV/Excel) | ❌ | ✅ | ✅ |
| Provision New Faculty Accounts | ❌ | ❌ | ✅ |
| Toggle Maintenance / Live Seat Visibility | ❌ | ❌ | ✅ |

---

## 🔒 Authentication & Credentials

### Student Portal
- **Login ID**: Official SRM Email Address (validated to end with `@srmist.edu.in`)
- **Initial Password**: Register Number (case-insensitive, capitalized on submission)
- **Seeding & Import**: Automatically generated during CSV import by hashing the `registerNumber` using bcrypt.
- **Experience**: Clean, one-time portal usage (no password change module to keep things lean).

### Faculty Portal
- **Login ID**: Faculty Email
- **Password**: Secure custom password
- **Master Admin Account**: Created via the database seed script:
  - **Email**: `admin@electify.edu`
  - **Password**: `Admin@12345`
  > [!IMPORTANT]
  > Log in and change this credential or create your own Super Admin account immediately.

---

## ⚡ Concurrency & Booking Transaction Safeguards

To prevent overbooking (where two students book the last seat of an elective at the exact same millisecond), registrations are handled inside a single strict **Prisma Database Transaction** (`tx`):
1. **Old Seat Release**: If the system settings `allowRegistrationEdit` is enabled and the student is editing a choice, the transaction increments the available seats of their *old* courses and resets `isFull = false`.
2. **Atomic Seat Decrement**: The transaction issues an atomic decrement on the newly selected courses.
3. **Capacity Check**: If the resulting seat count falls below `0`, the transaction throws an exception, instantly aborting and rolling back all changes.
4. **Visibility Toggle**: If available seats hit exactly `0`, `isFull` is updated to `true`.
5. **Upsert Entry**: The registration record is saved, and `Student.hasSubmitted` is marked `true`.

---

## 🛠️ Local Installation & Development

### Prerequisites
- Node.js (v18.x or v20.x+)
- Local PostgreSQL instance or Docker database container

### 1. Clone & Install Dependencies
```bash
# Install packages (peer conflicts with React 19 RC are bypassed via project .npmrc)
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root of the project:
```env
# Database connection
DATABASE_URL="postgresql://username:password@localhost:5432/electify"

# Session encryption key (Must be a secure 32+ character string)
JWT_SECRET="super-secret-key-at-least-32-chars-long-for-jwt-signing"
```

### 3. Sync Database Schema & Generate Client
```bash
# Push Prisma schema to database and compile Prisma Client
npx prisma db push
npx prisma generate
```

### 4. Seed Database
This populates the default settings, Super Admin, Faculty, electives (Group 1 & 2), and three test students.
```bash
npx tsx prisma/seed.ts
```

### 5. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the portal.

---

## 📋 CSV Import Format

When importing the student directory, upload a CSV file with the following headers:
```csv
registerNumber,name,email
RA2532241010001,Student One,student1@srmist.edu.in
RA2532241010002,Student Two,student2@srmist.edu.in
RA2532241010003,Student Three,student3@srmist.edu.in
```
- During upload, passwords will automatically be set to their Register Number and hashed.
- Duplicate Register Numbers or Emails will update names without resetting registrations.

---

## 🌐 Production Deployment Guide (Vercel + Supabase/Neon)

### Step 1: Spin up PostgreSQL Database
1. Create a database project in **Supabase** or **Neon**.
2. Copy the connection string. Make sure to use the **Transaction connection pooler** URL (usually port `6543` for Supabase or the pooled URL for Neon) for production server actions.

### Step 2: Set Environment Variables on Vercel
In the Vercel project Settings under **Environment Variables**, add:
1. `DATABASE_URL`: Your pooled PostgreSQL connection string.
2. `JWT_SECRET`: A secure, random 32+ character string (generate using `openssl rand -base64 32`).

### Step 3: Configure Build Command
Set the build command in Vercel to:
```bash
prisma generate && next build
```
This ensures the Prisma client is built inside the serverless compile context before webpack optimizes pages.

### Step 4: Run Initial Production Seeding
To seed your live production database with settings, electives, and the default Super Admin:
```bash
# Load production DATABASE_URL locally in your shell and run:
DATABASE_URL="your-production-database-url" npx tsx prisma/seed.ts
```

---

## 🧪 Verification & QA Checklist

Before launching, perform these checks:
1. **Maintenance Block**: Toggle `maintenanceMode` in settings. Verify students are immediately redirected to `/maintenance` on load/refresh.
2. **Countdown lock**: Set the registration start time to a future date. Log in as a student and confirm they are redirected to `/countdown` displaying a ticking timer.
3. **Live Seats Toggle**: Toggle `showLiveSeats`. Verify student cards display "Available" instead of numbers.
4. **Single Submission Policy**: Submit selections. Verify the dashboard redirects to `/dashboard/success` on reload and locks selection options unless `allowRegistrationEdit` is toggled.
