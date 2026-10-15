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
  console.log("🚀 Seeding full MCA GenAI cohorts (2 classes: Section A & Section B)...");

  // 1. Programme & Batch
  const mcaProg = await db.query.programmes.findFirst({
    where: eq(programmes.id, "bd561ddf-225b-4f02-afb5-b728d30846e7")
  });
  if (!mcaProg) throw new Error("MCA GenAI programme not found!");

  const batch2026 = await db.query.academicBatches.findFirst({
    where: and(
      eq(academicBatches.programmeId, mcaProg.id),
      eq(academicBatches.year, "2026")
    )
  });
  if (!batch2026) throw new Error("MCA GenAI 2026 batch not found!");

  // 2. Sections
  const mcaSections = await db.query.sections.findMany({
    where: eq(sections.academicBatchId, batch2026.id)
  });
  const secA = mcaSections.find(s => s.label === "A");
  const secB = mcaSections.find(s => s.label === "B");
  if (!secA || !secB) throw new Error("Section A or B not found!");

  // 3. Angel B
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

  await db.delete(tutorSections).where(eq(tutorSections.tutorId, angel.id));
  await db.insert(tutorSections).values([
    { tutorId: angel.id, sectionId: secA.id },
    { tutorId: angel.id, sectionId: secB.id },
  ]);

  // 4. Registration Event & Elective Groups
  const mcaEvent = await db.query.registrationEvents.findFirst({
    where: eq(registrationEvents.id, "8600c865-9655-41d5-bc3b-797cd5a733a9")
  });
  if (!mcaEvent) throw new Error("MCA GenAI registration event not found!");

  const futureCloseDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pastOpenDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  await db.update(registrationEvents)
    .set({
      status: "PUBLISHED",
      openDate: pastOpenDate,
      closeDate: futureCloseDate,
      updatedAt: new Date()
    })
    .where(eq(registrationEvents.id, mcaEvent.id));

  await db.delete(eventSections).where(eq(eventSections.eventId, mcaEvent.id));
  await db.insert(eventSections).values([
    { eventId: mcaEvent.id, sectionId: secA.id, academicBatchId: mcaEvent.academicBatchId },
    { eventId: mcaEvent.id, sectionId: secB.id, academicBatchId: mcaEvent.academicBatchId }
  ]);

  const groups = await db.query.electiveGroups.findMany({
    where: eq(electiveGroups.eventId, mcaEvent.id),
    orderBy: (eg, { asc }) => [asc(eg.sortOrder)]
  });
  const grp1 = groups[0];
  const grp2 = groups[1];

  // Increase maxSeats to 50 for all electives so 70 students fit comfortably
  await db.update(electives)
    .set({ maxSeats: 50, availableSeats: 50, isFull: false, updatedAt: new Date() })
    .where(inArray(electives.groupId, [grp1.id, grp2.id]));

  const grp1Electives = await db.query.electives.findMany({ where: eq(electives.groupId, grp1.id) });
  const grp2Electives = await db.query.electives.findMany({ where: eq(electives.groupId, grp2.id) });

  // 5. Build full roster: 35 students in Section A, 35 students in Section B
  const studentPasswordHash = "$2b$12$6SXb5wNVJKjmSEuTTWx.fOdw6bjiRICFpJixoXdr3fx1o7NZmqkEK";

  const sectionANames = [
    "Mathesh R", "Sneha Kumari", "Aarav Sharma", "Ananya Iyer", "Vikram Aditya",
    "Harish Kumar", "Divya Soundar", "Ashwin Venkatesh", "Pooja Sundaram", "Naveen Prasath",
    "Keerthana R", "Sanjay Subramanian", "Rithika Mohan", "Gokul Nath", "Abinaya Devi",
    "Karthikeyan M", "Deepika Ramesh", "Vigneshwaran S", "Shreya Gupta", "Balaji Krishnan",
    "Preethi Murali", "Siddharth Nair", "Monisha B", "Manoj Prabhakar", "Pavithra S",
    "Arvind Swaminathan", "Swetha Narayanan", "Dinesh Karthik", "Shalini Priya", "Praveen Raj",
    "Kaviya Varshini", "Suresh Babu", "Tharun Kumar", "Lavanya C", "Ajay Dev"
  ];

  const sectionBNames = [
    "Kavya Ramesh", "Rahul Varma", "Priya Nair", "Karthik R", "Meera Krishnan",
    "Rohan Joshi", "Sandhya Rani", "Varun Chakravarthy", "Archana Mohan", "Madhavan G",
    "Nandhini Devi", "Surya Prakash", "Gayathri Sankaran", "Deepak Ravichandran", "Yamini R",
    "Akash Sridhar", "Bhavana K", "Saravanan K", "Nithya Shree", "Vinoth Kumar",
    "Ishwarya Laxmi", "Rajesh Kannan", "Sowmya Narayanan", "Nitin Gadde", "Tejaswini M",
    "Manikandan P", "Jayashree V", "Kishore Kumar", "Hemalatha S", "Pradeep Raj",
    "Charulatha N", "Vignesh Babu", "Harini Vasudevan", "Senthil Nathan", "Nivetha M"
  ];

  // Clean old event registrations and students first
  await db.delete(studentRegistrations).where(eq(studentRegistrations.eventId, mcaEvent.id));
  await db.delete(registrations).where(eq(registrations.eventId, mcaEvent.id));
  await db.delete(replayEvents).where(eq(replayEvents.registrationEventId, mcaEvent.id));
  await db.delete(users).where(and(eq(users.programmeId, mcaProg.id), eq(users.role, "STUDENT")));

  // Process Section A Students
  const sectionAStudents: Array<{ id: string; name: string; email: string; regNo: string; sectionId: string; sectionLabel: string }> = [];
  for (let i = 0; i < sectionANames.length; i++) {
    const name = sectionANames[i];
    const regNo = `RA253224101${String(i + 1).padStart(4, "0")}`;
    const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}@srmist.edu.in`;

    const [newStud] = await db.insert(users).values({
      name,
      email,
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      registerNumber: regNo,
      programmeId: mcaProg.id,
      academicBatchId: batch2026.id,
      sectionId: secA.id,
      departmentId: mcaProg.departmentId,
      facultyId: angel.facultyId,
      isActive: true,
      isEligible: true,
    }).returning();
    sectionAStudents.push({ id: newStud.id, name, email, regNo, sectionId: secA.id, sectionLabel: "A" });
  }

  // Process Section B Students
  const sectionBStudents: Array<{ id: string; name: string; email: string; regNo: string; sectionId: string; sectionLabel: string }> = [];
  for (let i = 0; i < sectionBNames.length; i++) {
    const name = sectionBNames[i];
    const regNo = `RA253224101${String(36 + i).padStart(4, "0")}`;
    const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}@srmist.edu.in`;

    const [newStud] = await db.insert(users).values({
      name,
      email,
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      registerNumber: regNo,
      programmeId: mcaProg.id,
      academicBatchId: batch2026.id,
      sectionId: secB.id,
      departmentId: mcaProg.departmentId,
      facultyId: angel.facultyId,
      isActive: true,
      isEligible: true,
    }).returning();
    sectionBStudents.push({ id: newStud.id, name, email, regNo, sectionId: secB.id, sectionLabel: "B" });
  }

  console.log(`✓ Section A Students: ${sectionAStudents.length}, Section B Students: ${sectionBStudents.length}`);

  // 6. Register students:
  // Section A: 33 registered (2 pending: Lavanya C, Ajay Dev)
  // Section B: 32 registered (3 pending: Harini Vasudevan, Senthil Nathan, Nivetha M)
  const confirmedSectionA = sectionAStudents.slice(0, 33);
  const confirmedSectionB = sectionBStudents.slice(0, 32);
  const allConfirmed = [...confirmedSectionA, ...confirmedSectionB];

  let receiptSeq = 1;
  const nowMs = Date.now();

  for (let idx = 0; idx < allConfirmed.length; idx++) {
    const student = allConfirmed[idx];
    
    // Distribute elective choices evenly across groups
    const choice1 = grp1Electives[idx % grp1Electives.length];
    const choice2 = grp2Electives[(idx * 3) % grp2Electives.length];

    // Spread submissions across the last few days / hours
    const submissionTime = new Date(nowMs - ((allConfirmed.length - idx) * 28 * 60 * 1000));
    const receiptNum = `ELC-2026-ODD-${String(receiptSeq++).padStart(6, "0")}`;

    // Insert studentRegistrations
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

    // Insert registrations (confirmed receipt)
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

    // Insert replayEvents
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

  console.log(`✓ Confirmed Registrations Created: ${allConfirmed.length} (33 in Sec A, 32 in Sec B)`);

  // 7. Update availableSeats for each elective
  const allElectives = [...grp1Electives, ...grp2Electives];
  for (const el of allElectives) {
    const regCount = await db.select({ count: sql<number>`count(*)` })
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.eventId, mcaEvent.id), eq(studentRegistrations.electiveId, el.id)));
    const booked = Number(regCount[0]?.count || 0);
    const newAvail = Math.max(0, 50 - booked);
    await db.update(electives)
      .set({
        maxSeats: 50,
        availableSeats: newAvail,
        isFull: newAvail === 0,
        updatedAt: new Date()
      })
      .where(eq(electives.id, el.id));
  }
  console.log("✓ Updated seat availability for all electives");

  console.log("\n🎉 Finished seeding full cohorts for 2 classes of MCA GenAI under Dr. Angel B!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error running script:", err);
  process.exit(1);
});
