/**
 * 学生端「代入式」内测 harness (NOT a pass/fail test).
 *
 * Logs in as the demo student and walks EVERY student route the way a student
 * would: lands on the page, lets data/animation settle, then exercises a bounded
 * set of in-page controls (buttons / tabs / selects / range sliders). While doing
 * so it records runtime problems that a layout-only audit cannot see:
 *
 *   - uncaught JS exceptions (React render crashes)        -> PAGE_ERROR  (high)
 *   - failed network requests (connection level)           -> REQUEST_FAILED (high)
 *   - HTTP 5xx / 4xx from the page's own /api/* calls       -> HTTP_5XX / HTTP_4XX
 *   - console.error / console.warning (incl. hydration)     -> CONSOLE_ERROR / _WARNING
 *   - visible error copy (数据不可用 / 加载失败 / error overlay) -> ERROR_UI_TEXT (high)
 *   - near-empty main content (page failed to render)       -> EMPTY_CONTENT (medium)
 *
 * Findings -> test-results/student-internal-test/report.json
 * Screenshots (desktop + mobile) -> test-results/student-internal-test/screens/
 * Purely diagnostic: every page is wrapped so one bad page never aborts the rest.
 *
 * Run: npx playwright test tests/e2e/student-internal-test.spec.ts --project=chromium
 */
import fs from "node:fs";
import path from "node:path";

import { test } from "playwright/test";
import type { Page, Request, Response, ConsoleMessage } from "playwright/test";

const OUT_DIR = path.join("test-results", "student-internal-test");
const SCREENS_DIR = path.join(OUT_DIR, "screens");
fs.mkdirSync(SCREENS_DIR, { recursive: true });

type Severity = "high" | "medium" | "low";
type Finding = {
  route: string;
  name: string;
  kind: string;
  severity: Severity;
  detail: string;
  evidence?: string;
};

type RouteDef = { name: string; path: string; label: string };

// Every student-facing route (the 12-round sandbox hub + 理财 2.0 toolkit).
const ROUTES: RouteDef[] = [
  { name: "home", path: "/student", label: "学生主页 / 沙盘 hub" },
  { name: "market", path: "/student/market", label: "市场行情板" },
  { name: "history", path: "/student/history", label: "复盘 / 历史回顾" },
  { name: "rank", path: "/student/rank", label: "学习成长榜" },
  { name: "wealth", path: "/student/wealth", label: "财富配置总览" },
  { name: "risk-profile", path: "/student/risk-profile", label: "风险测评" },
  { name: "auto-invest", path: "/student/auto-invest", label: "定投计划" },
  { name: "life", path: "/student/life", label: "生活现金流" },
  { name: "credit", path: "/student/credit", label: "信用实验室" },
  { name: "quests", path: "/student/quests", label: "财商任务" },
  { name: "fund-lab", path: "/student/fund-lab", label: "基金实验室" },
  { name: "goal-accounts", path: "/student/goal-accounts", label: "目标账户" },
  { name: "protection", path: "/student/protection", label: "保障伞" },
  { name: "opportunity", path: "/student/opportunity", label: "机会雷达" },
];

const findings: Finding[] = [];
const add = (f: Finding) => findings.push(f);

// Console noise that is never actionable — filter so the report stays signal-dense.
const CONSOLE_IGNORE = [
  "Download the React DevTools",
  "[Fast Refresh]",
  "Slow network is detected",
  "react-devtools",
  "Lighthouse",
  "favicon.ico",
];

// Copy that signals a broken / fallback UI state to a student.
const ERROR_TEXT = [
  "数据不可用",
  "加载失败",
  "出错了",
  "出现错误",
  "服务暂时不可用",
  "服务不可用",
  "请稍后再试",
  "连接失败",
  "未能加载",
  "Application error",
  "Unhandled Runtime Error",
  "Something went wrong",
  "client-side exception",
];

async function loginApi(page: Page, email: string, password: string): Promise<boolean> {
  const res = await page
    .request.post("/api/auth/login", { data: { email, password } })
    .catch(() => null);
  return Boolean(res && res.ok());
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1800); // let GSAP / async data settle
}

/** Probe the rendered page for visible error copy + empty-content symptoms. */
async function inspectVisible(page: Page, route: RouteDef) {
  // 1. Visible error copy.
  for (const needle of ERROR_TEXT) {
    const count = await page.getByText(needle, { exact: false }).count().catch(() => 0);
    if (count > 0) {
      add({
        route: route.path,
        name: route.name,
        kind: "ERROR_UI_TEXT",
        severity: "high",
        detail: `页面出现疑似错误/降级文案 "${needle}"（命中 ${count} 处）`,
        evidence: needle,
      });
    }
  }

  // 2. Near-empty main content (page mounted but produced almost nothing).
  const bodyLen = await page
    .evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      return (main.textContent || "").replace(/\s+/g, " ").trim().length;
    })
    .catch(() => -1);
  if (bodyLen >= 0 && bodyLen < 40) {
    add({
      route: route.path,
      name: route.name,
      kind: "EMPTY_CONTENT",
      severity: "medium",
      detail: `主内容区文本极少（${bodyLen} 字），可能渲染失败或卡在加载态`,
    });
  }
}

/**
 * Exercise a bounded set of in-page controls, staying on the page. Records nothing
 * itself — the page-level error listeners catch whatever the interactions trigger.
 */
async function exercise(page: Page, route: RouteDef) {
  const scope = (await page.locator("main").count()) > 0 ? page.locator("main") : page.locator("body");

  // Buttons / tabs — skip anything that navigates away or logs out.
  const skip = /退出|登出|注销|logout|sign ?out/i;
  const buttons = scope.getByRole("button");
  const btnCount = Math.min(await buttons.count().catch(() => 0), 8);
  for (let i = 0; i < btnCount; i++) {
    const btn = buttons.nth(i);
    try {
      if (!(await btn.isVisible())) continue;
      if (!(await btn.isEnabled())) continue;
      const txt = ((await btn.textContent().catch(() => "")) || "").trim();
      if (skip.test(txt)) continue;
      const before = page.url();
      await btn.click({ timeout: 3500, trial: false });
      await page.waitForTimeout(550);
      if (page.url() !== before) {
        // a control navigated away — return to keep auditing this page
        await page.goto(route.path, { waitUntil: "domcontentloaded" }).catch(() => {});
        await settle(page);
      }
    } catch {
      /* control not interactable in this state — fine */
    }
  }

  // Selects — pick the last option to flip planner presets.
  const selects = scope.locator("select");
  const selCount = Math.min(await selects.count().catch(() => 0), 4);
  for (let i = 0; i < selCount; i++) {
    try {
      const opts = await selects.nth(i).locator("option").count();
      if (opts > 1) await selects.nth(i).selectOption({ index: opts - 1 }).catch(() => {});
      await page.waitForTimeout(350);
    } catch {
      /* ignore */
    }
  }

  // Range sliders — nudge to fire onChange handlers (定投金额 / 配置权重 / 风险).
  const ranges = scope.locator('input[type="range"]');
  const rCount = Math.min(await ranges.count().catch(() => 0), 4);
  for (let i = 0; i < rCount; i++) {
    try {
      await ranges.nth(i).focus();
      for (let k = 0; k < 4; k++) await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    } catch {
      /* ignore */
    }
  }
}

async function visitRoute(page: Page, route: RouteDef, viewport: "desktop" | "mobile", interact: boolean) {
  // Per-route listeners so each finding is attributed to the right page.
  const pendingApiRequests = new Set<Request>();
  const ignoredTimedOutRequests = new Set<Request>();
  const isApiRequest = (req: Request) => req.url().includes("/api/");
  const onRequest = (req: Request) => {
    if (isApiRequest(req)) pendingApiRequests.add(req);
  };
  const onRequestFinished = (req: Request) => {
    pendingApiRequests.delete(req);
    ignoredTimedOutRequests.delete(req);
  };
  const onConsole = (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (CONSOLE_IGNORE.some((n) => text.includes(n))) return;
    add({
      route: route.path,
      name: route.name,
      kind: type === "error" ? "CONSOLE_ERROR" : "CONSOLE_WARNING",
      severity: type === "error" ? "medium" : "low",
      detail: text.slice(0, 300),
    });
  };
  const onPageError = (err: Error) => {
    add({
      route: route.path,
      name: route.name,
      kind: "PAGE_ERROR",
      severity: "high",
      detail: `未捕获异常: ${err.message}`.slice(0, 400),
      evidence: (err.stack || "").split("\n").slice(0, 3).join(" | "),
    });
  };
  const onRequestFailed = (req: Request) => {
    const url = req.url();
    if (!url.includes("/api/")) return; // ignore 3rd-party/analytics noise
    pendingApiRequests.delete(req);
    if (ignoredTimedOutRequests.has(req)) {
      ignoredTimedOutRequests.delete(req);
      return;
    }
    add({
      route: route.path,
      name: route.name,
      kind: "REQUEST_FAILED",
      severity: "high",
      detail: `请求失败 ${req.method()} ${url} — ${req.failure()?.errorText ?? "unknown"}`,
    });
  };
  const onResponse = (res: Response) => {
    const url = res.url();
    if (!url.includes("/api/")) return;
    const status = res.status();
    if (status < 400) return;
    add({
      route: route.path,
      name: route.name,
      kind: status >= 500 ? "HTTP_5XX" : "HTTP_4XX",
      severity: status >= 500 ? "high" : "medium",
      detail: `${status} ${res.request().method()} ${url.replace(/^https?:\/\/[^/]+/, "")}`,
    });
  };
  const waitForApiSettled = async (stage: string) => {
    const deadline = Date.now() + 30_000;
    while (pendingApiRequests.size > 0 && Date.now() < deadline) {
      await page.waitForTimeout(250);
    }
    if (pendingApiRequests.size > 0) {
      const slow = Array.from(pendingApiRequests)
        .slice(0, 4)
        .map((req) => `${req.method()} ${new URL(req.url()).pathname}`)
        .join("; ");
      for (const req of pendingApiRequests) ignoredTimedOutRequests.add(req);
      pendingApiRequests.clear();
      add({
        route: route.path,
        name: route.name,
        kind: "ASYNC_TIMEOUT",
        severity: "medium",
        detail: `${stage} 后仍有后台请求未在 30s 内返回：${slow}`,
      });
    }
  };

  page.on("request", onRequest);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("requestfinished", onRequestFinished);
  page.on("response", onResponse);

  try {
    await page.setViewportSize(
      viewport === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    );
    const resp = await page.goto(route.path, { waitUntil: "domcontentloaded" }).catch((e) => {
      add({
        route: route.path,
        name: route.name,
        kind: "LOAD_FAILED",
        severity: "high",
        detail: `导航失败: ${String(e).slice(0, 200)}`,
      });
      return null;
    });
    if (resp && resp.status() >= 400) {
      add({
        route: route.path,
        name: route.name,
        kind: resp.status() >= 500 ? "HTTP_5XX" : "HTTP_4XX",
        severity: resp.status() >= 500 ? "high" : "medium",
        detail: `页面文档返回 ${resp.status()}`,
      });
    }
    await settle(page);
    await waitForApiSettled("页面加载");
    await inspectVisible(page, route);
    if (interact) {
      await exercise(page, route);
      await waitForApiSettled("交互操作");
    }

    const file = path.join(SCREENS_DIR, `${route.name}-${viewport}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    console.log(`[内测] ${route.name} @ ${viewport}: 累计 ${findings.length} findings -> ${file}`);
  } finally {
    page.off("request", onRequest);
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
    page.off("requestfinished", onRequestFinished);
    page.off("response", onResponse);
  }
}

test.describe("学生端代入式内测", () => {
  test("walk all student routes as a student", async ({ page }) => {
    test.setTimeout(15 * 60_000);
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(12_000);

    const ok = await loginApi(page, "student@brownzone.ai", "BrownZone2026!");
    console.log(`[内测] student login ok=${ok}`);
    if (!ok) {
      add({
        route: "/api/auth/login",
        name: "login",
        kind: "PAGE_ERROR",
        severity: "high",
        detail: "学生 demo 账号登录失败（student@brownzone.ai），后续页面将以未登录态测试",
      });
    }

    // Desktop pass: full interaction + error capture.
    for (const route of ROUTES) {
      await visitRoute(page, route, "desktop", true);
    }
    // Mobile pass: load + error capture + screenshot (no interaction) to catch responsive breakage.
    for (const route of ROUTES) {
      await visitRoute(page, route, "mobile", false);
    }
  });

  test.afterAll(async () => {
    const bySev = findings.reduce<Record<string, number>>((a, f) => {
      a[f.severity] = (a[f.severity] || 0) + 1;
      return a;
    }, {});
    const byKind = findings.reduce<Record<string, number>>((a, f) => {
      a[f.kind] = (a[f.kind] || 0) + 1;
      return a;
    }, {});
    const report = {
      generatedAtNote: "stamp after run; new Date() unavailable in some sandboxes",
      totals: { findings: findings.length, bySeverity: bySev, byKind },
      routes: ROUTES.map((r) => r.path),
      findings,
    };
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(`[内测] TOTAL findings=${findings.length}`, bySev, byKind);
  });
});
