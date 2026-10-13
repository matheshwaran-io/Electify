import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Pool } from "pg";
import { srmData } from "../src/lib/db/srm-data";

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

  let prefix = progName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  if (prefix.length < 2) prefix = progName.substring(0, 3).toUpperCase();
  const hash = Math.abs((progName + (deptCode || "")).split("").reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)).toString(36).substring(0, 4).toUpperCase();
  const code = deptCode ? `${prefix}-${deptCode}-${hash}` : `${prefix}-${hash}`;

  return {
    name: progName,
    code,
    degreeType,
    durationYears,
    semesters: durationYears * 2,
  };
}

async function runCleanupAndSync() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString });
  console.log("🧹 Electify Master Academic Structure Cleanup & Sync\n");

  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    // ── 1. Identify & Purge Test Users ─────────────────────────────────────────
    console.log("1. Purging test accounts...");
    // Real emails that must NEVER be deleted under any circumstance
    const preservedEmails = [
      "admin@electify.edu",
      "angelb1@srmist.edu.in",
      "sabenaba@srmist.edu.in",
      "sheerina2@srmist.edu.in",
    ];

    // Find test users
    const testUsersRes = await client.query(`
      SELECT id, email, name, role FROM users
      WHERE NOT (email = ANY($1::text[]))
        AND (
          email ~ '^(admin_|coord_|coorda_|coordb_|tutor_|student_|stud_|s1_|adm_|drangel|adminmaster)'
          OR email LIKE '%344c7270%'
          OR email LIKE '%526273d3%'
          OR email LIKE '%test%'
          OR email LIKE '%mock%'
          OR name LIKE '%344c7270%'
          OR name LIKE '%526273d3%'
          OR name LIKE '%Test%'
          OR name LIKE '%Mock%'
          OR (role = 'STUDENT' AND register_number LIKE '%344c7270%')
          OR (role = 'STUDENT' AND register_number LIKE '%test%')
        );
    `, [preservedEmails]);

    const testUserIds: string[] = testUsersRes.rows.map((r) => r.id);
    console.log(`  → Found ${testUserIds.length} test accounts to remove:`, testUsersRes.rows.map((r) => r.email));

    if (testUserIds.length > 0) {
      // Clean dependent rows
      await client.query(`DELETE FROM tutor_sections WHERE tutor_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM invite_codes WHERE created_by_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM pin_reset_requests WHERE student_id = ANY($1::uuid[]) OR tutor_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM event_students WHERE student_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM student_registrations WHERE student_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM registrations WHERE student_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM replay_events WHERE student_id = ANY($1::uuid[]) OR performed_by = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM login_attempts WHERE identifier IN (SELECT email FROM users WHERE id = ANY($1::uuid[]));`, [testUserIds]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[]);`, [testUserIds]);
      console.log("  ✓ Test users and their references successfully removed.");
    }

    // ── 2. Purge Mock Registration Events & Mock Electives ─────────────────────
    console.log("\n2. Purging mock registration events & mock electives...");
    const mockEventsRes = await client.query(`
      SELECT id, name FROM registration_events
      WHERE id = '0101a6ec-a5f4-4bbe-b757-e9091c75f529'
         OR name LIKE '%Test%'
         OR name LIKE '%Mock%'
         OR name LIKE 'Ev_%';
    `);

    const mockEventIds: string[] = mockEventsRes.rows.map((r) => r.id);
    if (mockEventIds.length > 0) {
      console.log(`  → Purging mock events:`, mockEventsRes.rows.map((r) => r.name));
      await client.query(`DELETE FROM event_sections WHERE event_id = ANY($1::uuid[]);`, [mockEventIds]);
      await client.query(`DELETE FROM student_registrations WHERE event_id = ANY($1::uuid[]);`, [mockEventIds]);
      await client.query(`DELETE FROM registrations WHERE event_id = ANY($1::uuid[]);`, [mockEventIds]);
      await client.query(`DELETE FROM replay_events WHERE registration_event_id = ANY($1::uuid[]);`, [mockEventIds]);
      await client.query(`
        DELETE FROM electives WHERE group_id IN (
          SELECT id FROM elective_groups WHERE event_id = ANY($1::uuid[])
        );
      `, [mockEventIds]);
      await client.query(`DELETE FROM elective_groups WHERE event_id = ANY($1::uuid[]);`, [mockEventIds]);
      await client.query(`DELETE FROM registration_events WHERE id = ANY($1::uuid[]);`, [mockEventIds]);
      console.log("  ✓ Mock registration events purged.");
    }

    // Purge test invite codes
    await client.query(`
      DELETE FROM invite_codes
      WHERE code LIKE 'EF-MSCIT3%'
         OR code LIKE '%TEST%'
         OR code LIKE '%344c7270%';
    `);
    console.log("  ✓ Test invite codes purged.");

    // ── 3. Align The 5 Official SRM Faculties ──────────────────────────────────
    console.log("\n3. Aligning the 5 official faculties...");
    // 5 allowed faculty codes: CET, FLABS, FM, FMHS, LAW
    // First, migrate legacy FSH -> FLABS if needed
    await client.query(`
      UPDATE faculties
      SET name = 'Faculty of Liberal Arts & Business Studies', code = 'FLABS', is_active = true, updated_at = NOW()
      WHERE code = 'FSH';
    `);

    // Ensure Faculty of Engineering & Technology has exact name
    await client.query(`
      UPDATE faculties
      SET name = 'Faculty of Engineering & Technology', is_active = true, updated_at = NOW()
      WHERE code = 'CET';
    `);

    // Ensure Faculty of Management has exact name
    await client.query(`
      UPDATE faculties
      SET name = 'Faculty of Management', is_active = true, updated_at = NOW()
      WHERE code = 'FM';
    `);

    // Ensure Medicine & Health Sciences has exact name
    await client.query(`
      UPDATE faculties
      SET name = 'Medicine & Health Sciences', is_active = true, updated_at = NOW()
      WHERE code = 'FMHS';
    `);

    // Ensure SRM School of Law has exact name
    await client.query(`
      UPDATE faculties
      SET name = 'SRM School of Law', is_active = true, updated_at = NOW()
      WHERE code = 'LAW';
    `);

    // Delete all other faculties (mock faculties, FAS, etc.) and their children
    const nonAllowedFacsRes = await client.query(`
      SELECT id, name, code FROM faculties
      WHERE code NOT IN ('CET', 'FLABS', 'FM', 'FMHS', 'LAW');
    `);
    const nonAllowedFacIds: string[] = nonAllowedFacsRes.rows.map((r) => r.id);

    if (nonAllowedFacIds.length > 0) {
      console.log(`  → Removing ${nonAllowedFacIds.length} non-allowed/mock faculties:`, nonAllowedFacsRes.rows.map((r) => `${r.name} (${r.code})`));

      const deptsRes = await client.query(`SELECT id FROM departments WHERE faculty_id = ANY($1::uuid[]);`, [nonAllowedFacIds]);
      const deptIds = deptsRes.rows.map((r) => r.id);

      let progIds: string[] = [];
      if (deptIds.length > 0) {
        const progsRes = await client.query(`SELECT id FROM programmes WHERE department_id = ANY($1::uuid[]);`, [deptIds]);
        progIds = progsRes.rows.map((r) => r.id);
      }

      let batchIds: string[] = [];
      if (progIds.length > 0) {
        const batchesRes = await client.query(`SELECT id FROM academic_batches WHERE programme_id = ANY($1::uuid[]);`, [progIds]);
        batchIds = batchesRes.rows.map((r) => r.id);
      }

      let sectionIds: string[] = [];
      if (batchIds.length > 0) {
        const sectionsRes = await client.query(`SELECT id FROM sections WHERE academic_batch_id = ANY($1::uuid[]);`, [batchIds]);
        sectionIds = sectionsRes.rows.map((r) => r.id);
      }

      if (sectionIds.length > 0) {
        await client.query(`DELETE FROM tutor_sections WHERE section_id = ANY($1::uuid[]);`, [sectionIds]);
        await client.query(`DELETE FROM event_sections WHERE section_id = ANY($1::uuid[]);`, [sectionIds]);
        await client.query(`UPDATE users SET section_id = NULL WHERE section_id = ANY($1::uuid[]);`, [sectionIds]);
        await client.query(`DELETE FROM sections WHERE id = ANY($1::uuid[]);`, [sectionIds]);
      }

      if (batchIds.length > 0) {
        await client.query(`DELETE FROM cohort_session_terms WHERE academic_batch_id = ANY($1::uuid[]);`, [batchIds]);
        await client.query(`UPDATE users SET academic_batch_id = NULL WHERE academic_batch_id = ANY($1::uuid[]);`, [batchIds]);
        await client.query(`DELETE FROM academic_batches WHERE id = ANY($1::uuid[]);`, [batchIds]);
      }

      if (progIds.length > 0) {
        await client.query(`UPDATE users SET programme_id = NULL WHERE programme_id = ANY($1::uuid[]);`, [progIds]);
        await client.query(`DELETE FROM programmes WHERE id = ANY($1::uuid[]);`, [progIds]);
      }

      if (deptIds.length > 0) {
        await client.query(`UPDATE users SET department_id = NULL WHERE department_id = ANY($1::uuid[]);`, [deptIds]);
        await client.query(`DELETE FROM departments WHERE id = ANY($1::uuid[]);`, [deptIds]);
      }

      await client.query(`UPDATE users SET faculty_id = NULL WHERE faculty_id = ANY($1::uuid[]);`, [nonAllowedFacIds]);
      await client.query(`DELETE FROM faculties WHERE id = ANY($1::uuid[]);`, [nonAllowedFacIds]);
      console.log("  ✓ Non-allowed faculties and their descendants removed.");
    }

    // Purge any legacy/obsolete departments that are not part of srmData
    const officialDeptCodes = new Set<string>();
    const officialDeptNames = new Set<string>();
    for (const f of srmData.university.faculties) {
      for (const d of f.departments) {
        officialDeptNames.add(d.name.toLowerCase().trim());
        const code = (d as any).code || (d.name.split(/\s+/).map((w: string) => w[0]?.toUpperCase()).join("") + "-" + f.code);
        officialDeptCodes.add(code.toLowerCase().trim());
      }
    }
    const currentDepts = await client.query(`SELECT id, name, code FROM departments;`);
    const obsoleteDepts = currentDepts.rows.filter((d) => 
      !officialDeptNames.has(d.name.toLowerCase().trim()) && 
      !officialDeptCodes.has(d.code.toLowerCase().trim()) &&
      d.code !== "CA-FLABS"
    );
    if (obsoleteDepts.length > 0) {
      const obsDeptIds = obsoleteDepts.map((d) => d.id);
      const obsProgs = await client.query(`SELECT id FROM programmes WHERE department_id = ANY($1::uuid[]);`, [obsDeptIds]);
      const obsProgIds = obsProgs.rows.map((p) => p.id);
      if (obsProgIds.length > 0) {
        const obsBatches = await client.query(`SELECT id FROM academic_batches WHERE programme_id = ANY($1::uuid[]);`, [obsProgIds]);
        const obsBatchIds = obsBatches.rows.map((b) => b.id);
        if (obsBatchIds.length > 0) {
          await client.query(`DELETE FROM cohort_session_terms WHERE academic_batch_id = ANY($1::uuid[]);`, [obsBatchIds]);
          await client.query(`DELETE FROM sections WHERE academic_batch_id = ANY($1::uuid[]);`, [obsBatchIds]);
          await client.query(`DELETE FROM academic_batches WHERE id = ANY($1::uuid[]);`, [obsBatchIds]);
        }
        await client.query(`DELETE FROM programmes WHERE id = ANY($1::uuid[]);`, [obsProgIds]);
      }
      await client.query(`DELETE FROM departments WHERE id = ANY($1::uuid[]);`, [obsDeptIds]);
      console.log(`  ✓ Removed ${obsoleteDepts.length} legacy obsolete departments.`);
    }

    // ── 4. Align Department of Computer Applications (CA-FLABS) ────────────────
    console.log("\n4. Aligning Department of Computer Applications...");
    const flabsFac = (await client.query(`SELECT id FROM faculties WHERE code = 'FLABS';`)).rows[0];
    if (!flabsFac) throw new Error("FLABS faculty record not found!");

    // Update CA department to exact official name & code
    await client.query(`
      UPDATE departments
      SET name = 'Department of Computer Applications', code = 'CA-FLABS', faculty_id = $1, is_active = true, updated_at = NOW()
      WHERE code IN ('CA-FSH', 'CA', 'CA-FLABS');
    `, [flabsFac.id]);

    const caDept = (await client.query(`SELECT id FROM departments WHERE code = 'CA-FLABS';`)).rows[0];
    if (!caDept) throw new Error("CA-FLABS department record not found!");

    // Update real faculty tutors to be under FLABS and CA-FLABS
    await client.query(`
      UPDATE users
      SET faculty_id = $1, department_id = $2, updated_at = NOW()
      WHERE email IN ('angelb1@srmist.edu.in', 'sabenaba@srmist.edu.in', 'sheerina2@srmist.edu.in');
    `, [flabsFac.id, caDept.id]);
    console.log("  ✓ Real tutors linked to FLABS and Department of Computer Applications.");

    // Update real students to be under FLABS and CA-FLABS
    await client.query(`
      UPDATE users
      SET faculty_id = $1, department_id = $2, updated_at = NOW()
      WHERE role = 'STUDENT';
    `, [flabsFac.id, caDept.id]);
    console.log("  ✓ Real students linked to FLABS and Department of Computer Applications.");

    // Update real students' programme_id based on their academic_batch_id
    await client.query(`
      UPDATE users u
      SET programme_id = b.programme_id, updated_at = NOW()
      FROM academic_batches b
      WHERE u.academic_batch_id = b.id AND u.role = 'STUDENT';
    `);
    console.log("  ✓ Real students' programme_id populated from their cohort batch.");

    // Ensure tutor_sections for sabenaba exists (Angel already has section F 2026)
    const sabenabaUser = (await client.query(`SELECT id, section_id FROM users WHERE email = 'sabenaba@srmist.edu.in';`)).rows[0];
    if (sabenabaUser?.section_id) {
      await client.query(`
        INSERT INTO tutor_sections (tutor_id, section_id)
        VALUES ($1, $2)
        ON CONFLICT (tutor_id, section_id) DO NOTHING;
      `, [sabenabaUser.id, sabenabaUser.section_id]);
      console.log("  ✓ Verified Sabenabanu tutor_section mapping.");
    }

    // ── 5. Seed / Sync Full SRM Master Hierarchy for the 5 Faculties ───────────
    console.log("\n5. Seeding full SRM master hierarchy (85 depts, 453 programmes)...");
    const sectionLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

    for (const faculty of srmData.university.faculties) {
      // Upsert faculty
      const facUpsert = await client.query(`
        INSERT INTO faculties (name, code, is_active, updated_at)
        VALUES ($1, $2, true, NOW())
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name, is_active = true, updated_at = NOW()
        RETURNING id;
      `, [faculty.name, faculty.code]);
      const facultyId = facUpsert.rows[0].id;

      for (const dept of faculty.departments) {
        const deptCode = (dept as any).code || (dept.name.split(/\s+/).map((w: string) => w[0]?.toUpperCase()).join("") + "-" + faculty.code);

        const deptUpsert = await client.query(`
          INSERT INTO departments (name, code, faculty_id, is_active, updated_at)
          VALUES ($1, $2, $3, true, NOW())
          ON CONFLICT (code) DO UPDATE
          SET name = EXCLUDED.name, faculty_id = EXCLUDED.faculty_id, is_active = true, updated_at = NOW()
          RETURNING id;
        `, [dept.name, deptCode, facultyId]);
        const departmentId = deptUpsert.rows[0].id;

        for (const progStr of dept.programmes) {
          const pData = parseProgramme(progStr, deptCode);

          // Check if programme exists by name under this department, or by code
          let progId: string;
          const existingProg = await client.query(`
            SELECT id FROM programmes WHERE department_id = $1 AND name = $2 LIMIT 1;
          `, [departmentId, pData.name]);

          if (existingProg.rows.length > 0) {
            progId = existingProg.rows[0].id;
            await client.query(`
              UPDATE programmes
              SET degree_type = $1, duration_years = $2, semesters = $3, is_active = true, updated_at = NOW()
              WHERE id = $4;
            `, [pData.degreeType, pData.durationYears, pData.semesters, progId]);
          } else {
            const progUpsert = await client.query(`
              INSERT INTO programmes (name, code, degree_type, duration_years, semesters, department_id, is_active, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
              ON CONFLICT (code) DO UPDATE
              SET name = EXCLUDED.name, department_id = EXCLUDED.department_id, is_active = true, updated_at = NOW()
              RETURNING id;
            `, [pData.name, pData.code, pData.degreeType, pData.durationYears, pData.semesters, departmentId]);
            progId = progUpsert.rows[0].id;
          }

          // Ensure academic batch for year 2026 exists
          const batchUpsert = await client.query(`
            INSERT INTO academic_batches (year, admission_year, expected_end_year, programme_id, is_active, updated_at)
            VALUES ('2026', 2026, 2026 + $1, $2, true, NOW())
            ON CONFLICT (year, programme_id) DO NOTHING
            RETURNING id;
          `, [pData.durationYears, progId]);

          let batchId = batchUpsert.rows[0]?.id;
          if (!batchId) {
            const batchQuery = await client.query(`
              SELECT id FROM academic_batches WHERE year = '2026' AND programme_id = $1;
            `, [progId]);
            batchId = batchQuery.rows[0]?.id;
          }

          if (batchId) {
            // Seed sections A through J for batch 2026
            for (const label of sectionLabels) {
              await client.query(`
                INSERT INTO sections (label, academic_batch_id, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (label, academic_batch_id) DO NOTHING;
              `, [label, batchId]);
            }
          }
        }
      }
    }
    console.log("  ✓ Master hierarchy seeded and verified.");

    // ── 6. Ensure System Settings Exist ────────────────────────────────────────
    await client.query(`
      INSERT INTO system_settings (id, maintenance_mode)
      VALUES ('system', false)
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query("COMMIT;");
    console.log("\n✅ Transaction COMMITTED successfully!\n");

    // Print summary verification
    const facSummary = await client.query(`SELECT id, code, name FROM faculties ORDER BY name;`);
    console.log("Final Faculties in DB (" + facSummary.rows.length + "):");
    console.table(facSummary.rows);

    const userSummary = await client.query(`
      SELECT role, count(*) FROM users GROUP BY role ORDER BY count(*) DESC;
    `);
    console.log("Final Users by role:");
    console.table(userSummary.rows);

    const eventSummary = await client.query(`SELECT id, name, status FROM registration_events;`);
    console.log("Final Registration events:");
    console.table(eventSummary.rows);

    const regSummary = await client.query(`SELECT count(*) FROM registrations;`);
    console.log("Final Student Registrations Count:", regSummary.rows[0].count);

  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Cleanup and sync failed, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runCleanupAndSync().catch((err) => {
  console.error(err);
  process.exit(1);
});
