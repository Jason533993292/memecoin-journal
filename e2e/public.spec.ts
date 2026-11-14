import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = ["/", "/privacy", "/terms"];

for (const path of publicPages) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === "critical" || violation.impact === "serious"
    );
    expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
  });
}

test("public health endpoint is minimal, uncached, and traceable", async ({ request }) => {
  const response = await request.get("/api/health", { headers: { "x-request-id": "playwright-health-check" } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-request-id"]).toBe("playwright-health-check");
});

test("visitors can explore first and choose guest mode only when recording", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose how to continue" })).toBeVisible();
  await page.locator('[data-access-choice-hydrated="true"]').waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Guest", exact: true }).focus();
  await expect(page.getByText("Try the journal temporarily. Your entries disappear when this page is refreshed or closed.")).toBeVisible();
  await page.getByRole("button", { name: "Sign up", exact: true }).focus();
  await expect(page.getByText("Create a private account so your trades and journal entries stay saved and sync across devices.")).toBeVisible();
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create Free Account" })).toBeVisible();
  await page.getByRole("button", { name: "Close sign-in" }).click();
  await expect(page.getByText("Explore before signing in")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Hide demo data" }).click();
  await expect(page.getByRole("button", { name: "Preview demo data" })).toBeVisible();
  await page.getByRole("button", { name: "Preview demo data" }).click();
  await expect(page.getByRole("button", { name: "Hide demo data" })).toBeVisible();

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Memecoin Trade Journal" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: /new trade/i }).first().click();
  await expect(page.getByRole("heading", { name: "Choose how to continue" })).toBeVisible();
  await page.getByRole("button", { name: "Guest", exact: true }).focus();
  await expect(page.getByText("Try the journal temporarily. Your entries disappear when this page is refreshed or closed.")).toBeVisible();

  await page.getByRole("button", { name: "Guest", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Memecoin Journal" })).toBeVisible();
  await page.getByRole("button", { name: /skip tutorial/i }).click();
  await expect(page.getByRole("heading", { name: /log new trade/i })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Temporary guest session")).toBeVisible();

  await page.getByRole("button", { name: "Daily Journal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose how to continue" })).toHaveCount(0);
  await expect(page.getByText("Daily Journal", { exact: true }).first()).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose how to continue" })).toBeVisible();
  await expect(page.getByText("Temporary guest session")).toHaveCount(0);
});

test("mobile public pages do not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile viewport check");
  for (const path of publicPages) {
    await page.goto(path);
    const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(sizes.scrollWidth, `${path} overflows by ${sizes.scrollWidth - sizes.width}px`).toBeLessThanOrEqual(sizes.width + 1);
  }
});
