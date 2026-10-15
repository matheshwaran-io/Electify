export type RegisterErrorCode =
  | "UNAUTHORIZED"
  | "MAINTENANCE"
  | "INELIGIBLE"
  | "NOT_FOUND"
  | "WRONG_EVENT"
  | "WINDOW_CLOSED"
  | "INVALID_SELECTION"
  | "SEAT_TAKEN"
  | "ALREADY_REGISTERED"
  | "SERVER_ERROR";

export interface RegisterResult {
  success: boolean;
  error?: string;
  /** Machine-readable reason code so the UI never has to parse error strings. */
  code?: RegisterErrorCode;
  /** For SEAT_TAKEN: the elective that ran out of seats. */
  electiveId?: string;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  message?: string;
}

export type SeatState = "available" | "low" | "full";

export interface StudentSeatAvailability {
  /** Seats this student could take right now; never negative. */
  available: number;
  /** Size of the pool that applies to this student (their class quota when one is set). */
  max: number;
  state: SeatState;
  /** True when a class/section quota limits this student. */
  sectionLimited: boolean;
}

export interface RegistrationReceiptSnapshot {
  receiptNumber: string;
  timestamp: string;
  student: {
    id: string;
    name: string;
    registerNumber: string;
    section: string;
    department: string;
    programme: string;
  };
  event: {
    id: string;
    name: string;
    academicYear: string | null;
    term: string;
  };
  electives: Array<{
    id: string;
    courseCode: string | null;
    name: string;
    groupName: string;
  }>;
}
