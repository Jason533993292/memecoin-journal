import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const donationAddress = "C1WWM8yvppK1Uxeqc5ybo6VPUeKiBLxHwtUgxgeVajFP";

test("support page shows the donation address and locally generated QR code", async ({ page }) => {
  await page.goto("/support", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Help keep the journal running" })).toBeVisible();
  await expect(page.getByText(donationAddress, { exact: true })).toBeVisible();

  const qr = page.getByRole("img", { name: "QR code for the Memecoin Journal SOL donation address" });
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test("support page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("img", { name: "QR code for the Memecoin Journal SOL donation address" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});
