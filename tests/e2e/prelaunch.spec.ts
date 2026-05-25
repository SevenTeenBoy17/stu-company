import { expect, test } from "playwright/test";

test.describe("prelaunch smoke", () => {
  test("public site pages render without horizontal overflow", async ({ page }) => {
    for (const route of ["/", "/learn", "/demo"]) {
      await page.goto(route);
      await expect(page.locator("body")).toContainText("Brown Zone");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${route} should not horizontally overflow`).toBe(false);
    }
  });

  test("student routes are reachable and guarded when logged out", async ({ page }) => {
    for (const route of ["/student", "/student/market", "/student/history"]) {
      await page.goto(route);
      await expect(page.locator("body")).toContainText(/登录|试玩入口|Brown Zone/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${route} should not horizontally overflow`).toBe(false);
    }
  });

  test("market ticker api returns a stable payload", async ({ request }) => {
    const response = await request.get("/api/market/ticker-tape");
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);
  });
});
