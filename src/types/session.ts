export type UserRole = "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  employeeId?: string;
  registerNumber?: string;
  facultyId?: string;
  departmentId?: string;
  programmeId?: string;
  academicBatchId?: string;
  sectionId?: string;
}

export interface PasswordUpgradeTicketPayload {
  userId: string;
  fingerprint: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
  requiresPasswordUpgrade?: boolean;
  upgradeTicket?: string;
}
