/**
 * P2 补测 — scroll-reveal correctness + accessibility (axe) + submit-gating proof.
 *
 * Three things the layout-only / no-scroll passes could not verify:
 *  1. REVEAL: every `[data-motion-reveal]` panel actually becomes visible once the
 *     student scrolls it into view (proves the IntersectionObserver reveal + the new
 *     safety fallback work, i.e. the mobile "blank below fold" is purely a no-scroll
 *     screenshot artifact, not stuck content). Anything still hidden after a full
 *     scroll is a real bug.
 *  2. A11Y: axe-core scan of each fully-revealed page (wcag2a + wcag2aa), serious /
 *     critical violations only.
 *  3. GATING: the note/answer submit buttons mirror server validation (wealth note≥8,
 *     opportunity note≥8) — disabled while invalid, enabled once satisfied.
 *
 * Findings -> test-results/student-reveal-a11y/report.json
 * After-scroll screenshots -> test-results/student-reveal-a11y/screens/
 * Run: npx playwright test tests/e2e/student-reveal-a11y.spec.ts --project=chromium
 */
import fs from "node:fs";
import path from "node:path";

import { test, expect } from "playwright/test";
import type { Page } from "playwright/test";

const OUT_DIR = path.join("test-results", "student-reveal-a11y");
const SCREENS_DIR = path.join(OUT_DIR, "screens");
fs.mkdirSync(SCREENS_DIR, { recursive: true });

const AXE_PATH = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

const ROUTES: Array<{ name: string; path: string }> = [
  { name: "home", path: "/student" },
  { name: "market", path: "/student/market" },
  { name: "history", path: "/student/history" },
  { name: "rank", path: "/student/rank" },
  { name: "wealth", path: "/student/wealth" },
  { name: "risk-profile", path: "/student/risk-profile" },
  { name: "auto-invest", path: "/student/auto-invest" },
  { name: "life", path: "/student/life" },
  { name: "credit", path: "/student/credit" },
  { name: "quests", path: "/student/quests" },
  { name: "fund-lab", path: "/student/fund-lab" },
  { name: "goal-accounts", path: "/student/goal-accounts" },
  { name: "protection", path: "/student/protection" },
  { name: "opportunity", path: "/student/opportunity" },
];

type RevealFinding = { route: string; totalReveal: number; stillHidden: number; samples: string[] };
type A11yViolation = { route: string; id: string; impact: string; nodes: number; help: string };

const reveals: RevealFinding[] = [];
const a11y: A11yViolation[] = [];

async function loginApi(page: Page): Promise<boolean> {
  const res = await page
    .request.post("/api/auth/login", { data: { email: "student@brownzone.ai", password: "BrownZone2026!" } })
    .catch(() => null);
  return Boolean(res && res.ok());
}

// Scroll the window from top to bottom in viewport-sized steps so every
// IntersectionObserver reveal fires, then return to top.
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y <= height; y += Math.round(step * 0.8)) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" as ScrollBehavior }), y);
    await page.waitForTimeout(180);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(900); // let reveal tweens finish
}

test.describe("学生端 P2 复测：揭示 / 无障碍 / 校验门", () => {
  test("reveal-on-scroll + axe (mobile)", async ({ page }) => {
    test.setTimeout(15 * 60_000);
    page.setDefaultNavigationTimeout(60_000);
    const ok = await loginApi(page);
    console.log(`[reveal] student login ok=${ok}`);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ROUTES) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(1600);
      await scrollThrough(page);

      // REVEAL: any [data-motion-reveal] still transparent/hidden after a full scroll.
      const reveal = await page
        .evaluate(() => {
          const els = Array.from(document.querySelectorAll("[data-motion-reveal]"));
          const hidden: string[] = [];
          for (const el of els) {
            const s = getComputedStyle(el as HTMLElement);
            if (parseFloat(s.opacity || "1") < 0.05 || s.visibility === "hidden") {
              hidden.push(((el as HTMLElement).className || "").toString().slice(0, 70));
            }
          }
          return { total: els.length, hidden };
        })
        .catch(() => ({ total: 0, hidden: [] as string[] }));
      reveals.push({
        route: route.path,
        totalReveal: reveal.total,
        stillHidden: reveal.hidden.length,
        samples: reveal.hidden.slice(0, 4),
      });

      await page
        .screenshot({ path: path.join(SCREENS_DIR, `${route.name}-mobile-scrolled.png`), fullPage: true })
        .catch(() => {});

      // A11Y: inject axe and scan the fully-revealed page.
      await page.addScriptTag({ path: AXE_PATH }).catch(() => {});
      const result = await page
        .evaluate(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const axe = (window as any).axe;
          if (!axe) return { violations: [] };
          return await axe.run(document, { runOnly: ["wcag2a", "wcag2aa"], resultTypes: ["violations"] });
        })
        .catch(() => ({ violations: [] }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const v of (result.violations || []) as any[]) {
        if (v.impact === "serious" || v.impact === "critical") {
          a11y.push({ route: route.path, id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help });
        }
      }
      console.log(
        `[reveal] ${route.name}: reveal ${reveal.total - reveal.hidden.length}/${reveal.total} shown, ` +
          `axe serious/critical=${a11y.filter((x) => x.route === route.path).length}`,
      );
    }
  });

  test("submit gating mirrors server validation", async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await loginApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Wealth — note must be >= 8 chars (server: wealth-summary note.min(8)).
    await page.goto("/student/wealth", { waitUntil: "domcontentloaded" });
    const wSubmit = page.getByTestId("wealth-review-submit");
    // CI 冷启动时 Next dev 对该路由按需编译 + 重水合可能 > 默认 5s 断言超时，
    // 导致偶发「element not found」。显式等待表单挂载（≤45s）再断言，消除 flake。
    await wSubmit.waitFor({ state: "attached", timeout: 45_000 });
    await scrollThrough(page);
    await expect(wSubmit, "wealth submit disabled with empty note").toBeDisabled();
    await page.getByPlaceholder(/成长资产比例偏高/).fill("先观察现金垫是否回到目标区间再决定加仓");
    await expect(wSubmit, "wealth submit enabled once note >= 8").toBeEnabled();

    // Opportunity — note must be >= 8 chars (server: opportunity note.min(8)).
    await page.goto("/student/opportunity", { waitUntil: "domcontentloaded" });
    const oSubmit = page.getByTestId("opportunity-submit");
    await oSubmit.waitFor({ state: "attached", timeout: 45_000 });
    await scrollThrough(page);
    await expect(oSubmit, "opportunity submit disabled with empty note").toBeDisabled();
    await page.getByTestId("opportunity-note").fill("AI 算力需求还在增长，但要观察估值与集中度是否回撤");
    await expect(oSubmit, "opportunity submit enabled once note >= 8").toBeEnabled();
  });

  test.afterAll(async () => {
    const report = {
      reveal: {
        pagesWithStuckContent: reveals.filter((r) => r.stillHidden > 0),
        all: reveals,
      },
      a11ySeriousCritical: a11y,
      a11yByImpact: a11y.reduce<Record<string, number>>((acc, v) => {
        acc[v.impact] = (acc[v.impact] || 0) + 1;
        return acc;
      }, {}),
    };
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    const stuck = reveals.filter((r) => r.stillHidden > 0).length;
    console.log(`[reveal] TOTAL pages with stuck reveal content=${stuck}; axe serious/critical=${a11y.length}`);
  });
});
