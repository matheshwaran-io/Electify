export type InviteRole = "CLASS_TUTOR" | "COURSE_COORDINATOR" | "SYSTEM_ADMIN" | "STUDENT";

export const ROLE_CONFIGS: Record<InviteRole, { label: string; prefix: string; description: string }> = {
  CLASS_TUTOR: {
    label: "Faculty",
    prefix: "FAC",
    description: "Class control, section roster & reports",
  },
  COURSE_COORDINATOR: {
    label: "Course Coordinator",
    prefix: "COORD",
    description: "Programme electives, courses & allocations",
  },
  SYSTEM_ADMIN: {
    label: "Admin",
    prefix: "ADM",
    description: "Full system administration & governance",
  },
  STUDENT: {
    label: "Student",
    prefix: "STU",
    description: "Elective choices & student portal",
  },
};

/**
 * Generates an unambiguous, role-specific invite code.
 * Format: [PREFIX]-[YEAR]-[RANDOM_4_CHARS]
 * Examples:
 * - Faculty: FAC-2026-8K4D
 * - Course Coordinator: COORD-2026-9P2M
 * - Admin: ADM-2026-3X7J
 */
export function generateRoleBasedCode(role: string): string {
  const year = new Date().getFullYear();
  let prefix = "FAC";
  if (role === "SYSTEM_ADMIN") prefix = "ADM";
  else if (role === "COURSE_COORDINATOR") prefix = "COORD";
  else if (role === "CLASS_TUTOR") prefix = "FAC";
  else if (role === "STUDENT") prefix = "STU";

  // Exclude easily confused characters (0, O, 1, I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${year}-${randomPart}`;
}

/**
 * Generates an illustrative, secure Class Signup Code for student cohort onboarding.
 * Format: EF-[PROG_CODE]-[SECTION_LABEL]-[RANDOM_4_CHARS]
 * Example: EF-MCA-F-7X9K
 */
export function generateClassSignupCode(programmeCode?: string | null, sectionLabel?: string | null): string {
  const cleanProg = (programmeCode || "CLASS").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "CLASS";
  const cleanSec = (sectionLabel || "A").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "A";
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Unambiguous characters
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `EF-${cleanProg}-${cleanSec}-${randomPart}`;
}
