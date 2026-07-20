import { expect, test } from "playwright/test";

/**
 * 审查 #10 + #11 · UI v2 真浏览器冒烟：
 * jsdom 对任意值类（grid-rows-[0fr] / invisible）不做布局，Disclosure 的真实
 * 「收起→展开」可见性只能在真浏览器里验证；SplitText 与 pin 滚动叙事同理
 * （GSAP 在 jsdom 里根本不跑）。三个用例都走公开页，无需登录。
 */
test.describe("ui v2 smoke (Disclosure / SplitText / story pin)", () => {
  // 三幕叙事的 pin 只在 ≥1024px 桌面断点启用（gsap.matchMedia）。
  test.use({ viewport: { width: 1280, height: 720 } });

  test("pricing disclosure really expands the folded features without login", async ({ page }) => {
    await page.goto("/pricing");

    // 标准版卡面只常显前 4 条能力，「月度成长报告」折叠在 Disclosure 里，
    // 收起态必须不可见（invisible + grid-rows-[0fr]）。
    const hiddenFeature = page.getByText("月度成长报告");
    await expect(hiddenFeature).toHaveCount(1);
    await expect(hiddenFeature).toBeHidden();

    // 标准版与高级版都是 6 项能力，取第一个（标准版）触发器展开。
    await page.getByRole("button", { name: "展开全部 6 项能力" }).first().click();
    await expect(hiddenFeature).toBeVisible();
  });

  test("home hero h1 stays visible through the SplitText entrance", async ({ page }) => {
    await page.goto("/");
    // SplitText（aria:auto + mask lines）绝不能吞掉 LCP 标题：无论动效 chunk
    // 是否已到达/是否重播入场，h1 都必须以原句可见。
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("用 AI 把经济学装进游戏里");
    await expect(heading).toBeVisible();
  });

  test("story pin scrolls through to the third act 「看见成长」", async ({ page }) => {
    await page.goto("/");

    // 等 pin 真正激活：ScrollTrigger pin 会把 [data-motion-story] 包进
    // .pin-spacer（动效 provider 是 deferred 异步 chunk，需要给足加载时间）。
    await page.waitForFunction(
      () => Boolean(document.querySelector(".pin-spacer [data-motion-story]")),
      undefined,
      { timeout: 20_000 },
    );

    // pin 区间：start = 容器 top 贴视口 top，end = start + steps(3) × 85% 视口高。
    // 直接滚到区间末端再多给一点余量，让 scrub 末端第三幕 autoAlpha → 1。
    const targetY = await page.evaluate(() => {
      const spacer = document.querySelector<HTMLElement>(".pin-spacer");
      const anchor = spacer ?? document.querySelector<HTMLElement>("[data-motion-story]");
      if (!anchor) return 0;
      const top = anchor.getBoundingClientRect().top + window.scrollY;
      return Math.ceil(top + 3 * window.innerHeight * 0.85 + 60);
    });
    expect(targetY).toBeGreaterThan(0);
    await page.evaluate((y) => window.scrollTo(0, y), targetY);

    // scrub: 0.6 —— 滚动位置到位后补间还要追赶约 0.6s，给足缓冲再断言。
    await page.waitForTimeout(1_500);
    await expect(page.getByRole("heading", { name: "看见成长" })).toBeVisible();
  });
});
