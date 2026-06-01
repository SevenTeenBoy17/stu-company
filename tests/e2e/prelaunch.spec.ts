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

  test("public header no longer exposes student or teacher direct links", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "首页" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "投资课程" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "试玩入口" })).toBeVisible();
    await expect(page.getByRole("link", { name: "学生端" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "教师端" })).toHaveCount(0);
  });

  test("demo portal supports superadmin login and admin console loads", async ({ page }) => {
    await page.goto("/demo");
    const html = await page.content();
    expect(html).not.toContain("Super001!!!");
    await expect(page.getByRole("button", { name: /登录账号/ })).toBeVisible();
    await expect(page.getByText("超级管理员")).toHaveCount(0);
    await expect(page.getByText("superadmin")).toHaveCount(0);
    await page.getByRole("button", { name: /登录账号/ }).click();
    await expect(page.getByRole("heading", { name: "邮箱登录" })).toBeVisible();
    await page.getByLabel("邮箱 / 账号").fill("superadmin");
    await page.getByLabel("密码").fill("Super001!!!");
    await page.getByRole("button", { name: /登录并进入工作台/ }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "账号、试用与订阅管理" })).toBeVisible();
    await page.getByPlaceholder("搜索姓名、邮箱或备注").fill("student");
    await page.getByRole("button", { name: /查询/ }).click();
    await expect(page.locator("body")).toContainText(
      /账号列表已刷新。|student@brownzone\.ai|林知夏/,
      { timeout: 30_000 },
    );
  });

  test("student routes are reachable and guarded when logged out", async ({ page }) => {
    for (const route of ["/student", "/student/market", "/student/history"]) {
      await page.goto(route);
      await expect(page.locator("body")).toContainText(/登录|试玩入口|Brown Zone/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${route} should not horizontally overflow`).toBe(false);
    }
  });

  test("guest trial enters the student sandbox and shows the upgrade entry", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /游客体验/ }).click();
    await expect(page).toHaveURL(/\/student/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "学生策略台" })).toBeVisible();
    await expect(page.getByText("游客可立即开通完整 AI 评定")).toBeVisible();
    await expect(page.getByText(/This page couldn't load/i)).toHaveCount(0);
  });

  test("student venture exit api succeeds without a manual amount", async ({ page }) => {
    test.setTimeout(60_000);
    const login = await page.request.post("/api/auth/login", {
      data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
    });
    expect(login.ok()).toBe(true);
    await page.goto("/student");
    await expect(page.getByRole("heading", { name: "学生策略台" })).toBeVisible();

    const invest = await page.request.post("/api/sim/actions", {
      data: { type: "venture", action: "invest", amount: 2000 },
    });
    expect(invest.ok()).toBe(true);

    const exit = await page.request.post("/api/sim/actions", {
      data: { type: "venture", action: "exit" },
    });
    expect(exit.ok()).toBe(true);
    await expect(exit.json()).resolves.toMatchObject({ message: "操作已生效。" });
  });

  test("parent checkout is bound to linked student and mock order can be fulfilled", async ({ page }) => {
    test.setTimeout(60_000);
    const login = await page.request.post("/api/auth/login", {
      data: { email: "parent@brownzone.ai", password: "BrownZone2026!" },
    });
    expect(login.ok()).toBe(true);
    await page.goto("/parent");
    await expect(page.locator("body")).toContainText("家长");

    const missingTarget = await page.request.post("/api/billing/prepay", {
      data: { tier: "standard", channel: "native" },
    });
    expect(missingTarget.status()).toBe(400);

    const forbiddenTarget = await page.request.post("/api/billing/prepay", {
      data: { tier: "standard", channel: "native", targetUserId: "student-2" },
    });
    expect(forbiddenTarget.status()).toBe(403);

    const prepay = await page.request.post("/api/billing/prepay", {
      data: { tier: "standard", channel: "native", targetUserId: "student-1" },
    });
    expect(prepay.ok()).toBe(true);
    const order = await prepay.json();
    expect(order.mock).toBe(true);

    const complete = await page.request.post("/api/billing/mock-complete", {
      data: { outTradeNo: order.outTradeNo },
    });
    expect(complete.ok()).toBe(true);
    await expect(complete.json()).resolves.toMatchObject({
      message: /模拟支付完成|此前已开通/,
    });
  });

  test("market ticker api returns a stable payload", async ({ request }) => {
    const response = await request.get("/api/market/ticker-tape");
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);
  });
});
