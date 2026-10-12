import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { Pool } from "pg";

async function cleanup() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString });
  console.log("🧹 Starting database cleanup: Removing all mock/test data...\n");

  const client = await pool.connect();

  try {
    await client.query("BEGIN;");

    // 1. Drop empty legacy PascalCase tables from previous Prisma schema
    const legacyTables = [
      '"AuditLog"',
      '"Elective"',
      '"Faculty"',
      '"InviteCode"',
      '"LoginAttempt"',
      '"Registration"',
      '"Settings"',
      '"Student"',
    ];
    for (const table of legacyTables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }
    console.log("  ✓ Dropped legacy unused PascalCase tables");

    // 2. Identify test registration events
    const testEventsQuery = await client.query(`
      SELECT id, name FROM registration_events 
      WHERE name LIKE 'Event Test%' 
         OR name LIKE 'Live Monitor Test%' 
         OR name LIKE 'Ev_%'
    `);
    const testEventIds = testEventsQuery.rows.map((r) => r.id);

    if (testEventIds.length > 0) {
      console.log(`  → Found ${testEventIds.length} test registration events to purge.`);
      
      await client.query(`DELETE FROM student_registrations WHERE event_id = ANY($1::uuid[]);`, [testEventIds]);
      await client.query(`DELETE FROM registrations WHERE event_id = ANY($1::uuid[]);`, [testEventIds]);
      await client.query(`DELETE FROM replay_events WHERE registration_event_id = ANY($1::uuid[]);`, [testEventIds]);
      await client.query(`DELETE FROM event_sections WHERE event_id = ANY($1::uuid[]);`, [testEventIds]);
      await client.query(`DELETE FROM event_students WHERE event_id = ANY($1::uuid[]);`, [testEventIds]);
      
      // Delete electives for groups belonging to test events
      await client.query(`
        DELETE FROM electives WHERE group_id IN (
          SELECT id FROM elective_groups WHERE event_id = ANY($1::uuid[])
        );
      `, [testEventIds]);
      await client.query(`DELETE FROM elective_groups WHERE event_id = ANY($1::uuid[]);`, [testEventIds]);
      
      // Delete test registration events
      await client.query(`DELETE FROM registration_events WHERE id = ANY($1::uuid[]);`, [testEventIds]);
      console.log("  ✓ Cleaned all test events and associated records");
    }

    // 3. Find test faculties (any faculty not part of legitimate SRM structure)
    const testFacultiesQuery = await client.query(`
      SELECT id, name, code FROM faculties 
      WHERE code NOT IN ('CET', 'FSH', 'FMHS', 'FM', 'LAW', 'FAS', 'FLABS');
    `);
    const testFacIds = testFacultiesQuery.rows.map((r) => r.id);

    let testSectionIds: string[] = [];
    let testBatchIds: string[] = [];
    let testProgIds: string[] = [];
    let testDeptIds: string[] = [];

    if (testFacIds.length > 0) {
      console.log(`  → Found ${testFacIds.length} test faculties to purge.`);

      const testDeptsQuery = await client.query(`
        SELECT id FROM departments WHERE faculty_id = ANY($1::uuid[])
      `, [testFacIds]);
      testDeptIds = testDeptsQuery.rows.map((r) => r.id);

      if (testDeptIds.length > 0) {
        const testProgsQuery = await client.query(`
          SELECT id FROM programmes WHERE department_id = ANY($1::uuid[])
        `, [testDeptIds]);
        testProgIds = testProgsQuery.rows.map((r) => r.id);
      }

      if (testProgIds.length > 0) {
        const testBatchesQuery = await client.query(`
          SELECT id FROM academic_batches WHERE programme_id = ANY($1::uuid[])
        `, [testProgIds]);
        testBatchIds = testBatchesQuery.rows.map((r) => r.id);
      }

      if (testBatchIds.length > 0) {
        const testSectionsQuery = await client.query(`
          SELECT id FROM sections WHERE academic_batch_id = ANY($1::uuid[])
        `, [testBatchIds]);
        testSectionIds = testSectionsQuery.rows.map((r) => r.id);
      }
    }

    // 4. Find generated test users
    const testUsersQuery = await client.query(`
      SELECT id, email FROM users 
      WHERE email ~ '^(admin_|coorda_|coordb_|coord_live_|coord_evt_|tutor_|student_|stud_evt_|s1_|adm_|rohan_[0-9]+|student1_)'
         OR email ~ '[0-9]{13}'
    `);
    const testUserIds = testUsersQuery.rows.map((r) => r.id);
    console.log(`  → Found ${testUserIds.length} test users to purge.`);

    // 5. Clean test invite codes (created by test users, or pointing to test entities)
    await client.query(`
      DELETE FROM invite_codes 
      WHERE created_by_id = ANY($1::uuid[])
         OR faculty_id = ANY($2::uuid[])
         OR department_id = ANY($3::uuid[])
         OR programme_id = ANY($4::uuid[])
         OR academic_batch_id = ANY($5::uuid[])
         OR section_id = ANY($6::uuid[])
         OR code LIKE 'SRM-TEST%'
         OR code LIKE 'ADM-2026%'
         OR code LIKE 'COORD-2026%'
         OR code LIKE 'FAC-2026%'
         OR code LIKE 'EF-MCA-F%';
    `, [testUserIds, testFacIds, testDeptIds, testProgIds, testBatchIds, testSectionIds]);
    console.log("  ✓ Purged test invite codes");

    // 6. Clean templates created by test users or matching test names
    await client.query(`
      DELETE FROM template_electives WHERE group_id IN (
        SELECT id FROM template_groups WHERE template_id IN (
          SELECT id FROM event_templates 
          WHERE name LIKE '%Test%' 
             OR name LIKE '%Tpl%' 
             OR name LIKE 'Prog B Template%'
             OR created_by_id = ANY($1::uuid[])
        )
      );
    `, [testUserIds]);

    await client.query(`
      DELETE FROM template_groups WHERE template_id IN (
        SELECT id FROM event_templates 
        WHERE name LIKE '%Test%' 
           OR name LIKE '%Tpl%' 
           OR name LIKE 'Prog B Template%'
           OR created_by_id = ANY($1::uuid[])
      );
    `, [testUserIds]);

    await client.query(`
      DELETE FROM event_templates 
      WHERE name LIKE '%Test%' 
         OR name LIKE '%Tpl%' 
         OR name LIKE 'Prog B Template%'
         OR created_by_id = ANY($1::uuid[]);
    `, [testUserIds]);
    console.log("  ✓ Purged test event templates");

    // 7. Delete test users and user references
    if (testUserIds.length > 0) {
      await client.query(`DELETE FROM event_students WHERE student_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM tutor_sections WHERE tutor_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM pin_reset_requests WHERE student_id = ANY($1::uuid[]) OR tutor_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM registrations WHERE student_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM student_registrations WHERE student_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM replay_events WHERE student_id = ANY($1::uuid[]) OR performed_by = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[]);`, [testUserIds]);
      await client.query(`
        DELETE FROM login_attempts WHERE identifier IN (SELECT email FROM users WHERE id = ANY($1::uuid[]));
      `, [testUserIds]);
      await client.query(`DELETE FROM users WHERE id = ANY($1::uuid[]);`, [testUserIds]);
      console.log("  ✓ Purged all generated test users and their related entries");
    }

    // 8. Delete test hierarchy (sections, batches, programmes, departments, faculties)
    if (testSectionIds.length > 0) {
      await client.query(`DELETE FROM event_sections WHERE section_id = ANY($1::uuid[]);`, [testSectionIds]);
      await client.query(`DELETE FROM tutor_sections WHERE section_id = ANY($1::uuid[]);`, [testSectionIds]);
      await client.query(`DELETE FROM pin_reset_requests WHERE section_id = ANY($1::uuid[]);`, [testSectionIds]);
      await client.query(`UPDATE users SET section_id = NULL WHERE section_id = ANY($1::uuid[]);`, [testSectionIds]);
      await client.query(`DELETE FROM sections WHERE id = ANY($1::uuid[]);`, [testSectionIds]);
    }

    if (testBatchIds.length > 0) {
      await client.query(`UPDATE users SET academic_batch_id = NULL WHERE academic_batch_id = ANY($1::uuid[]);`, [testBatchIds]);
      await client.query(`DELETE FROM academic_batches WHERE id = ANY($1::uuid[]);`, [testBatchIds]);
    }

    if (testProgIds.length > 0) {
      await client.query(`UPDATE users SET programme_id = NULL WHERE programme_id = ANY($1::uuid[]);`, [testProgIds]);
      await client.query(`DELETE FROM programmes WHERE id = ANY($1::uuid[]);`, [testProgIds]);
    }

    if (testDeptIds.length > 0) {
      await client.query(`UPDATE users SET department_id = NULL WHERE department_id = ANY($1::uuid[]);`, [testDeptIds]);
      await client.query(`DELETE FROM departments WHERE id = ANY($1::uuid[]);`, [testDeptIds]);
    }

    if (testFacIds.length > 0) {
      await client.query(`UPDATE users SET faculty_id = NULL WHERE faculty_id = ANY($1::uuid[]);`, [testFacIds]);
      await client.query(`DELETE FROM faculties WHERE id = ANY($1::uuid[]);`, [testFacIds]);
      console.log("  ✓ Purged test faculties, departments, programmes, batches, and sections");
    }

    // 9. Clean orphaned test logs and attempts
    await client.query(`
      DELETE FROM audit_logs WHERE user_email ~ '^(admin_|coorda_|coordb_|coord_live_|coord_evt_|tutor_|student_|stud_evt_|s1_|adm_|rohan_[0-9]+|student1_)' OR user_email ~ '[0-9]{13}';
    `);
    await client.query(`
      DELETE FROM login_attempts WHERE identifier ~ '^(admin_|coorda_|coordb_|coord_live_|coord_evt_|tutor_|student_|stud_evt_|s1_|adm_|rohan_[0-9]+|student1_)' OR identifier ~ '[0-9]{13}';
    `);
    await client.query(`
      DELETE FROM pin_reset_requests WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '1 day';
    `);
    console.log("  ✓ Cleaned test audit logs and stale attempts");

    // 10. Ensure all legitimate SRM faculties are active
    await client.query(`
      UPDATE faculties SET is_active = true WHERE code IN ('CET', 'FSH', 'FMHS', 'FM', 'LAW', 'FAS', 'FLABS');
    `);
    console.log("  ✓ Activated all legitimate SRM faculties (CET, FSH, FMHS, FM, LAW, FAS, FLABS)");

    // 11. Ensure system settings exist and are active
    await client.query(`
      INSERT INTO system_settings (id, maintenance_mode)
      VALUES ('system', false)
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query("COMMIT;");
    console.log("\n✅ Database cleanup transaction committed successfully!\n");

    // Print summary of remaining data
    const remainingUsers = await client.query(`SELECT role, count(*) FROM users GROUP BY role ORDER BY count(*) DESC;`);
    console.log("Remaining legitimate users by role:");
    console.table(remainingUsers.rows);

    const remainingFaculties = await client.query(`SELECT count(*) FROM faculties;`);
    const remainingDepts = await client.query(`SELECT count(*) FROM departments;`);
    const remainingProgs = await client.query(`SELECT count(*) FROM programmes;`);
    const remainingSections = await client.query(`SELECT count(*) FROM sections;`);
    const remainingEvents = await client.query(`SELECT id, name, status FROM registration_events;`);

    console.log(`\nRemaining Academic Structure:`);
    console.log(`  Faculties: ${remainingFaculties.rows[0].count}`);
    console.log(`  Departments: ${remainingDepts.rows[0].count}`);
    console.log(`  Programmes: ${remainingProgs.rows[0].count}`);
    console.log(`  Sections: ${remainingSections.rows[0].count}`);
    console.log(`\nRemaining Registration Events:`);
    console.table(remainingEvents.rows);

  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ Cleanup failed, rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
