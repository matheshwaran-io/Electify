/**
 * Student password rules, shared by the sign-up, reset and "set a new password"
 * forms (for live feedback) and the server actions (which enforce them).
 *
 * Kept deliberately simple: a minimum length, a letter and a number, nothing
 * that contains the student's register number, and none of the defaults that
 * have been handed out before. bcrypt only reads the first 72 bytes, so longer
 * passwords are refused rather than silently truncated.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** Register numbers are letters and digits only, e.g. RA2532241010001. */
export const REGISTER_NUMBER_PATTERN = /^[A-Z0-9]{5,20}$/;

export function normalizeRegisterNumber(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Defaults and obvious choices that have been used for student accounts. */
const BLOCKED = new Set([
  "password",
  "password1",
  "password123",
  "student@123",
  "student123",
  "welcome@123",
  "welcome123",
  "admin@12345",
  "srmist123",
  "srmist@123",
  "qwerty123",
  "abcd1234",
  "abc12345",
  "12345678a",
  "a12345678",
  "iloveyou1",
]);

export type PasswordRule = { id: string; label: string; ok: boolean };

/** Every rule with whether it passes, in display order. */
export function passwordRules(password: string, ctx: { registerNumber?: string } = {}): PasswordRule[] {
  const reg = ctx.registerNumber ? normalizeRegisterNumber(ctx.registerNumber) : "";
  const bytes = new TextEncoder().encode(password).length;
  return [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, ok: password.length >= PASSWORD_MIN_LENGTH && bytes <= PASSWORD_MAX_BYTES },
    { id: "letter", label: "A letter", ok: /[A-Za-z]/.test(password) },
    { id: "number", label: "A number", ok: /\d/.test(password) },
    {
      id: "personal",
      label: "Not your register number or a common password",
      ok: password.length > 0 && !(reg.length >= 5 && password.toUpperCase().includes(reg)) && !BLOCKED.has(password.toLowerCase()),
    },
  ];
}

/** First failing rule as a sentence, or null when the password is acceptable. */
export function passwordProblem(password: string, ctx: { registerNumber?: string } = {}): string | null {
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} characters.`;
  const failed = passwordRules(password, ctx).find((r) => !r.ok);
  if (!failed) return null;
  switch (failed.id) {
    case "length":
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    case "letter":
      return "Password must include a letter.";
    case "number":
      return "Password must include a number.";
    default:
      return "Choose a password that isn't your register number or a common password.";
  }
}

export function isAcceptablePassword(password: string, ctx: { registerNumber?: string } = {}) {
  return passwordProblem(password, ctx) === null;
}
