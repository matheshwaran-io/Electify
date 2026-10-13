import { db } from "../src/lib/db";
import { 
  users, 
  sections, 
  academicBatches, 
  programmes, 
  registrationEvents, 
  tutorSections, 
  eventSections, 
  electiveGroups, 
  electives, 
  studentRegistrations, 
  registrations,
  replayEvents
} from "../src/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

async function main() {
  console.log("🚀 Starting MCA GenAI data setup & fix for Dr. Angel B...");

  // 1. Find MCA GenAI Programme and Batch 2026
  const mcaProg = await db.query.programmes.findFirst({
    where: eq(programmes.id, "bd561ddf-225b-4f02-afb5-b728d30846e7")
  });
  if (!mcaProg) throw new Error("MCA GenAI programme not found!");
  console.log(`✓ Programme: ${mcaProg.name} (${mcaProg.id})`);

  const batch2026 = await db.query.academicBatches.findFirst({
    where: and(
      eq(academicBatches.programmeId, mcaProg.id),
      eq(academicBatches.year, "2026")
    )
  });
  if (!batch2026) throw new Error("MCA GenAI 2026 batch not found!");
  console.log(`✓ Batch: ${batch2026.year} (${batch2026.id})`);

  // 2. Find Sections A and B of MCA GenAI
  const mcaSections = await db.query.sections.findMany({
    where: eq(sections.academicBatchId, batch2026.id)
  });
  const secA = mcaSections.find(s => s.label === "A");
  const secB = mcaSections.find(s => s.label === "B");
  if (!secA || !secB) throw new Error("Section A or B not found for MCA GenAI!");
  console.log(`✓ Section A: ${secA.id}, Section B: ${secB.id}`);

  // 3. Update Angel B
  const angel = await db.query.users.findFirst({
    where: eq(users.email, "angelb1@srmist.edu.in")
  });
  if (!angel) throw new Error("Angel B not found!");

  await db.update(users)
    .set({
      name: "Angel B",
      programmeId: mcaProg.id,
      sectionId: secA.id,
      departmentId: mcaProg.departmentId,
      updatedAt: new Date()
    })
    .where(eq(users.id, angel.id));
  console.log("✓ Updated Angel B profile with default Section A of MCA GenAI");

  // 4. Update tutor_sections for Dr. Angel B
  await db.delete(tutorSections).where(eq(tutorSections.tutorId, angel.id));
  await db.insert(tutorSections).values([
    { tutorId: angel.id, sectionId: secA.id },
    { tutorId: angel.id, sectionId: secB.id },
  ]);
  console.log("✓ Re-assigned Dr. Angel B to Section A & Section B in tutor_sections");

  // 5. Update Registration Event for MCA GenAI
  const mcaEvent = await db.query.registrationEvents.findFirst({
    where: eq(registrationEvents.id, "8600c865-9655-41d5-bc3b-797cd5a733a9")
  });
  if (!mcaEvent) throw new Error("MCA GenAI registration event not found!");

  // Ensure event is PUBLISHED and closeDate is in the future
  const futureCloseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  const pastOpenDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);   // 7 days ago

  await db.update(registrationEvents)
    .set({
      status: "PUBLISHED",
      openDate: pastOpenDate,
      closeDate: futureCloseDate,
      updatedAt: new Date()
    })
    .where(eq(registrationEvents.id, mcaEvent.id));
  console.log(`✓ Updated MCA GenAI event window: Open=${pastOpenDate.toISOString()}, Close=${futureCloseDate.toISOString()}`);

  // 6. Update event_sections for this event to link Section A & Section B
  await db.delete(eventSections).where(eq(eventSections.eventId, mcaEvent.id));
  await db.insert(eventSections).values([
    { eventId: mcaEvent.id, sectionId: secA.id, academicBatchId: mcaEvent.academicBatchId },
    { eventId: mcaEvent.id, sectionId: secB.id, academicBatchId: mcaEvent.academicBatchId }
  ]);
  console.log("✓ Linked MCA GenAI Section A and Section B to registration event");

  // 7. Get Elective Groups & Electives for the event
  const groups = await db.query.electiveGroups.findMany({
    where: eq(electiveGroups.eventId, mcaEvent.id),
    orderBy: (eg, { asc }) => [asc(eg.sortOrder)]
  });
  if (groups.length < 2) throw new Error("Expected at least 2 elective groups for MCA GenAI!");

  const grp1 = groups[0]; // Professional Elective I (Core AI & Software)
  const grp2 = groups[1]; // Professional Elective II (Advanced Tech & GenAI)

  const grp1Electives = await db.query.electives.findMany({ where: eq(electives.groupId, grp1.id) });
  const grp2Electives = await db.query.electives.findMany({ where: eq(electives.groupId, grp2.id) });
  console.log(`✓ Found Group 1 (${grp1.name}) with ${grp1Electives.length} electives`);
  console.log(`✓ Found Group 2 (${grp2.name}) with ${grp2Electives.length} electives`);

  // 8. Create or update Students for Section A and Section B
  // Reusable password hash (same as existing student password)
  const studentPasswordHash = "$2b$12$6SXb5wNVJKjmSEuTTWx.fOdw6bjiRICFpJixoXdr3fx1o7NZmqkEK";

  const sectionAStudentsData = [
    { name: "Mathesh R", regNo: "RA2532241010001", email: "mathesh_r@srmist.edu.in" },
    { name: "Sneha Kumari", regNo: "RA2532241010002", email: "sneha_k@srmist.edu.in" },
    { name: "Aarav Sharma", regNo: "RA2532241010003", email: "aarav_s@srmist.edu.in" },
    { name: "Ananya Iyer", regNo: "RA2532241010006", email: "ananya_i@srmist.edu.in" },
    { name: "Vikram Aditya", regNo: "RA2532241010007", email: "vikram_a@srmist.edu.in" },
  ];

  const sectionBStudentsData = [
    { name: "Kavya Ramesh", regNo: "RA2532241010004", email: "kavya_r@srmist.edu.in" },
    { name: "Rahul Varma", regNo: "RA2532241010005", email: "rahul_v@srmist.edu.in" },
    { name: "Priya Nair", regNo: "RA2532241010008", email: "priya_n@srmist.edu.in" },
    { name: "Karthik R", regNo: "RA2532241010009", email: "karthik_r@srmist.edu.in" },
    { name: "Meera Krishnan", regNo: "RA2532241010010", email: "meera_k@srmist.edu.in" },
  ];

  const allInsertedStudents: Array<{ id: string; name: string; email: string; regNo: string; sectionId: string; sectionLabel: string }> = [];

  for (const s of sectionAStudentsData) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, s.email) });
    if (existing) {
      await db.update(users).set({
        name: s.name,
        registerNumber: s.regNo,
        programmeId: mcaProg.id,
        academicBatchId: batch2026.id,
        sectionId: secA.id,
        departmentId: mcaProg.departmentId,
        facultyId: angel.facultyId,
        isActive: true,
        isEligible: true,
        updatedAt: new Date()
      }).where(eq(users.id, existing.id));
      allInsertedStudents.push({ id: existing.id, name: s.name, email: s.email, regNo: s.regNo, sectionId: secA.id, sectionLabel: "A" });
    } else {
      const [newStud] = await db.insert(users).values({
        name: s.name,
        email: s.email,
        passwordHash: studentPasswordHash,
        role: "STUDENT",
        registerNumber: s.regNo,
        programmeId: mcaProg.id,
        academicBatchId: batch2026.id,
        sectionId: secA.id,
        departmentId: mcaProg.departmentId,
        facultyId: angel.facultyId,
        isActive: true,
        isEligible: true,
      }).returning();
      allInsertedStudents.push({ id: newStud.id, name: s.name, email: s.email, regNo: s.regNo, sectionId: secA.id, sectionLabel: "A" });
    }
  }

  for (const s of sectionBStudentsData) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, s.email) });
    if (existing) {
      await db.update(users).set({
        name: s.name,
        registerNumber: s.regNo,
        programmeId: mcaProg.id,
        academicBatchId: batch2026.id,
        sectionId: secB.id,
        departmentId: mcaProg.departmentId,
        facultyId: angel.facultyId,
        isActive: true,
        isEligible: true,
        updatedAt: new Date()
      }).where(eq(users.id, existing.id));
      allInsertedStudents.push({ id: existing.id, name: s.name, email: s.email, regNo: s.regNo, sectionId: secB.id, sectionLabel: "B" });
    } else {
      const [newStud] = await db.insert(users).values({
        name: s.name,
        email: s.email,
        passwordHash: studentPasswordHash,
        role: "STUDENT",
        registerNumber: s.regNo,
        programmeId: mcaProg.id,
        academicBatchId: batch2026.id,
        sectionId: secB.id,
        departmentId: mcaProg.departmentId,
        facultyId: angel.facultyId,
        isActive: true,
        isEligible: true,
      }).returning();
      allInsertedStudents.push({ id: newStud.id, name: s.name, email: s.email, regNo: s.regNo, sectionId: secB.id, sectionLabel: "B" });
    }
  }
  console.log(`✓ Configured 10 students across Section A and Section B`);

  // 9. Clean up previous registrations for this event to rebuild clean, accurate live data
  await db.delete(studentRegistrations).where(eq(studentRegistrations.eventId, mcaEvent.id));
  await db.delete(registrations).where(eq(registrations.eventId, mcaEvent.id));
  await db.delete(replayEvents).where(eq(replayEvents.registrationEventId, mcaEvent.id));

  // 10. Register students to simulate live elective registration for 2 classes
  // Students to register: 4 in Section A, 4 in Section B (leaving 1 pending in each section for realistic status)
  const studentsToRegister = allInsertedStudents.filter(s => s.name !== "Vikram Aditya" && s.name !== "Meera Krishnan");

  let receiptSeq = 1;
  const electiveSelectionPairs = [
    [0, 3], // NLP & GenAI Foundation + LLMs
    [1, 0], // Computer Vision + Big Data
    [2, 1], // AR/VR Systems + Cyber Forensics
    [0, 2], // NLP & GenAI Foundation + Blockchain
    [3, 3], // SQA + LLMs
    [1, 1], // Computer Vision + Cyber Forensics
    [2, 0], // AR/VR Systems + Big Data
    [0, 1], // NLP & GenAI Foundation + Cyber Forensics
  ];

  for (let i = 0; i < studentsToRegister.length; i++) {
    const student = studentsToRegister[i];
    const pair = electiveSelectionPairs[i % electiveSelectionPairs.length];
    
    const choice1 = grp1Electives[pair[0] % grp1Electives.length];
    const choice2 = grp2Electives[pair[1] % grp2Electives.length];

    const submissionTime = new Date(Date.now() - (8 - i) * 3600 * 1000); // spread over recent hours
    const receiptNum = `ELC-2026-ODD-${String(receiptSeq++).padStart(6, "0")}`;

    // Insert choices into studentRegistrations
    await db.insert(studentRegistrations).values([
      {
        studentId: student.id,
        eventId: mcaEvent.id,
        groupId: grp1.id,
        electiveId: choice1.id,
        isLocked: true,
        submittedAt: submissionTime,
        updatedAt: submissionTime
      },
      {
        studentId: student.id,
        eventId: mcaEvent.id,
        groupId: grp2.id,
        electiveId: choice2.id,
        isLocked: true,
        submittedAt: submissionTime,
        updatedAt: submissionTime
      }
    ]);

    // Insert receipt into registrations table
    const receiptSnapshot = {
      receiptNumber: receiptNum,
      submittedAt: submissionTime.toISOString(),
      student: {
        id: student.id,
        name: student.name,
        registerNumber: student.regNo,
        email: student.email,
        sectionLabel: student.sectionLabel,
        programmeName: mcaProg.name
      },
      electives: [
        {
          groupName: grp1.name,
          name: choice1.name,
          courseCode: choice1.courseCode,
          credits: choice1.credits
        },
        {
          groupName: grp2.name,
          name: choice2.name,
          courseCode: choice2.courseCode,
          credits: choice2.credits
        }
      ]
    };

    await db.insert(registrations).values({
      studentId: student.id,
      eventId: mcaEvent.id,
      status: "CONFIRMED",
      receiptNumber: receiptNum,
      receiptSnapshot: receiptSnapshot,
      submittedAt: submissionTime,
      createdAt: submissionTime,
      updatedAt: submissionTime
    });

    // Insert replay log events
    await db.insert(replayEvents).values([
      {
        registrationEventId: mcaEvent.id,
        studentId: student.id,
        studentName: student.name,
        eventType: "STUDENT_REGISTERED",
        subjectId: choice1.id,
        subjectName: `${choice1.courseCode ? choice1.courseCode + " - " : ""}${choice1.name}`,
        timestamp: submissionTime
      },
      {
        registrationEventId: mcaEvent.id,
        studentId: student.id,
        studentName: student.name,
        eventType: "STUDENT_REGISTERED",
        subjectId: choice2.id,
        subjectName: `${choice2.courseCode ? choice2.courseCode + " - " : ""}${choice2.name}`,
        timestamp: submissionTime
      }
    ]);
  }
  console.log(`✓ Created 8 confirmed registrations with studentRegistrations, receipts, and replay events`);

  // 11. Recalculate availableSeats for electives
  const allElectiveIds = [...grp1Electives.map(e => e.id), ...grp2Electives.map(e => e.id)];
  for (const elId of allElectiveIds) {
    const regCount = await db.select({ count: sql<number>`count(*)` })
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.eventId, mcaEvent.id), eq(studentRegistrations.electiveId, elId)));
    const booked = Number(regCount[0]?.count || 0);
    const [elec] = await db.select().from(electives).where(eq(electives.id, elId));
    if (elec) {
      const newAvail = Math.max(0, elec.maxSeats - booked);
      await db.update(electives)
        .set({
          availableSeats: newAvail,
          isFull: newAvail === 0,
          updatedAt: new Date()
        })
        .where(eq(electives.id, elId));
    }
  }
  console.log("✓ Updated seat availability for all MCA GenAI electives");

  console.log("\n🎉 SUCCESS: Database setup complete for 2 classes of MCA GenAI under Dr. Angel B!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error running script:", err);
  process.exit(1);
});
