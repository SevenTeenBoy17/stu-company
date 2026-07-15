import { test, expect, type Page } from "playwright/test";

// itest6 R3 P3-7 复验：定投标的下拉的键盘契约。修复前 Esc 只在触发按钮聚焦时生效，
// 焦点进入选项后 Esc 失效、且关闭后焦点丢失。修复后：容器级 keydown 覆盖触发按钮+选项，
// Esc 关闭并把焦点还给触发按钮。
test.describe.configure({ retries: 0, mode: "serial" });

async function loginStudent(page: Page): Promise<boolean> {
  const r = await page.request
    .post("/api/auth/login", { data: { email: "student@brownzone.ai", password: "BrownZone2026!" } })
    .catch(() => null);
  return Boolean(r && r.ok());
}

test("itest6 · auto-invest dropdown: Esc from an option closes AND restores focus", async ({ page }) => {
  test.setTimeout(90_000);
  // 减少动画：定投面板有 GSAP 入场（opacity/transform），会让 Playwright 稳定性检测反复失败。
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await loginStudent(page)).toBe(true);
  await page.goto("/student/auto-invest", { waitUntil: "domcontentloaded" });

  const trigger = page.getByTestId("auto-invest-asset-selector");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200); // let any残留 GSAP tween settle

  // open
  await trigger.click();
  const list = page.getByTestId("auto-invest-asset-list");
  await expect(list).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  // move focus INTO an option (the previously-dead case), then press Escape from there
  const firstOption = list.getByRole("option").first();
  await firstOption.focus();
  await expect(firstOption).toBeFocused();
  await page.keyboard.press("Escape");

  // list closes AND focus returns to the trigger
  await expect(list).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  // and Esc from the trigger itself still closes (regression guard on the pre-existing path)
  await trigger.click();
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(trigger).toBeFocused();
});
