# Electify – Smart Elective Registration System

**Electify** is a reliable, high-performance, and secure full-stack elective registration portal designed specifically for batch-based course selection (e.g., an MCA batch). It guarantees a fair, first-come, first-served seat selection process with robust concurrency safeguards to prevent overbooking, even under heavy load.

---

## 🚀 Tech Stack & Architecture

- **Frontend Framework**: Next.js 15 (App Router)
- **UI Library**: React 19 (Release Candidate)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Backend Logic**: Next.js Server Actions
- **Authentication Guard**: Next.js Middleware (Edge compatible)
- **Database**: PostgreSQL (via Neon or Supabase)
- **ORM**: Prisma (v7.8.0 with Driver Adapters)
- **Security**: Bcryptjs password hashing, database-backed brute-force lockout, Edge-compatible signed JWT cookies

---

## 📂 Project Structure

```text
electify/
├── prisma/
│   ├── schema.prisma       # Database models and relations
│   └── seed.ts             # Default data seeding script
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── actions/        # Server Actions (auth, electives, register, settings, students)
│   │   ├── countdown/      # Pre-registration waiting page
│   │   ├── dashboard/      # Student registration portal
│   │   ├── faculty/        # Faculty/Admin control panel
│   │   ├── login/          # Unified login interface
│   │   └── maintenance/    # Fallback page when system is locked
│   ├── components/         # Reusable React components (UI elements, forms)
│   ├── lib/                # Shared utilities
│   │   ├── auth.ts         # JWT signing/verification logic
│   │   ├── db.ts           # Prisma client instantiation
│   │   └── utils.ts        # Helper functions (Tailwind merge, etc.)
├── .env.example            # Environment variables template
└── next.config.ts          # Next.js configuration
```

---

## 🗄️ Database Schema (Prisma)

The application uses PostgreSQL with the following core entities:

1. **`Student`**: Represents a student with `registerNumber` and `email` as unique identifiers. Tracks if they are active, eligible, and if they have submitted their registration (`hasSubmitted`).
2. **`Faculty`**: Users with admin capabilities. Contains a `role` field (`FACULTY` or `SUPER_ADMIN`).
3. **`Elective`**: Represents a course offering belonging to `groupNumber` (1 or 2). Tracks `totalSeats`, `availableSeats`, and whether it `isFull`.
4. **`Registration`**: Links a student to their selected Group 1 and Group 2 electives. Created atomically when a student submits.
5. **`Settings`**: A single-row table (`id="system"`) that controls global portal state:
   - `registrationEnabled`, `maintenanceMode`, `showLiveSeats`, `allowRegistrationEdit`
   - `registrationStart`, `registrationEnd`
6. **`LoginAttempt`**: Tracks failed login attempts per email/identifier to enforce brute-force lockouts.

---

## 🔑 User Roles & Permissions

| Feature | Student | Faculty | Super Admin |
| :--- | :---: | :---: | :---: |
| Authenticate & Sign In | ✅ | ✅ | ✅ |
| View Countdown / Scheduled Time | ✅ | ✅ | ✅ |
| Select & Register Electives | ✅ | ❌ | ❌ |
| Edit Selections (If enabled in settings) | ✅ | ❌ | ❌ |
| View Occupancy Charts & Stats | ❌ | ✅ | ✅ |
| Change Seats / Configure Electives | ❌ | ✅ | ✅ |
| Open / Close Registration Portal | ❌ | ✅ | ✅ |
| Import Student Directory via CSV | ❌ | ✅ | ✅ |
| Reset Student Password to Reg No | ❌ | ✅ | ✅ |
| Export Registration Reports (CSV) | ❌ | ✅ | ✅ |
| Provision New Faculty Accounts | ❌ | ❌ | ✅ |
| Toggle Maintenance / Live Seat Visibility | ❌ | ❌ | ✅ |

---

## 🔒 Authentication & Credentials

### 1. Student Portal
- **Login ID**: Official SRM Email Address (validated to end with `@srmist.edu.in`)
- **Initial Password**: Register Number (case-insensitive, capitalized internally upon submission)
- **Account Generation**: Accounts are automatically generated during CSV import. Passwords are set to the `registerNumber` and hashed using bcrypt.
- **Experience**: One-time portal usage (no password change module is exposed to keep the UX frictionless and lean).

### 2. Faculty / Admin Portal
- **Login ID**: Faculty Email
- **Password**: Secure custom password
- **Master Admin Account** (Created automatically via the database seed script):
  - **Email**: `admin@electify.edu`
  - **Password**: `Admin@12345`
  > **Note:** Please log in and change this credential or create your own Super Admin account prior to production launch.

---

## ⚡ Concurrency & Booking Transaction Safeguards

To prevent overbooking (e.g., when two students book the last available seat of an elective at the exact same millisecond), registrations are wrapped inside a strict **Prisma Database Transaction** (`$transaction`):

1. **Old Seat Release (Edits)**: If `allowRegistrationEdit` is enabled and a student changes their choice, the transaction increments the available seats of their *old* courses and resets `isFull = false`.
2. **Atomic Seat Decrement**: The transaction issues an atomic decrement (`decrement: 1`) on the newly selected courses.
3. **Capacity Check**: If the resulting seat count falls below `0`, the transaction throws a database exception, instantly aborting and rolling back all changes. The student is informed the course is full.
4. **Visibility Toggle**: If available seats hit exactly `0`, the `isFull` flag is updated to `true`.
5. **Upsert Entry**: The `Registration` record is saved, and the `Student`'s `hasSubmitted` flag is marked `true`.

---

## 🛠️ Local Installation & Development

### Prerequisites
- Node.js (v18.x or v20.x+)
- Local PostgreSQL instance or a Docker database container

### 1. Clone & Install Dependencies
```bash
# Install packages (peer conflicts with React 19 RC are bypassed via project .npmrc)
npm install
```

### 2. Configure Environment Variables
Create a `.env` or `.env.local` file in the root of the project:
```env
# Database connection string
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
This populates the default system settings, Super Admin, Faculty accounts, default electives, and three test students.
```bash
npx tsx prisma/seed.ts
```

### 5. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the portal.

---

## 📋 CSV Import Format (For Admins)

When importing the student directory via the Faculty Dashboard, upload a CSV file with the exact headers below:
```csv
registerNumber,name,email
RA2532241010001,Student One,student1@srmist.edu.in
RA2532241010002,Student Two,student2@srmist.edu.in
RA2532241010003,Student Three,student3@srmist.edu.in
```
- During upload, initial passwords will automatically be set to the student's Register Number and securely hashed.
- Duplicate Register Numbers or Emails will safely update the student's name without resetting their existing registration.

---

## 🌐 Production Deployment Guide (Vercel + Supabase/Neon)

### Step 1: Provision a PostgreSQL Database
1. Create a PostgreSQL project in **Supabase** or **Neon**.
2. Copy the connection string. For Serverless environments, ensure you use the **Transaction connection pooler** URL (e.g., port `6543` for Supabase).

### Step 2: Set Environment Variables on Vercel
In the Vercel project Settings under **Environment Variables**, add:
1. `DATABASE_URL`: Your pooled PostgreSQL connection string.
2. `JWT_SECRET`: A secure, random 32+ character string (generate using `openssl rand -base64 32`).

### Step 3: Configure Build Command
Set the custom build command in Vercel to:
```bash
prisma generate && next build
```
This ensures the Prisma client is built inside the serverless deployment container before Webpack optimizes the pages.

### Step 4: Run Initial Production Seeding
To seed your live production database with settings, electives, and the default Super Admin:
```bash
# Load production DATABASE_URL locally in your shell and run:
DATABASE_URL="your-production-database-url" npx tsx prisma/seed.ts
```

---

## 🧪 Verification & QA Checklist

Before launching to students, perform these checks:
1. **Maintenance Block**: Toggle `maintenanceMode` in settings. Verify students are immediately redirected to `/maintenance` on load/refresh.
2. **Countdown Lock**: Set the registration start time to a future date. Log in as a student and confirm they are redirected to `/countdown` displaying a ticking timer.
3. **Live Seats Toggle**: Toggle `showLiveSeats`. Verify student cards display "Available" instead of exact numbers if turned off.
4. **Single Submission Policy**: Submit selections as a test student. Verify the dashboard redirects to `/dashboard/success` on reload and locks further selection options (unless `allowRegistrationEdit` is enabled).
