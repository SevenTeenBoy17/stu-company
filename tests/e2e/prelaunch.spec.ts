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
    await expect(page.getByRole("heading", { name: "商业运营与账号权限，总览在这里完成。" })).toBeVisible();
    await expect(page.locator("body")).toContainText("账号、试用与订阅管理");
    await expect(page.locator("body")).toContainText(
      /student@brownzone\.ai|林知夏|账号席位/,
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
    await expect(page.locator("body")).toContainText("学生策略台");
    await expect(page.getByText("游客先绑定个人账号，再请家长确认开通")).toBeVisible();
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
    expect(order.codeUrl).toContain(order.outTradeNo);
    expect(order.amountFen).toBe(1500);

    const complete = await page.request.post("/api/billing/mock-complete", {
      data: { outTradeNo: order.outTradeNo },
    });
    expect(complete.ok()).toBe(true);
    await expect(complete.json()).resolves.toMatchObject({
      message: /模拟支付完成|此前已开通/,
    });

    const status = await page.request.get(
      `/api/billing/order-status?outTradeNo=${encodeURIComponent(order.outTradeNo)}`,
    );
    expect(status.ok()).toBe(true);
    await expect(status.json()).resolves.toMatchObject({
      paid: true,
      status: "paid",
      targetUser: expect.objectContaining({
        id: "student-1",
        subscriptionTier: "standard",
      }),
    });
  });

  test("parent confirmation link opens pricing checkout for the linked student", async ({ page }) => {
    test.setTimeout(60_000);
    const studentLogin = await page.request.post("/api/auth/login", {
      data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
    });
    expect(studentLogin.ok()).toBe(true);

    const linkResponse = await page.request.post("/api/billing/parent-link");
    expect(linkResponse.ok()).toBe(true);
    const linkPayload = await linkResponse.json();
    expect(linkPayload.url).toContain("/pricing?upgrade=");
    expect(linkPayload.token).toBeTruthy();

    const forbiddenStudentPrepay = await page.request.post("/api/billing/prepay", {
      data: { tier: "standard", channel: "native", billingIntentToken: linkPayload.token },
    });
    expect(forbiddenStudentPrepay.status()).toBe(403);

    await page.request.post("/api/auth/logout");
    const parentLogin = await page.request.post("/api/auth/login", {
      data: { email: "parent@brownzone.ai", password: "BrownZone2026!" },
    });
    expect(parentLogin.ok()).toBe(true);

    await page.goto(linkPayload.url);
    await expect(page.getByText(/你正在通过孩子分享的链接/)).toBeVisible();
    await expect(page.getByText("当前确认链接用于标准版月卡")).toBeVisible();
    await expect(page.getByRole("button", { name: "微信开通 30 元/月" })).toHaveCount(0);

    const prepayResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/billing/prepay") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "微信开通 15 元/月" }).click();
    const prepayResponse = await prepayResponsePromise;
    expect(prepayResponse.ok()).toBe(true);
    const prepayRequestBody = prepayResponse.request().postDataJSON();
    expect(prepayRequestBody).toMatchObject({
      tier: "standard",
      channel: "manual",
      billingIntentToken: linkPayload.token,
    });
    expect(prepayRequestBody).not.toHaveProperty("targetUserId");
    const prepayPayload = await prepayResponse.json();
    expect(prepayPayload).toMatchObject({
      amountFen: 1500,
      manual: true,
      paymentMode: "wechat_manual",
    });
    await expect(page.getByText("微信人工收款订单已生成")).toBeVisible();

    const status = await page.request.get(
      `/api/billing/order-status?outTradeNo=${encodeURIComponent(prepayPayload.outTradeNo)}`,
    );
    expect(status.ok()).toBe(true);
    await expect(status.json()).resolves.toMatchObject({
      paid: false,
      status: "pending",
      channel: "manual",
      targetUser: expect.objectContaining({ id: "student-1" }),
    });
  });

  test("anonymous parent checkout preserves the upgrade link through login", async ({ page }) => {
    test.setTimeout(60_000);
    const studentLogin = await page.request.post("/api/auth/login", {
      data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
    });
    expect(studentLogin.ok()).toBe(true);

    const linkResponse = await page.request.post("/api/billing/parent-link");
    expect(linkResponse.ok()).toBe(true);
    const linkPayload = await linkResponse.json();
    expect(linkPayload.url).toContain("/pricing?upgrade=");
    expect(linkPayload.token).toBeTruthy();
    await page.request.post("/api/auth/logout");

    await page.goto(linkPayload.url);
    await page.getByTestId("wechat-checkout-start").click();

    await expect(page).toHaveURL(/\/demo\?/);
    const loginUrl = new URL(page.url());
    const next = loginUrl.searchParams.get("next");
    expect(next).toContain("/pricing?upgrade=");
    expect(next).toContain(linkPayload.token);

    await page.getByRole("textbox", { name: "邮箱 / 账号" }).fill("parent@brownzone.ai");
    await page.getByLabel("密码").fill("BrownZone2026!");
    await page.getByRole("button", { name: /登录并进入工作台/ }).click();

    await expect(page).toHaveURL(/\/pricing\?upgrade=/);
    expect(new URL(page.url()).searchParams.get("upgrade")).toBe(linkPayload.token);
  });

  test("market ticker api returns a stable payload", async ({ request }) => {
    const response = await request.get("/api/market/ticker-tape");
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);
  });
});
