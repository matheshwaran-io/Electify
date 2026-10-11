import { NextResponse } from "next/server";
import { pool, db, ensureDatabaseReady } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldSetup = searchParams.get("setup") === "1" || searchParams.get("setup") === "true";

  const result: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    database: {
      connected: false,
      sslEnabled: !process.env.DATABASE_URL?.includes("localhost") && !process.env.DATABASE_URL?.includes("127.0.0.1"),
      latencyMs: null,
      error: null,
      tables: {},
      adminAccount: {
        exists: false,
        isActive: false,
      },
    },
  };

  const start = performance.now();

  try {
    // 1. Connection check
    await pool.query("SELECT 1 AS healthcheck");
    result.database.connected = true;
    result.database.latencyMs = Math.round(performance.now() - start);

    // 2. Schema auto-heal
    await ensureDatabaseReady();

    // 3. Inspect table existence
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'faculties', 'departments', 'programmes', 'sections', 'login_attempts', 'audit_logs')
    `);
    const foundTables = new Set(tableCheck.rows.map((r: any) => r.table_name));

    result.database.tables = {
      users: foundTables.has("users"),
      faculties: foundTables.has("faculties"),
      departments: foundTables.has("departments"),
      programmes: foundTables.has("programmes"),
      sections: foundTables.has("sections"),
      loginAttempts: foundTables.has("login_attempts"),
      auditLogs: foundTables.has("audit_logs"),
    };

    // 4. Inspect columns in users table
    if (foundTables.has("users")) {
      const colCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'current_session_id'
      `);
      result.database.hasCurrentSessionIdColumn = colCheck.rows.length > 0;

      // 5. Check if admin exists
      const [adminUser] = await db
        .select({ id: users.id, email: users.email, role: users.role, isActive: users.isActive })
        .from(users)
        .where(eq(users.email, "admin@electify.edu"))
        .limit(1);

      if (adminUser) {
        result.database.adminAccount = {
          exists: true,
          email: adminUser.email,
          role: adminUser.role,
          isActive: adminUser.isActive,
        };
      } else if (shouldSetup) {
        // Auto-provision admin if setup parameter passed
        const adminPassword = "Admin@12345";
        const adminHash = await bcrypt.hash(adminPassword, 12);
        await db.insert(users).values({
          name: "System Administrator",
          email: "admin@electify.edu",
          passwordHash: adminHash,
          role: "SYSTEM_ADMIN",
          employeeId: "EMP-ADMIN",
          isActive: true,
          isEligible: true,
        }).onConflictDoNothing({ target: users.email });

        result.database.adminAccount = {
          exists: true,
          provisionedNow: true,
          email: "admin@electify.edu",
          role: "SYSTEM_ADMIN",
          isActive: true,
        };
      }
    }
  } catch (err: any) {
    result.status = "error";
    result.database.connected = false;
    result.database.error = err.message || String(err);
  }

  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
  });
}
