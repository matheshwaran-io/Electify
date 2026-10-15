/**
 * Real-time active student presence tracking for Electify.
 *
 * Tracks students active on:
 * - /countdown: stage = "COUNTDOWN" (Before event)
 * - /dashboard/electives or /dashboard: stage = "IN_SELECTION" (During event)
 * - /dashboard/my-registration: stage = "SUBMITTED" (Confirmed)
 *
 * Entries expire automatically after 30 seconds of no heartbeat.
 */

export type StudentPresenceStage = "COUNTDOWN" | "IN_SELECTION" | "SUBMITTED";

export interface ActiveStudentEntry {
  studentId: string;
  name: string;
  registerNumber: string;
  sectionId: string;
  sectionName: string;
  eventId: string;
  stage: StudentPresenceStage;
  lastSeenAt: number;
}

// Global presence store (persists across hot-reloads and requests within the Node.js process)
declare global {
  // eslint-disable-next-line no-var
  var __electify_student_presence: Map<string, ActiveStudentEntry> | undefined;
}

if (!globalThis.__electify_student_presence) {
  globalThis.__electify_student_presence = new Map();
}

const presenceStore = globalThis.__electify_student_presence;

const HEARTBEAT_TTL_MS = 30_000; // 30 seconds expiration

/**
 * Record or refresh a student's active presence.
 */
export function recordStudentPresence(entry: {
  studentId: string;
  name: string;
  registerNumber: string;
  sectionId?: string | null;
  sectionName?: string | null;
  eventId: string;
  stage: StudentPresenceStage;
}): void {
  const key = `${entry.eventId}:${entry.studentId}`;
  presenceStore.set(key, {
    studentId: entry.studentId,
    name: entry.name,
    registerNumber: entry.registerNumber,
    sectionId: entry.sectionId || "",
    sectionName: entry.sectionName || "Section",
    eventId: entry.eventId,
    stage: entry.stage,
    lastSeenAt: Date.now(),
  });
}

/**
 * Explicitly remove student presence (e.g. on logout or disconnect).
 */
export function removeStudentPresence(studentId: string, eventId?: string): void {
  if (eventId) {
    presenceStore.delete(`${eventId}:${studentId}`);
  } else {
    for (const [key, val] of presenceStore.entries()) {
      if (val.studentId === studentId) {
        presenceStore.delete(key);
      }
    }
  }
}

/**
 * Clear all student presence or presence for a given event.
 */
export function clearStudentPresence(eventId?: string): void {
  if (eventId) {
    for (const [key, val] of presenceStore.entries()) {
      if (val.eventId === eventId) {
        presenceStore.delete(key);
      }
    }
  } else {
    presenceStore.clear();
  }
}

/**
 * Get active students for an event, purging expired entries.
 */
export function getActiveStudentsForEvent(eventId: string): {
  activeCount: number;
  countdownCount: number;
  inSelectionCount: number;
  submittedCount: number;
  students: {
    studentId: string;
    name: string;
    registerNumber: string;
    sectionName: string;
    stage: StudentPresenceStage;
    lastSeenSecondsAgo: number;
  }[];
} {
  const now = Date.now();
  const activeStudents: {
    studentId: string;
    name: string;
    registerNumber: string;
    sectionName: string;
    stage: StudentPresenceStage;
    lastSeenSecondsAgo: number;
  }[] = [];

  let countdownCount = 0;
  let inSelectionCount = 0;
  let submittedCount = 0;

  for (const [key, entry] of presenceStore.entries()) {
    // Purge expired heartbeats
    if (now - entry.lastSeenAt > HEARTBEAT_TTL_MS) {
      presenceStore.delete(key);
      continue;
    }

    if (entry.eventId === eventId) {
      if (entry.stage === "COUNTDOWN") countdownCount++;
      else if (entry.stage === "IN_SELECTION") inSelectionCount++;
      else if (entry.stage === "SUBMITTED") submittedCount++;

      activeStudents.push({
        studentId: entry.studentId,
        name: entry.name,
        registerNumber: entry.registerNumber,
        sectionName: entry.sectionName,
        stage: entry.stage,
        lastSeenSecondsAgo: Math.max(0, Math.round((now - entry.lastSeenAt) / 1000)),
      });
    }
  }

  // Sort by most recently active first
  activeStudents.sort((a, b) => a.lastSeenSecondsAgo - b.lastSeenSecondsAgo);

  return {
    activeCount: activeStudents.length,
    countdownCount,
    inSelectionCount,
    submittedCount,
    students: activeStudents,
  };
}
