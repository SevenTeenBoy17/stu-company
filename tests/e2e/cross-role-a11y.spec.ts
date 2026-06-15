/**
 * Deep cross-role audit — verifies the app-wide design-token changes (fg-muted /
 * info / brand-ink darkening) don't regress the non-student roles, and that no role
 * throws runtime errors. Logs in as each role, scrolls the main console to fire
 * reveals, then captures runtime errors + an axe color-contrast scan.
 *
 * Findings -> test-results/cross-role-a11y/report.json
 * Screenshots -> test-results/cross-role-a11y/screens/
 * Run: npx playwright test tests/e2e/cross-role-a11y.spec.ts --project=chromium
 */
import fs from "node:fs";
import path from "node:path";

import { test } from "playwright/test";
import type { Page, Request, Response, ConsoleMessage } from "playwright/test";

const OUT_DIR = path.join("test-results", "cross-role-a11y");
const SCREENS_DIR = path.join(OUT_DIR, "screens");
fs.mkdirSync(SCREENS_DIR, { recursive: true });

const AXE_PATH = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

const ROLES: Array<{ name: string; email: string; password: string; path: string }> = [
  { name: "student", email: "student@brownzone.ai", password: "BrownZone2026!", path: "/student" },
  { name: "teacher", email: "teacher@brownzone.ai", password: "BrownZone2026!", path: "/teacher" },
  { name: "parent", email: "parent@brownzone.ai", password: "BrownZone2026!", path: "/parent" },
  { name: "admin", email: "superadmin", password: "Super001!!!", path: "/admin" },
];

const CONSOLE_IGNORE = [
  "Download the React DevTools",
  "[Fast Refresh]",
  "repo.fallback",
  "GSAP target",
  "favicon.ico",
];

type Finding = { role: string; kind: string; severity: string; detail: string };
type ContrastNode = { role: string; ratio: number; fg: string; bg: string; html: string };

const findings: Finding[] = [];
const contrast: ContrastNode[] = [];
const summary: Array<{ role: string; ok: boolean; runtimeIssues: number; contrastNodes: number }> = [];

async function loginApi(page: Page, email: string, password: string): Promise<boolean> {
  const res = await page.request.post("/api/auth/login", { data: { email, password } }).catch(() => null);
  return Boolean(res && res.ok());
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y <= height; y += Math.round(step * 0.8)) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" as ScrollBehavior }), y);
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(800);
}

test.describe("跨角色深度审计", () => {
  test("each role: runtime + axe contrast", async ({ page }) => {
    test.setTimeout(12 * 60_000);
    page.setDefaultNavigationTimeout(60_000);

    for (const role of ROLES) {
      const before = findings.length;
      const onConsole = (m: ConsoleMessage) => {
        const t = m.type();
        if (t !== "error" && t !== "warning") return;
        const text = m.text();
        if (CONSOLE_IGNORE.some((n) => text.includes(n))) return;
        findings.push({ role: role.name, kind: t === "error" ? "CONSOLE_ERROR" : "CONSOLE_WARNING", severity: t === "error" ? "medium" : "low", detail: text.slice(0, 240) });
      };
      const onPageError = (e: Error) => findings.push({ role: role.name, kind: "PAGE_ERROR", severity: "high", detail: e.message.slice(0, 300) });
      const onReqFail = (r: Request) => {
        if (!r.url().includes("/api/")) return;
        findings.push({ role: role.name, kind: "REQUEST_FAILED", severity: "high", detail: `${r.method()} ${r.url()} — ${r.failure()?.errorText ?? ""}` });
      };
      const onResp = (r: Response) => {
        if (!r.url().includes("/api/") || r.status() < 500) return;
        findings.push({ role: role.name, kind: "HTTP_5XX", severity: "high", detail: `${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}` });
      };
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("requestfailed", onReqFail);
      page.on("response", onResp);

      const ok = await loginApi(page, role.email, role.password);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(role.path, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(1500);
      await scrollThrough(page);
      await page.screenshot({ path: path.join(SCREENS_DIR, `${role.name}.png`), fullPage: true }).catch(() => {});

      await page.addScriptTag({ path: AXE_PATH }).catch(() => {});
      const result = await page
        .evaluate(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const axe = (window as any).axe;
          if (!axe) return { violations: [] };
          return await axe.run(document, { runOnly: ["color-contrast"], resultTypes: ["violations"] });
        })
        .catch(() => ({ violations: [] }));
      let cNodes = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const v of (result.violations || []) as any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const node of v.nodes as any[]) {
          cNodes += 1;
          const d = (node.any && node.any[0] && node.any[0].data) || {};
          contrast.push({ role: role.name, ratio: Number(d.contrastRatio) || 0, fg: String(d.fgColor || ""), bg: String(d.bgColor || ""), html: String(node.html || "").slice(0, 130) });
        }
      }

      const runtimeIssues = findings.slice(before).filter((f) => f.kind !== "CONSOLE_WARNING" && f.kind !== "REQUEST_FAILED").length;
      summary.push({ role: role.name, ok, runtimeIssues, contrastNodes: cNodes });
      console.log(`[cross-role] ${role.name}: login=${ok}, runtime issues=${runtimeIssues}, contrast nodes=${cNodes}`);

      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onReqFail);
      page.off("response", onResp);
    }
  });

  test.afterAll(async () => {
    const byPair = contrast.reduce<Record<string, { count: number; ratio: number; sample: string; role: string }>>((acc, c) => {
      const key = `${c.role} | ${c.fg} on ${c.bg}`;
      if (!acc[key]) acc[key] = { count: 0, ratio: c.ratio, sample: c.html, role: c.role };
      acc[key].count += 1;
      return acc;
    }, {});
    fs.writeFileSync(
      path.join(OUT_DIR, "report.json"),
      JSON.stringify({ summary, contrastTotal: contrast.length, contrastByPair: Object.entries(byPair).map(([k, v]) => ({ pair: k, ...v })).sort((a, b) => b.count - a.count), findings }, null, 2),
    );
    console.log(`[cross-role] DONE`, JSON.stringify(summary));
  });
});
