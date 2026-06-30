import { expect, test } from "playwright/test";

async function loginAsStudent(page: import("playwright/test").Page) {
  const response = await page.request.post("/api/auth/login", {
    data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
  });
  expect(response.ok()).toBe(true);
}

async function expectNoHorizontalOverflow(page: import("playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

async function routeCardLayout(page: import("playwright/test").Page) {
  return page.locator('[data-testid^="mission-route-card-back-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }),
  );
}

test.describe("student gameflow regression", () => {
  test("auto-invest path stays compact and keeps only recent schedule nodes visible", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/student/auto-invest", { waitUntil: "domcontentloaded" });

    const pathCard = page.getByTestId("auto-invest-path-card");
    const scheduleList = page.getByTestId("auto-invest-schedule-list");
    // /student/auto-invest never reaches `networkidle` in dev (AI polling + GSAP
    // timers keep the network busy), so wait on the stable path card instead.
    await pathCard.waitFor({ state: "visible" });
    await pathCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await expect(pathCard).toBeVisible();
    await expect(scheduleList).toBeVisible();

    const pathBox = await pathCard.boundingBox();
    const listBox = await scheduleList.boundingBox();
    expect(pathBox?.width ?? 0).toBeGreaterThan(480);
    expect(pathBox?.height ?? 999).toBeLessThan(380);
    expect(listBox?.height ?? 999).toBeLessThan(260);
    await expect(scheduleList.locator("article")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);
  });

  test("quest hub supports commander selection, blind-box reveal, and detail modal", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    // /student/quests never reaches `networkidle` in dev (AI polling + GSAP
    // timers keep the connection alive); wait for DOM + the asserted panels.
    await page.goto("/student/quests", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("quest-commander-panel")).toBeVisible();
    await expect(page.getByTestId("quest-queue-panel")).toBeVisible();
    await expect(page.getByTestId("quest-queue-scroll-hint")).toBeVisible();
    await expect(page.locator('[data-testid^="quest-flip-"]')).toHaveCount(1);

    const imageLoaded = await page
      .getByTestId("quest-commander-image")
      .evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0);
    expect(imageLoaded).toBe(true);

    const questCardThemes = await page
      .locator('[data-testid^="quest-box-art-"]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-theme")).filter(Boolean));
    expect(new Set(questCardThemes).size).toBe(questCardThemes.length);

    await page.locator('[data-testid^="quest-box-art-"]').first().scrollIntoViewIfNeeded();

    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('[data-testid^="quest-box-art-"] img'));
      // 当前设计：主区为单张任务锦囊主卡（航线节点用角色头像而非整张卡面），故 box-art 主卡为 1 张。
      return (
        images.length >= 1 &&
        images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)
      );
    });

    const characterImagesLoaded = await page
      .locator('[data-testid^="quest-box-art-"] img')
      .evaluateAll((images) => {
        const loaded = images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth >= 90 &&
            image.currentSrc.includes("/_next/image") &&
            image.currentSrc.includes("quest-world"),
        );
        const mainCardIsCrisp = images[0] instanceof HTMLImageElement && images[0].naturalWidth >= 176;
        return loaded && mainCardIsCrisp;
      });
    expect(characterImagesLoaded).toBe(true);

    const queueCanScroll = await page
      .getByTestId("quest-queue-scroll")
      .evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(queueCanScroll).toBe(true);

    await page.locator('[data-testid^="quest-flip-"]').first().click();
    await page.getByRole("button", { name: "查看任务详情" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("任务详情");
    await page.getByRole("button", { name: "关闭任务详情" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByText("成就墙").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('[data-testid^="achievement-badge-"] img'));
      return (
        images.length >= 7 &&
        images.every(
          (image) =>
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth >= 80 &&
            image.currentSrc.includes("/_next/image") &&
            image.currentSrc.includes("achievement-badges"),
        )
      );
    });

    const achievementBadgesLoaded = await page
      .locator('[data-testid^="achievement-badge-"] img')
      .evaluateAll((images) => images.length >= 7);
    expect(achievementBadgesLoaded).toBe(true);
    await expectNoHorizontalOverflow(page);
  });

  test("quest center tablet layout keeps route cards readable without horizontal overflow", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/student/quests", { waitUntil: "domcontentloaded" });

    const commander = page.getByTestId("quest-commander-panel");
    await expect(commander).toBeVisible();
    await expect(page.locator('[data-testid^="mission-route-card-back-"]')).toHaveCount(4);
    await expect(page.locator('[data-testid^="season-objective-card-back-"]')).toHaveCount(5);

    const commanderBox = await commander.boundingBox();
    expect(commanderBox?.width ?? 0).toBeGreaterThan(700);
    expect(commanderBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(950);
    const routeCards = await routeCardLayout(page);
    expect(routeCards.every((card) => card.width > 320)).toBe(true);
    expect(routeCards.every((card) => card.height >= 148)).toBe(true);
    expect(new Set(routeCards.map((card) => card.x)).size).toBe(2);
    expect(new Set(routeCards.map((card) => card.y)).size).toBe(2);
    await expectNoHorizontalOverflow(page);
  });

  test("mission route cards can be revealed and selected with keyboard only", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/student/quests", { waitUntil: "domcontentloaded" });

    const secondBack = page.locator('[data-testid^="mission-route-card-back-"]').nth(1);
    const secondFront = page.locator('[data-testid^="mission-route-card-front-"]').nth(1);
    const secondSelect = page.locator('[data-testid^="mission-route-select-"]').nth(1);
    const secondReturn = page.locator('[data-testid^="mission-route-return-"]').nth(1);

    await expect(secondBack).toBeVisible();
    await secondBack.focus();
    await expect(secondBack).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(secondBack).toHaveAttribute("aria-hidden", "true");
    await expect(secondFront).toHaveAttribute("aria-hidden", "false");
    await expect(secondSelect).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(secondSelect).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await expect(secondReturn).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(secondBack).toHaveAttribute("aria-hidden", "false");
    await expect(secondFront).toHaveAttribute("aria-hidden", "true");
    await expect(secondBack).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test("season mission cards support keyboard reveal and return", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/student/quests", { waitUntil: "domcontentloaded" });

    const firstBack = page.locator('[data-testid^="season-objective-card-back-"]').first();
    const firstFront = page.locator('[data-testid^="season-objective-card-front-"]').first();
    const primaryLink = page.getByRole("link", { name: /去完成赛季任务/ }).first();
    const returnButton = page.getByRole("button", { name: /翻回赛季任务卡背/ }).first();

    await firstBack.focus();
    await expect(firstBack).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(firstBack).toHaveAttribute("aria-hidden", "true");
    await expect(firstFront).toHaveAttribute("aria-hidden", "false");
    await expect(primaryLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(returnButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstBack).toHaveAttribute("aria-hidden", "false");
    await expect(firstFront).toHaveAttribute("aria-hidden", "true");
    await expect(firstBack).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test("season mission cards flip on mobile with reduced motion", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/student/quests", { waitUntil: "domcontentloaded" });

    const firstBack = page.locator('[data-testid^="season-objective-card-back-"]').first();
    const firstFront = page.locator('[data-testid^="season-objective-card-front-"]').first();

    await expect(firstBack).toBeVisible();
    await expect(firstBack).toHaveAttribute("aria-hidden", "false");
    await firstBack.click();

    await expect(firstBack).toHaveAttribute("aria-hidden", "true");
    await expect(firstFront).toHaveAttribute("aria-hidden", "false");
    await expect(page.getByRole("link", { name: /去完成赛季任务/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /翻回赛季任务卡背/ }).first()).toBeVisible();
    const commanderBox = await page.getByTestId("quest-commander-panel").boundingBox();
    expect(commanderBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(1300);
    await expectNoHorizontalOverflow(page);
  });
});
