import { expect, test } from "@playwright/test";

test("support behaves like a themed workspace section", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-access-choice-hydrated="true"]').waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Choose site theme").click();
  await expect(page.getByRole("button", { name: "Journal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Journal", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preview", "premium-journal");

  await page.getByRole("button", { name: "Support the Project", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Help keep the journal running" })).toBeVisible();
  await expect(page.getByText("C1WWM8yvppK1Uxeqc5ybo6VPUeKiBLxHwtUgxgeVajFP")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preview", "premium-journal");

  await page.goto("/support");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preview", "premium-journal");
  await expect(page.getByRole("heading", { name: "Help keep the journal running", level: 1 })).toBeVisible();
});
