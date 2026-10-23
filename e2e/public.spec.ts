import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = ["/", "/privacy", "/terms"];

for (const path of publicPages) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
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

test("mobile public pages do not overflow horizontally", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile viewport check");
  for (const path of publicPages) {
    await page.goto(path);
    const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(sizes.scrollWidth, `${path} overflows by ${sizes.scrollWidth - sizes.width}px`).toBeLessThanOrEqual(sizes.width + 1);
  }
});
