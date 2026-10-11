/**
 * Electify AEMS — Database Seed Script
 *
 * Seeds master data + System Admin account using full SRM university data.
 * Run with: npx tsx src/lib/db/seed.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import * as schema from "./schema";
import { srmData } from "./srm-data";

function parseProgramme(progName: string, deptCode: string = "") {
  let degreeType = "UG";
  let durationYears = 3;

  const isPhd = progName.includes("Ph.D") || progName.includes("PhD.") || progName.includes("Ph.D.") || progName.includes("Doctoral");
  const isLaw5Yr = (progName.includes("LL.B") || progName.includes("LLB")) && !progName.includes("LL.M") && !progName.includes("LLM");
  const isArch5Yr = progName.includes("B.Arch") || progName.includes("Pharm.D") || progName.includes("MBBS") || progName.includes("BDS");
  const isEng4Yr = progName.includes("B.Tech") || progName.includes("B.Pharm") || progName.includes("BPT") || progName.includes("B.P.T") || progName.includes("BOT") || progName.includes("B.Des");
  const isPG = progName.includes("M.") || progName.includes("MBA") || progName.includes("M.B.A") || progName.includes("MCA") || progName.includes("M.C.A") || progName.includes("LL.M") || progName.includes("LLM") || progName.includes("MPH") || progName.includes("MD") || progName.includes("M.D") || progName.includes("MS") || progName.includes("M.S") || progName.includes("DM") || progName.includes("D.M") || progName.includes("M.Ch") || progName.includes("M.Pharm") || progName.includes("M.O.T") || progName.includes("M.P.T") || progName.includes("MSW") || progName.includes("M.Com") || progName.includes("M.Ed") || progName.includes("M.Arch") || progName.includes("M.Des");
  const isMinor = progName.includes("Minor Degree");
  const isDiploma = progName.includes("Diploma") || progName.includes("Certificate");

  if (isPhd) {
    degreeType = "PHD";
    durationYears = 3;
  } else if (isLaw5Yr || isArch5Yr) {
    durationYears = progName.includes("LL.B. Bachelor") ? 3 : 5;
    degreeType = "UG";
  } else if (isEng4Yr) {
    durationYears = 4;
    degreeType = "UG";
  } else if (isPG) {
    degreeType = "PG";
    durationYears = progName.includes("Integrated") ? 5 : 2;
  } else if (isMinor) {
    degreeType = "MINOR";
    durationYears = 2;
  } else if (isDiploma) {
    degreeType = "DIPLOMA";
    durationYears = 1;
  }

  // Create a unique code
  let code = progName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase())
    .join("");

  // Special case for common programmes to make sure codes are somewhat sensible
  if (progName === "Master of Computer Applications" || progName === "MCA") code = "MCA";
  if (progName === "Bachelor of Computer Applications" || progName === "BCA") code = "BCA";
  
  // Just in case we get very long or empty codes
  if (code.length < 2) code = progName.substring(0, 3).toUpperCase();

  // Append hash of full name + deptCode to avoid code collisions
  const hash = Math.abs((progName + (deptCode || "")).split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)).toString(36).substring(0,4).toUpperCase();
  code = deptCode ? `${code}-${deptCode}-${hash}` : `${code}-${hash}`;

  return {
    name: progName,
    code,
    degreeType,
    durationYears,
    semesters: durationYears * 2,
  };
}

async function seed() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log("🌱 Seeding Electify database (Full SRM Structure)...\n");

  const sectionLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  for (const faculty of srmData.university.faculties) {
    console.log(`  → Faculty: ${faculty.name}`);
    const [f] = await db
      .insert(schema.faculties)
      .values({ name: faculty.name, code: faculty.code })
      .onConflictDoUpdate({ target: schema.faculties.code, set: { name: faculty.name } })
      .returning();

    for (const dept of faculty.departments) {
      const deptCode = (dept as any).code || (dept.name.split(/\s+/).map((w: string) => w[0]?.toUpperCase()).join("") + "-" + faculty.code);
      const [d] = await db
        .insert(schema.departments)
        .values({ name: dept.name, code: deptCode, facultyId: f.id })
        .onConflictDoUpdate({ target: schema.departments.code, set: { name: dept.name } })
        .returning();

      for (const progStr of dept.programmes) {
        const pData = parseProgramme(progStr, deptCode);
        const [p] = await db
          .insert(schema.programmes)
          .values({ ...pData, departmentId: d.id })
          .onConflictDoUpdate({ target: schema.programmes.code, set: { name: pData.name } })
          .returning();

        const [batch] = await db
          .insert(schema.academicBatches)
          .values({ year: "2026", programmeId: p.id })
          // @ts-ignore
          .onConflictDoNothing()
          .returning();
        
        let batchId = batch?.id;
        if (!batchId) {
           const existing = await db.query.academicBatches.findFirst({
              where: (ab, { eq, and }) => and(eq(ab.year, "2026"), eq(ab.programmeId, p.id))
           });
           batchId = existing!.id;
        }

        // Insert sections
        for (const label of sectionLabels) {
          await db
            .insert(schema.sections)
            .values({ label, academicBatchId: batchId })
            .onConflictDoNothing();
        }
      }
    }
  }

  console.log("    ✓ Full hierarchy seeded successfully");

  // ── System Admin Account ────────────────────────────────────
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

  // ── System Settings ─────────────────────────────────────────
  console.log("  → System Settings...");
  await db
    .insert(schema.systemSettings)
    .values({
      id: "system",
      maintenanceMode: false,
    })
    .onConflictDoNothing();
  console.log("    ✓ Default system settings");

  console.log("\n✅ Seed complete!\n");
  await pool.end();
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
