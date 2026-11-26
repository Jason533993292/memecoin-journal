import { expect, test } from "@playwright/test";

const steps = [
  "dashboard", "dashboard-summary", "equity-curve", "calendar", "journal", "journal-filters", "journal-results",
  "daily-journal", "daily-journal-new", "daily-journal-library", "daily-journal-editor", "daily-journal-context",
  "daily-journal-writing-tools", "daily-journal-review-tools", "daily-journal-recovery-tools", "daily-journal-save",
  "wallets", "wallet-scan", "paper-capital", "new-wallet", "wallet-records", "wallet-history", "analytics",
  "analytics-calendar", "analytics-discipline", "analytics-duration", "analytics-setups", "analytics-yearly", "research",
  "research-editor", "research-copy", "research-timeline", "research-decisions", "ai-coach", "ai-overview", "ai-snapshot",
  "ai-provider-settings", "ai-analysis", "ai-question", "feedback", "feedback-close", "tour-finish",
] as const;

const clickSteps = new Set(["dashboard", "journal", "daily-journal", "wallets", "analytics", "research", "ai-coach", "feedback", "feedback-close"]);

test("guest tutorial reaches and highlights all 42 real targets", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.locator('[data-access-choice-hydrated="true"]').waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Guest mode", exact: true }).click();
  await page.getByRole("button", { name: "Continue tutorial" }).click();

  for (const [index, id] of steps.entries()) {
    await expect(page.locator("html")).toHaveAttribute("data-tour-step", id);
    await expect(page.locator(`[data-tour-highlight="${id}"]`), `missing highlight for tutorial step ${index + 1}: ${id}`).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("dialog", { name: new RegExp(`Tutorial step ${index + 1}:`) })).toBeVisible();
    if (id === "wallet-scan") {
      await page.keyboard.press("k");
      await expect(page.locator("html")).toHaveAttribute("data-tour-step", "wallets");
      await page.keyboard.press("k");
      await expect(page.locator("html")).toHaveAttribute("data-tour-step", "daily-journal-save");
      const saveControl = page.locator('[data-tour="daily-journal-save"]:visible').first();
      const highlight = page.locator('[data-tour-highlight="daily-journal-save"]');
      await expect.poll(async () => {
        const [control, ring] = await Promise.all([saveControl.boundingBox(), highlight.boundingBox()]);
        return !!control && !!ring && Math.abs(ring.y - Math.max(7, control.y - 7)) < 2;
      }).toBe(true);
      await page.keyboard.press("l");
      await expect(page.locator("html")).toHaveAttribute("data-tour-step", "wallets");
      await page.keyboard.press("l");
      await expect(page.locator("html")).toHaveAttribute("data-tour-step", id);
    }
    if (index === steps.length - 1) {
      await page.locator("[data-tour-dialog]").getByRole("button", { name: /^continue/i }).click();
    } else if (clickSteps.has(id)) {
      await page.locator('button[aria-label^="Activate "]').click();
    } else {
      await page.locator("[data-tour-dialog]").getByRole("button", { name: /^continue/i }).click();
    }
  }

  await expect(page.locator("html")).not.toHaveAttribute("data-tour-step", /.+/);
  await expect(page.getByText("Trading overview")).toBeVisible();
});
