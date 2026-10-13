import { db } from "../src/lib/db";
import {
  users,
  sections,
  academicBatches,
  programmes,
  academicSessions,
  cohortSessionTerms,
  tutorSections,
} from "../src/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

async function main() {
  console.log("Setting up multi-year, multi-programme tutor data for Dr. Angel Rubavathi...");

  // 1. Find Angel Rubavathi
  const [angel] = await db
    .select()
    .from(users)
    .where(eq(users.email, "angelb1@srmist.edu.in"))
    .limit(1);
  if (!angel) throw new Error("Angel Rubavathi not found!");
  console.log(`✓ Found user: ${angel.name} (${angel.id})`);

  // 2. Find Academic Sessions 2025 and 2026
  const [session2025] = await db
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.startYear, 2025))
    .limit(1);
  const [session2026] = await db
    .select()
    .from(academicSessions)
    .where(eq(academicSessions.startYear, 2026))
    .limit(1);

  if (!session2025 || !session2026) {
    throw new Error("Expected academic sessions 2025 and 2026 to exist!");
  }
  console.log(`✓ Session 2025: ${session2025.id}, Session 2026: ${session2026.id}`);

  // 3. Programmes
  const [mcaProg] = await db
    .select()
    .from(programmes)
    .where(eq(programmes.name, "MCA GenAI"))
    .limit(1);
  const [mscProg] = await db
    .select()
    .from(programmes)
    .where(eq(programmes.name, "M.Sc Computer Science"))
    .limit(1);

  if (!mcaProg || !mscProg) {
    throw new Error("Programmes not found!");
  }
  console.log(`✓ MCA Prog: ${mcaProg.name} (${mcaProg.id})`);
  console.log(`✓ MSc Prog: ${mscProg.name} (${mscProg.id})`);

  // 4. Class 1: MCA GenAI Section F of 2026 batch (Session 2026)
  const [batch2026Mca] = await db
    .select()
    .from(academicBatches)
    .where(and(eq(academicBatches.programmeId, mcaProg.id), eq(academicBatches.year, "2026")))
    .limit(1);
  if (!batch2026Mca) throw new Error("Batch 2026 MCA GenAI not found");

  let [sec2026McaF] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.academicBatchId, batch2026Mca.id), eq(sections.label, "F")))
    .limit(1);
  if (!sec2026McaF) {
    const [created] = await db.insert(sections).values({ label: "F", academicBatchId: batch2026Mca.id }).returning();
    sec2026McaF = created;
  }
  console.log(`✓ Class 1: MCA GenAI F (2026 batch): ${sec2026McaF.id}`);

  // 5. Class 2: M.Sc Computer Science Section A of 2026 batch (Session 2026)
  const [batch2026Msc] = await db
    .select()
    .from(academicBatches)
    .where(and(eq(academicBatches.programmeId, mscProg.id), eq(academicBatches.year, "2026")))
    .limit(1);
  if (!batch2026Msc) throw new Error("Batch 2026 M.Sc Computer Science not found");

  let [sec2026MscA] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.academicBatchId, batch2026Msc.id), eq(sections.label, "A")))
    .limit(1);
  if (!sec2026MscA) {
    const [created] = await db.insert(sections).values({ label: "A", academicBatchId: batch2026Msc.id }).returning();
    sec2026MscA = created;
  }
  console.log(`✓ Class 2: M.Sc Computer Science A (2026 batch): ${sec2026MscA.id}`);

  // 6. Class 3: MCA GenAI Section F of 2025 batch (Session 2025 & Session 2026)
  let [batch2025Mca] = await db
    .select()
    .from(academicBatches)
    .where(and(eq(academicBatches.programmeId, mcaProg.id), eq(academicBatches.year, "2025")))
    .limit(1);

  if (!batch2025Mca) {
    const [createdBatch] = await db
      .insert(academicBatches)
      .values({
        year: "2025",
        admissionYear: 2025,
        expectedEndYear: 2027,
        datesConfirmed: true,
        programmeId: mcaProg.id,
      })
      .returning();
    batch2025Mca = createdBatch;
    console.log(`✓ Created Batch 2025 for MCA GenAI (${batch2025Mca.id})`);
  }

  // Link batch2025 to 2025 session (Year 1) and 2026 session (Year 2)
  await db
    .insert(cohortSessionTerms)
    .values([
      {
        academicBatchId: batch2025Mca.id,
        academicSessionId: session2025.id,
        studyYear: 1,
        currentSemester: 1,
        confirmed: true,
      },
      {
        academicBatchId: batch2025Mca.id,
        academicSessionId: session2026.id,
        studyYear: 2,
        currentSemester: 3,
        confirmed: true,
      },
    ])
    .onConflictDoNothing();
  console.log(`✓ Linked Batch 2025 to 2025 Year Server (Year 1) & 2026 Year Server (Year 2)`);

  let [sec2025McaF] = await db
    .select()
    .from(sections)
    .where(and(eq(sections.academicBatchId, batch2025Mca.id), eq(sections.label, "F")))
    .limit(1);

  if (!sec2025McaF) {
    const [createdSec] = await db
      .insert(sections)
      .values({
        label: "F",
        academicBatchId: batch2025Mca.id,
      })
      .returning();
    sec2025McaF = createdSec;
    console.log(`✓ Created Section F for Batch 2025 (${sec2025McaF.id})`);
  }

  // 7. Map Angel to all 3 sections in tutor_sections
  const sectionIds = [sec2026McaF.id, sec2026MscA.id, sec2025McaF.id];
  await db.delete(tutorSections).where(eq(tutorSections.tutorId, angel.id));
  await db.insert(tutorSections).values(
    sectionIds.map((secId) => ({ tutorId: angel.id, sectionId: secId }))
  );
  console.log(`✓ Mapped Dr. Angel to all 3 sections in tutor_sections!`);

  console.log("\n Setup Complete! Dr. Angel Rubavathi is now tutor for:");
  console.log("  1. MCA GenAI F · 2026 (active in 2026 Year Server)");
  console.log("  2. M.Sc Computer Science A · 2026 (active in 2026 Year Server)");
  console.log("  3. MCA GenAI F · 2025 (active in 2025 Year Server as Yr 1, and 2026 Year Server as Yr 2)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
