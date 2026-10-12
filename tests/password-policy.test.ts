import test, { describe } from "node:test";
import assert from "node:assert";
import { isAcceptablePassword, normalizeRegisterNumber, passwordProblem, passwordRules, REGISTER_NUMBER_PATTERN } from "@/lib/password-policy";

describe("Student password policy", () => {
  const reg = "RA2532241010001";

  test("Accepts a reasonable password", () => {
    assert.strictEqual(passwordProblem("Campus#2026", { registerNumber: reg }), null);
    assert.strictEqual(isAcceptablePassword("long passphrase 4 me", { registerNumber: reg }), true, "spaces are allowed");
  });

  test("Rejects legacy PINs, short, letter-only and number-only passwords", () => {
    assert.match(passwordProblem("482915")!, /at least 8/);
    assert.match(passwordProblem("Ab1")!, /at least 8/);
    assert.match(passwordProblem("onlyletters")!, /number/);
    assert.match(passwordProblem("1234567890")!, /letter/);
  });

  test("Rejects the register number and handed-out defaults", () => {
    assert.match(passwordProblem(reg, { registerNumber: reg })!, /register number/);
    assert.match(passwordProblem(`x${reg.toLowerCase()}9`, { registerNumber: reg })!, /register number/);
    for (const d of ["Student@123", "Welcome@123", "password1", "SRMIST@123"]) {
      assert.ok(passwordProblem(d, { registerNumber: reg }), `${d} should be rejected`);
    }
  });

  test("Rejects passwords bcrypt would truncate", () => {
    assert.match(passwordProblem("a1" + "x".repeat(71))!, /at most 72/);
    assert.match(passwordProblem("a1" + "é".repeat(36))!, /at most 72/, "limit is in bytes, not characters");
  });

  test("Checklist reports each rule", () => {
    const rules = Object.fromEntries(passwordRules("abcdefgh").map((r) => [r.id, r.ok]));
    assert.deepStrictEqual(rules, { length: true, letter: true, number: false, personal: true });
  });

  test("Register numbers are normalised and must be letters and digits", () => {
    assert.strictEqual(normalizeRegisterNumber(" ra 2532241010001 "), reg);
    assert.ok(REGISTER_NUMBER_PATTERN.test(reg));
    for (const bad of ["RA_123456", "jd1234@srmist.edu.in", "RA1", "R".repeat(21)]) {
      assert.ok(!REGISTER_NUMBER_PATTERN.test(normalizeRegisterNumber(bad)), bad);
    }
  });
});
