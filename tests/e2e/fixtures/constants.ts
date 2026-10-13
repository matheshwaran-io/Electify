/**
 * Synthetic end-to-end fixtures. Every person, register number and e-mail here
 * is invented; e-mails use the reserved example.test domain. These values only
 * ever exist in the throwaway local database `electify_e2e`.
 */

export const E2E_DB_NAME = "electify_e2e";
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? `postgresql://localhost:5432/${E2E_DB_NAME}`;
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3210);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Test-only password shared by the synthetic accounts (local test database only). */
export const E2E_PASSWORD = "E2e-Test-Pass-2026";

export const STAFF = {
  admin: { email: "e2e.admin@example.test", name: "E2E Administrator" },
  coordinator: { email: "e2e.coordinator@example.test", name: "E2E Coordinator" },
  /** Tutor of MCA F 2025–2027, MCA F 2026–2028 and MSc IT F 2026–2028. */
  tutor: { email: "e2e.tutor@example.test", name: "E2E Tutor Multi" },
  /** Tutor of MCA G 2025–2027 only. */
  tutorG: { email: "e2e.tutor.g@example.test", name: "E2E Tutor G" },
} as const;

/** Students: register number → class key. */
export const STUDENTS = {
  mcaF1: { reg: "E2EMCAF01", name: "E2E Student MCA F01", cls: "mca25F" },
  mcaF2: { reg: "E2EMCAF02", name: "E2E Student MCA F02", cls: "mca25F" },
  mcaF3: { reg: "E2EMCAF03", name: "E2E Student MCA F03", cls: "mca25F" },
  mcaF4: { reg: "E2EMCAF04", name: "E2E Student MCA F04", cls: "mca25F" },
  mcaG1: { reg: "E2EMCAG01", name: "E2E Student MCA G01", cls: "mca25G" },
  mscF1: { reg: "E2EMSCF01", name: "E2E Student MSc F01", cls: "msc26F" },
  mscF2: { reg: "E2EMSCF02", name: "E2E Student MSc F02", cls: "msc26F" },
  mcaN1: { reg: "E2EMCAN01", name: "E2E Student MCA N01", cls: "mca26F" },
} as const;

export const EVENTS = {
  /** MCA 2025–2027, classes F and G, open now, editing allowed. */
  mcaSem3: "E2E Semester 3 Electives",
  /** MSc IT 2026–2028 class F, open now. Offers a subject with the same name as mcaSem3. */
  mscSem1: "E2E MSc IT Semester 1 Electives",
  /** MCA 2026–2028 class F, opens in the future (countdown). */
  mcaFuture: "E2E MCA Value-Added Course",
} as const;

export const SUBJECTS = {
  pe: "Professional Elective I",
  oe: "Open Elective I",
  cloud: "Cloud Computing",
  data: "Data Science and Analytics",
  security: "Cyber Security",
  marketing: "Digital Marketing",
  enterprise: "Entrepreneurship Development",
} as const;

export const SIGNUP_CODE_MSC = "EF-MSCIT-F-E2E1";
