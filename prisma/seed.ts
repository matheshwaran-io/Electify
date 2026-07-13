import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

// Load configuration for local seed command run
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cleaning up existing database tables...");
  await prisma.loginAttempt.deleteMany().catch(() => {});
  await prisma.registration.deleteMany().catch(() => {});
  await prisma.student.deleteMany().catch(() => {});
  await prisma.elective.deleteMany().catch(() => {});
  await prisma.faculty.deleteMany().catch(() => {});
  await prisma.settings.deleteMany().catch(() => {});
  await prisma.inviteCode.deleteMany().catch(() => {});
  await prisma.auditLog.deleteMany().catch(() => {});

  console.log("Seeding system settings...");
  // Registration window starts tomorrow and ends day after tomorrow by default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(17, 0, 0, 0);

  await prisma.settings.create({
    data: {
      id: "system",
      registrationEnabled: false,
      maintenanceMode: false,
      showLiveSeats: true,
      allowFacultyEditing: true,
      allowRegistrationEdit: false,
      registrationStart: tomorrow,
      registrationEnd: dayAfter,
    },
  });

  console.log("Seeding faculty accounts...");
  const adminPasswordHash = await bcrypt.hash("Admin@12345", 10);
  const facultyPasswordHash = await bcrypt.hash("Faculty@12345", 10);

  await prisma.faculty.createMany({
    data: [
      {
        employeeId: "EMP-ADMIN",
        name: "System Administrator",
        email: "admin@electify.edu",
        passwordHash: adminPasswordHash,
        role: "SUPER_ADMIN",
      },
      {
        employeeId: "EMP-CC-01",
        name: "MCA Course Coordinator",
        email: "coordinator@electify.edu",
        passwordHash: facultyPasswordHash,
        role: "COURSE_COORDINATOR",
        faculty: "Faculty of Science & Humanities",
        department: "Computer Applications",
        degree: "MCA",
      },
      {
        employeeId: "EMP-TU-01",
        name: "MCA Class Tutor A",
        email: "tutor_a@electify.edu",
        passwordHash: facultyPasswordHash,
        role: "CLASS_TUTOR",
        faculty: "Faculty of Science & Humanities",
        department: "Computer Applications",
        degree: "MCA",
        className: "A",
      },
    ],
  });

  console.log("Seeding test invite codes...");
  const inviteExpiry = new Date();
  inviteExpiry.setDate(inviteExpiry.getDate() + 7); // Expiration in 7 days

  await prisma.inviteCode.createMany({
    data: [
      {
        code: "ELC-CC-MCA-7A9KD2",
        role: "COURSE_COORDINATOR",
        faculty: "Faculty of Science & Humanities",
        department: "Computer Applications",
        degree: "MCA",
        createdBy: "EMP-ADMIN",
        expiresAt: inviteExpiry,
        maxUses: 1,
        usedCount: 0,
        status: "ACTIVE",
      },
      {
        code: "ELC-TU-MCAF-Q8XPL4",
        role: "CLASS_TUTOR",
        faculty: "Faculty of Science & Humanities",
        department: "Computer Applications",
        degree: "MCA",
        section: null,
        createdBy: "EMP-CC-01",
        expiresAt: inviteExpiry,
        maxUses: 1,
        usedCount: 0,
        status: "ACTIVE",
      },
    ],
  });

  console.log("Seeding electives...");
  // Group 1
  await prisma.elective.createMany({
    data: [
      {
        groupNumber: 1,
        name: "Software Quality Assurance (SQA)",
        totalSeats: 34,
        availableSeats: 34,
        isActive: true,
      },
      {
        groupNumber: 1,
        name: "Augmented Reality / Virtual Reality (AR/VR)",
        totalSeats: 10,
        availableSeats: 10,
        isActive: true,
      },
      {
        groupNumber: 1,
        name: "Computer Vision (CV)",
        totalSeats: 14,
        availableSeats: 14,
        isActive: true,
      },
    ],
  });

  // Group 2
  await prisma.elective.createMany({
    data: [
      {
        groupNumber: 2,
        name: "Big Data Analytics (BDA)",
        totalSeats: 18,
        availableSeats: 18,
        isActive: true,
      },
      {
        groupNumber: 2,
        name: "Cyber Forensics (CF)",
        totalSeats: 26,
        availableSeats: 26,
        isActive: true,
      },
      {
        groupNumber: 2,
        name: "Blockchain Technology (BCT)",
        totalSeats: 14,
        availableSeats: 14,
        isActive: true,
      },
    ],
  });

  console.log("Seeding initial students...");
  const student1Pass = await bcrypt.hash("RA2532241010001", 10);
  const student2Pass = await bcrypt.hash("RA2532241010002", 10);
  const student3Pass = await bcrypt.hash("RA2532241010003", 10);

  await prisma.student.createMany({
    data: [
      {
        name: "Mathesh R",
        registerNumber: "RA2532241010001",
        email: "mathesh_r@srmist.edu.in",
        passwordHash: student1Pass,
        isActive: true,
        isEligible: true,
        hasSubmitted: false,
      },
      {
        name: "Sneha Kumari",
        registerNumber: "RA2532241010002",
        email: "sneha_k@srmist.edu.in",
        passwordHash: student2Pass,
        isActive: true,
        isEligible: true,
        hasSubmitted: false,
      },
      {
        name: "Aarav Sharma",
        registerNumber: "RA2532241010003",
        email: "aarav_s@srmist.edu.in",
        passwordHash: student3Pass,
        isActive: true,
        isEligible: false, // For testing eligibility checks
        hasSubmitted: false,
      },
    ],
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error while seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
