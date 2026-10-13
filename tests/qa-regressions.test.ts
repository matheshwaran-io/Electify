import test, { describe } from "node:test";
import assert from "node:assert";
import { receiptTerm } from "@/lib/academic";
import { windowPhase, type WindowEvent } from "@/components/window/types";

/**
 * Regression tests for defects found during the mobile/reload QA pass
 * (docs/qa/mobile-first-regression-report.md). Pure functions only: no database.
 */

describe("Receipt term (QA: receipts for odd semesters were numbered EVEN)", () => {
  test("semester decides the term", () => {
    assert.strictEqual(receiptTerm({ semester: 3, name: "Semester 3 Elective Registration" }), "ODD");
    assert.strictEqual(receiptTerm({ semester: 1, name: "Anything" }), "ODD");
    assert.strictEqual(receiptTerm({ semester: 4, name: "Odd-looking name" }), "EVEN");
  });
  test("events without a semester keep the old name-based fallback", () => {
    assert.strictEqual(receiptTerm({ semester: null, name: "Odd Semester Electives" }), "ODD");
    assert.strictEqual(receiptTerm({ semester: null, name: "Electives" }), "EVEN");
  });
});

describe("Staff window phase follows the student window rule (QA: no Pause for an open published event)", () => {
  const HOUR = 3600_000;
  const now = new Date("2026-10-14T10:00:00Z");
  const base: WindowEvent = { id: "e", name: "E", academicYear: null, status: "PUBLISHED", openDate: null, closeDate: null, description: null, groupCount: 1 };
  const at = (h: number) => new Date(now.getTime() + h * HOUR);

  test("published with the opening time passed is live", () => {
    assert.strictEqual(windowPhase({ ...base, openDate: at(-1), closeDate: at(5) }, now).phase, "live");
  });
  test("published before the opening time is scheduled", () => {
    const r = windowPhase({ ...base, openDate: at(2), closeDate: at(5) }, now);
    assert.strictEqual(r.phase, "scheduled");
    assert.strictEqual(r.target?.getTime(), at(2).getTime());
  });
  test("deadline passed with auto-close is closed, even if the status says OPEN", () => {
    assert.strictEqual(windowPhase({ ...base, status: "OPEN", openDate: at(-5), closeDate: at(-1), autoClose: true }, now).phase, "closed");
  });
  test("paused, and the other closed statuses, are reported as such", () => {
    assert.strictEqual(windowPhase({ ...base, status: "PAUSED", openDate: at(-1) }, now).phase, "paused");
    for (const status of ["CLOSED", "VERIFICATION", "FINALIZED", "ARCHIVED"]) {
      assert.strictEqual(windowPhase({ ...base, status, openDate: at(-1) }, now).phase, "closed", status);
    }
  });
});
