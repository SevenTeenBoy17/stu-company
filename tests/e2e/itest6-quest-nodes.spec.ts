import { test, expect, type Page } from "playwright/test";

// itest6 R3 P2-1 复验：任务地图 6 个「航线」节点是否都可点（真点击，Playwright 自带
// 「未被其它元素遮挡」actionability 校验 = 正是 R1 抓到 3/6 被顶栏拦截的那条判据）。
// 修复前 R1：3/6 clickError；修复后期望 6/6 可点、0 拦截。
test.describe.configure({ retries: 0, mode: "serial" });

async function loginStudent(page: Page): Promise<boolean> {
  const r = await page.request
    .post("/api/auth/login", { data: { email: "student@brownzone.ai", password: "BrownZone2026!" } })
    .catch(() => null);
  return Boolean(r && r.ok());
}

test("itest6 · quest map 6 航线 nodes are all clickable (no interception)", async ({ page }) => {
  test.setTimeout(120_000);
  expect(await loginStudent(page)).toBe(true);
  await page.goto("/student/quests", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const nodes = page.locator('button[aria-label^="航线 "], [role="button"][aria-label^="航线 "]');
  const count = await nodes.count();
  const routeNodes = [];
  for (let i = 0; i < count; i++) {
    const label = (await nodes.nth(i).getAttribute("aria-label")) ?? "";
    if (/^航线\s*\d+，/.test(label.trim())) routeNodes.push(i);
  }
  // 期望恰好 6 个航线节点（3 已完成 + 3 未到达）
  expect(routeNodes.length).toBe(6);

  const errors: Array<{ label: string; error: string }> = [];
  for (const idx of routeNodes) {
    const node = nodes.nth(idx);
    const label = ((await node.getAttribute("aria-label")) ?? "").slice(0, 14);
    try {
      await node.scrollIntoViewIfNeeded({ timeout: 5000 });
      // trial:true 只做 actionability 校验（含遮挡检测）不真正触发导航，隔离每个节点、避免状态漂移
      await node.click({ timeout: 6000, trial: true });
    } catch (e) {
      errors.push({ label, error: String(e).split("\n")[0].slice(0, 120) });
    }
  }

  console.log(`[itest6:quest-nodes] tested=${routeNodes.length} intercepted=${errors.length} ${JSON.stringify(errors)}`);
  expect(errors, `被遮挡/不可点的节点: ${JSON.stringify(errors)}`).toHaveLength(0);
});
