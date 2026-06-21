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

test.describe("student gameflow regression", () => {
  test("auto-invest path stays compact and keeps only recent schedule nodes visible", async ({ page }) => {
    await loginAsStudent(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/student/auto-invest", { waitUntil: "networkidle" });

    const pathCard = page.getByTestId("auto-invest-path-card");
    const scheduleList = page.getByTestId("auto-invest-schedule-list");
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
    await page.goto("/student/quests", { waitUntil: "networkidle" });

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
      return (
        images.length >= 4 &&
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
    await expect(page.getByRole("dialog")).toContainText("Mission Detail");
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
});
