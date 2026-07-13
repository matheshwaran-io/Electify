/**
 * Electify AEMS — Database Seed Script
 *
 * Seeds master data + System Admin account.
 * Run with: npx tsx src/lib/db/seed.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import * as schema from "./schema";

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  console.log("🌱 Seeding Electify database...\n");

  // ── 1. Faculty ──────────────────────────────────────────────────
  console.log("  → Faculties...");
  const [fsh] = await db
    .insert(schema.faculties)
    .values({
      name: "Faculty of Science & Humanities",
      code: "FSH",
    })
    .onConflictDoNothing({ target: schema.faculties.code })
    .returning();

  const facultyId = fsh?.id;
  if (!facultyId) {
    console.log("    ✓ Faculty FSH already exists, fetching...");
    const existing = await db.query.faculties.findFirst({
      where: (f, { eq }) => eq(f.code, "FSH"),
    });
    if (!existing) throw new Error("Faculty FSH not found");
    Object.assign(fsh ?? {}, existing);
  }
  const fshId = fsh?.id ?? (await db.query.faculties.findFirst({ where: (f, { eq }) => eq(f.code, "FSH") }))!.id;
  console.log(`    ✓ FSH (${fshId})`);

  // ── 2. Departments ─────────────────────────────────────────────
  console.log("  → Departments...");
  const departmentData = [
    { name: "Computer Applications", code: "CA" },
    { name: "Mathematics", code: "MATH" },
    { name: "Physics", code: "PHY" },
    { name: "Chemistry", code: "CHEM" },
    { name: "Commerce", code: "COM" },
    { name: "English", code: "ENG" },
    { name: "Economics", code: "ECON" },
    { name: "Visual Communication", code: "VISCOM" },
    { name: "Psychology", code: "PSY" },
  ];

  for (const dept of departmentData) {
    await db
      .insert(schema.departments)
      .values({ ...dept, facultyId: fshId })
      .onConflictDoNothing({ target: schema.departments.code });
  }

  const caDept = await db.query.departments.findFirst({
    where: (d, { eq }) => eq(d.code, "CA"),
  });
  if (!caDept) throw new Error("Department CA not found");
  console.log(`    ✓ ${departmentData.length} departments seeded`);

  // ── 3. Programmes ──────────────────────────────────────────────
  console.log("  → Programmes...");
  const programmeData = [
    { name: "Master of Computer Applications", code: "MCA", degreeType: "PG" },
    { name: "Bachelor of Computer Applications", code: "BCA", degreeType: "UG" },
    { name: "MSc Computer Science", code: "MSC-CS", degreeType: "PG" },
  ];

  for (const prog of programmeData) {
    await db
      .insert(schema.programmes)
      .values({ ...prog, departmentId: caDept.id })
      .onConflictDoNothing({ target: schema.programmes.code });
  }

  const mcaProg = await db.query.programmes.findFirst({
    where: (p, { eq }) => eq(p.code, "MCA"),
  });
  if (!mcaProg) throw new Error("Programme MCA not found");
  console.log(`    ✓ ${programmeData.length} programmes seeded`);

  // ── 4. Sections (A–J for MCA) ──────────────────────────────────
  console.log("  → Sections...");
  const sectionLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  for (const label of sectionLabels) {
    await db
      .insert(schema.sections)
      .values({ label, programmeId: mcaProg.id })
      .onConflictDoNothing();
  }
  console.log(`    ✓ ${sectionLabels.length} sections (A–J) for MCA`);

  // ── 5. System Admin Account ────────────────────────────────────
  console.log("  → System Admin...");
  const adminEmail = "admin@electify.edu";
  const adminPassword = "Admin@12345";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  await db
    .insert(schema.users)
    .values({
      name: "System Administrator",
      email: adminEmail,
      passwordHash: adminHash,
      role: "SYSTEM_ADMIN",
      employeeId: "EMP-ADMIN",
      isActive: true,
      isEligible: true,
    })
    .onConflictDoNothing({ target: schema.users.email });

  console.log(`    ✓ admin@electify.edu / Admin@12345`);

  // ── 6. System Settings ─────────────────────────────────────────
  console.log("  → System Settings...");
  await db
    .insert(schema.systemSettings)
    .values({
      id: "system",
      maintenanceMode: false,
    })
    .onConflictDoNothing();
  console.log("    ✓ Default system settings");

  // ── Done ───────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!\n");
  console.log("  System Admin Credentials:");
  console.log("  ─────────────────────────");
  console.log("  Email:    admin@electify.edu");
  console.log("  Password: Admin@12345");
  console.log("  Role:     SYSTEM_ADMIN");
  console.log("");

  await pool.end();
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
