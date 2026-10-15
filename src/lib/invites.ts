export type InviteRole = "CLASS_TUTOR" | "COURSE_COORDINATOR" | "SYSTEM_ADMIN" | "STUDENT";

export const ROLE_CONFIGS: Record<InviteRole, { label: string; prefix: string; description: string }> = {
  CLASS_TUTOR: {
    label: "Class Tutor",
    prefix: "EFCT",
    description: "Class control, section roster & reports",
  },
  COURSE_COORDINATOR: {
    label: "Course Coordinator",
    prefix: "EFCC",
    description: "Programme electives, courses & allocations",
  },
  SYSTEM_ADMIN: {
    label: "System Admin",
    prefix: "EFSA",
    description: "Full system administration & governance",
  },
  STUDENT: {
    label: "Student",
    prefix: "EFST",
    description: "Elective choices & student portal",
  },
};

/**
 * Generates an unambiguous, role-specific invite code.
 * Format: [PREFIX][YEAR]-[RANDOM_5_OR_6_CHARS]
 * Examples:
 * - System Admin: EFSA2026-56TGE
 * - Course Coordinator: EFCC2026-J45RE
 * - Class Tutor: EFCT2026-RD365F
 */
export function generateRoleBasedCode(role: string): string {
  const year = new Date().getFullYear();
  let prefix = "EFCT";
  let len = 6;
  if (role === "SYSTEM_ADMIN") {
    prefix = "EFSA";
    len = 5;
  } else if (role === "COURSE_COORDINATOR") {
    prefix = "EFCC";
    len = 5;
  } else if (role === "CLASS_TUTOR") {
    prefix = "EFCT";
    len = 6;
  } else if (role === "STUDENT") {
    prefix = "EFST";
    len = 5;
  }

  // Exclude easily confused characters (0, O, 1, I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < len; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${year}-${randomPart}`;
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
