import { test, type ConsoleMessage, type Page } from "playwright/test";
import fs from "node:fs";
import path from "node:path";

// itest6 R1 · 真·点击遍历：逐角色逐页枚举每个可交互控件，逐个点击并【等结果/内容返回】后记录。
// 判据：每次点击后观察 导航/弹窗/内容变化/网络/控制台错误 五类信号；把「点了没反应」「报错」「点不到」
// 分别归档。不 hard-assert，跑完全量后由分析层判定。故意慢（每次点击前重载还原状态）以贴合真实用户逐个按。
test.describe.configure({ retries: 0, mode: "serial" });

const OUT_DIR = path.join("test-results", "itest6-crawl");
fs.mkdirSync(OUT_DIR, { recursive: true });

const CREDS: Record<string, [string, string]> = {
  student: ["student@brownzone.ai", "BrownZone2026!"],
  teacher: ["teacher@brownzone.ai", "BrownZone2026!"],
  parent: ["parent@brownzone.ai", "BrownZone2026!"],
  admin: ["superadmin", "Super001!!!"],
};

const ROUTES: Record<string, string[]> = {
  anon: ["/", "/learn", "/demo", "/pricing"],
  student: [
    "/student", "/student/market", "/student/quests", "/student/wealth", "/student/rank",
    "/student/risk-profile", "/student/auto-invest", "/student/life", "/student/credit",
    "/student/history", "/student/opportunity", "/student/fund-lab", "/student/goal-accounts", "/student/protection",
  ],
  teacher: ["/teacher"],
  parent: ["/parent"],
  admin: ["/admin"],
};

// 破坏性/离场控件：跳过，避免污染会话或触发不可逆动作。
const SKIP_LABEL = /登出|注销|退出登录|退出|logout|删除|移除账号|清空|结算|支付|去支付|立即支付|购买|升级订阅|开通/i;

async function loginApi(page: Page, role: string): Promise<boolean> {
  const [email, password] = CREDS[role];
  const r = await page.request.post("/api/auth/login", { data: { email, password } }).catch(() => null);
  return Boolean(r && r.ok());
}

type Ctrl = { i: number; tag: string; label: string; testid: string; href: string };

async function listControls(page: Page): Promise<Ctrl[]> {
  return page.evaluate(() => {
    const sel = 'button:not([disabled]), a[href], [role="button"], [role="tab"], [role="menuitemradio"], summary';
    const els = Array.from(document.querySelectorAll(sel));
    return els.map((el, i) => ({
      i,
      tag: el.tagName.toLowerCase(),
      label: ((el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.textContent || "") as string).trim().replace(/\s+/g, " ").slice(0, 48),
      testid: el.getAttribute("data-testid") || "",
      href: el.getAttribute("href") || "",
    }));
  });
}

async function mainText(page: Page): Promise<number> {
  return page.evaluate(() => (document.querySelector("main")?.innerText ?? document.body.innerText ?? "").length);
}

async function crawlRole(page: Page, role: string, findings: Record<string, unknown[]>) {
  if (role !== "anon") {
    const ok = await loginApi(page, role);
    findings.logins.push({ role, ok });
    if (!ok) return;
  }
  for (const route of ROUTES[role]) {
    let controls: Ctrl[] = [];
    try {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      controls = await listControls(page);
    } catch (e) {
      findings.pageLoadErrors.push({ role, route, error: String(e).slice(0, 160) });
      continue;
    }
    findings.pages.push({ role, route, controlCount: controls.length });

    for (const ctrl of controls) {
      if (SKIP_LABEL.test(ctrl.label)) {
        findings.skipped.push({ role, route, label: ctrl.label, reason: "destructive" });
        continue;
      }
      // 每次点击前重载，隔离状态（真实用户逐个操作、每次等结果）。
      try {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
      } catch {
        continue;
      }
      const consoleErrs: string[] = [];
      const pageErrs: string[] = [];
      let sawNetwork = false;
      const onConsole = (m: ConsoleMessage) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 160)); };
      const onPageErr = (e: Error) => pageErrs.push(String(e.message).slice(0, 160));
      const onResp = () => { sawNetwork = true; };
      page.on("console", onConsole);
      page.on("pageerror", onPageErr);
      page.on("response", onResp);

      const beforeUrl = page.url();
      const lenBefore = await mainText(page).catch(() => 0);
      const loc = ctrl.testid
        ? page.locator(`[data-testid="${ctrl.testid}"]`).first()
        : page.locator('button:not([disabled]), a[href], [role="button"], [role="tab"], [role="menuitemradio"], summary').nth(ctrl.i);

      let clickError = "";
      try {
        await loc.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {});
        await loc.click({ timeout: 5000 });
        // 等结果返回：导航 / 弹窗出现 / 网络空闲，任一先到即可，再给内容渲染留时间。
        await Promise.race([
          page.waitForURL((u) => u.href !== beforeUrl, { timeout: 3500 }).catch(() => {}),
          page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 3500 }).catch(() => {}),
          page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {}),
        ]);
        await page.waitForTimeout(700);
      } catch (e) {
        clickError = String(e).slice(0, 120);
      }

      const afterUrl = page.url();
      const navigated = afterUrl !== beforeUrl;
      const dialogOpen = (await page.locator('[role="dialog"]').count().catch(() => 0)) > 0;
      const lenAfter = navigated ? lenBefore : await mainText(page).catch(() => lenBefore);
      const contentChanged = Math.abs(lenAfter - lenBefore) > 12;
      const noEffect = !navigated && !dialogOpen && !contentChanged && !sawNetwork && !clickError;

      page.off("console", onConsole);
      page.off("pageerror", onPageErr);
      page.off("response", onResp);

      findings.clicks.push({
        role, route, label: ctrl.label, testid: ctrl.testid, tag: ctrl.tag,
        navigated, afterUrl: navigated ? afterUrl.replace(/^https?:\/\/[^/]+/, "") : undefined,
        dialogOpen, contentChanged, sawNetwork, noEffect,
        clickError: clickError || undefined,
        consoleErrors: consoleErrs.length ? consoleErrs : undefined,
        pageErrors: pageErrs.length ? pageErrs : undefined,
      });
    }
  }
}

for (const role of Object.keys(ROUTES)) {
  test(`itest6 crawl · ${role}`, async ({ page }) => {
    test.setTimeout(3_000_000);
    const findings: Record<string, unknown[]> = {
      logins: [], pages: [], clicks: [], skipped: [], pageLoadErrors: [],
    };
    await crawlRole(page, role, findings);
    fs.writeFileSync(path.join(OUT_DIR, `${role}.json`), JSON.stringify(findings, null, 2));
    const clicks = findings.clicks as Array<Record<string, unknown>>;
    const dead = clicks.filter((c) => c.noEffect);
    const errs = clicks.filter((c) => c.consoleErrors || c.pageErrors || c.clickError);
    console.log(`[itest6:${role}] pages=${findings.pages.length} clicks=${clicks.length} noEffect=${dead.length} withErrors=${errs.length} skipped=${findings.skipped.length}`);
  });
}
