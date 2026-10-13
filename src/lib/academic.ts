/**
 * Labels for the three academic concepts Electify keeps apart:
 *
 *   Academic session   the year the institution is operating, e.g. "2026–2027".
 *   Admission cohort   programme + admission year (+ class/section), e.g.
 *                      "MCA F · 2025–2027". It never changes with the session.
 *   Study stage        where a cohort is within its programme in a given
 *                      session, e.g. "Year 2 · Semester 3".
 *
 * Pure functions only, safe for server and client components.
 */

export type SessionStatus = "PLANNED" | "ACTIVE" | "ARCHIVED";

export function sessionLabel(s: { startYear: number; endYear: number }) {
  return `${s.startYear}–${s.endYear}`;
}

export function yearServerLabel(s: { startYear: number }) {
  return `${s.startYear} Year Server`;
}

/** "2025–2027", or "2025 intake" while the expected end year is unknown. */
export function cohortYears(c: { admissionYear: number | null; expectedEndYear: number | null; legacyYear?: string | null }) {
  const start = c.admissionYear ?? parseYear(c.legacyYear);
  if (start == null) return c.legacyYear?.trim() || "Admission year not set";
  return c.expectedEndYear ? `${start}–${c.expectedEndYear}` : `${start} intake`;
}

/** Short programme name for compact labels: the name when it is short, otherwise the code. */
export function programmeShortName(p: { name: string; code?: string | null }) {
  const name = p.name.trim();
  if (name.length <= 16) return name;
  const code = p.code?.trim();
  return code && code.length <= 12 ? code : name;
}

/** Full class identity, e.g. "MCA F · 2025–2027". Use wherever two classes could share a label. */
export function cohortLabel(c: {
  programmeName: string;
  programmeCode?: string | null;
  sectionLabel: string;
  admissionYear: number | null;
  expectedEndYear: number | null;
  legacyYear?: string | null;
}) {
  return `${programmeShortName({ name: c.programmeName, code: c.programmeCode })} ${c.sectionLabel} · ${cohortYears(c)}`;
}

export function stageLabel(t: { studyYear: number | null; semester: number | null }) {
  const parts = [t.studyYear ? `Year ${t.studyYear}` : null, t.semester ? `Semester ${t.semester}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Study year not set";
}

/** Parses "2026-2027", "2026–2027" or "2026/2027" into consecutive years. */
export function parseSessionText(text: string | null | undefined): { startYear: number; endYear: number } | null {
  const m = (text ?? "").trim().match(/^(\d{4})\s*[-–/]\s*(\d{4})$/);
  if (!m) return null;
  const startYear = Number(m[1]);
  const endYear = Number(m[2]);
  return endYear === startYear + 1 ? { startYear, endYear } : null;
}

function parseYear(text: string | null | undefined) {
  const t = text?.trim();
  return t && /^\d{4}$/.test(t) ? Number(t) : null;
}

/**
 * Suggested study year for a cohort in a session, from its admission year.
 * Only a suggestion: the official calendar (repeat years, breaks) decides,
 * which is why terms are stored and confirmed rather than computed.
 */
export function suggestedStudyYear(admissionYear: number | null, session: { startYear: number }, durationYears?: number | null) {
  if (admissionYear == null) return null;
  const year = session.startYear - admissionYear + 1;
  if (year < 1) return null;
  if (durationYears && year > durationYears) return null;
  return year;
}
