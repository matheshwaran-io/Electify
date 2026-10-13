import { expect, test } from "@playwright/test";
import { STAFF } from "./fixtures/constants";
import { chooseYearServer, settle, signInStaff } from "./helpers";

/**
 * Keyboard and focus behaviour of the compact staff navigation: the phone
 * "More" sheet and the tablet drawer must behave as accessible dialogs.
 */
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await signInStaff(page, STAFF.tutor.email);
  await chooseYearServer(page, 2026);
});

test("phone: bottom bar and More sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/faculty/dashboard");
  await settle(page);
  const bar = page.getByRole("navigation", { name: "Primary" });
  await expect(bar).toBeVisible();
  // Desktop sidebar is not rendered as a visible column on phones.
  await expect(page.locator("aside").first()).toBeHidden();
  // Year Server and class identity stay visible on phones.
  await expect(page.locator("main")).toContainText("AY 2026–2027");
  await expect(page.getByRole("button", { name: /^Active class:/ }).first()).toBeVisible();

  const more = bar.getByRole("button", { name: "More" });
  await more.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet).toBeVisible();
  // While the modal sheet is open, the content behind it (including this bar) is
  // hidden from assistive technology, so check the trigger through the DOM.
  await expect(page.locator('nav[aria-label="Primary"] button[aria-expanded]')).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(more).toBeFocused();

  // Navigating from the sheet closes it.
  await more.click();
  await sheet.getByRole("link", { name: /Live window/ }).click();
  await page.waitForURL(/\/faculty\/window/);
  await expect(sheet).toBeHidden();

  // Touch targets in the bottom bar are at least 44px tall.
  for (const box of await bar.getByRole("link").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(44);
  }
});

test("tablet: navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/faculty/dashboard");
  await settle(page);
  const open = page.getByRole("button", { name: "Open navigation" });
  await expect(open).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  await open.click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await drawer.getByRole("link", { name: /Reports/ }).first().click();
  await page.waitForURL(/\/faculty\/(tutor-)?reports/);
  await expect(drawer).toBeHidden();
});
