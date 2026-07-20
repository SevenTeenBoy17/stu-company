/**
 * Page-level delivery smoke for the optimization goal.
 *
 * This is intentionally smaller and stricter than the diagnostic ui-audit
 * harness: it fails on blank/error pages, horizontal overflow, and serious /
 * critical axe-core violations across the highest-traffic public and student
 * routes at desktop + tablet + mobile widths.
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";

const OUT_DIR = path.join("test-results", "page-a11y-smoke");
const SCREENS_DIR = path.join(OUT_DIR, "screens");
fs.mkdirSync(SCREENS_DIR, { recursive: true });

const AXE_PATH = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

const VIEWPORTS = [
  { tag: "mobile", width: 390, height: 844 },
  { tag: "tablet", width: 768, height: 1024 },
  { tag: "tablet-landscape", width: 1024, height: 768 },
  { tag: "desktop", width: 1440, height: 900 },
] as const;

const PUBLIC_ROUTES = [
  { name: "home", path: "/", expectedText: "Brown Zone" },
  { name: "learn", path: "/learn", expectedText: "投资课程" },
  { name: "demo", path: "/demo", expectedText: "试玩" },
  { name: "pricing", path: "/pricing", expectedText: "订阅" },
] as const;

const STUDENT_ROUTES = [
  { name: "student-home", path: "/student", expectedText: "学生" },
  { name: "student-market", path: "/student/market", expectedText: "市场" },
  { name: "student-quests", path: "/student/quests", expectedText: "任务" },
] as const;

type SmokeRoute = (typeof PUBLIC_ROUTES)[number] | (typeof STUDENT_ROUTES)[number];
type SmokeFinding = {
  route: string;
  viewport: string;
  kind: string;
  detail: string;
};

const findings: SmokeFinding[] = [];

async function loginAsStudent(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
  });
  expect(response.ok(), `student login failed: ${response.status()} ${await response.text()}`).toBe(true);
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1_200);
}

async function scanAxe(page: Page) {
  await page.addScriptTag({ path: AXE_PATH });
  return await page.evaluate(async () => {
    type AxeViolation = {
      id: string;
      impact?: "minor" | "moderate" | "serious" | "critical";
      help: string;
      nodes: Array<{ target: string[] }>;
    };
    const axe = (window as unknown as { axe?: { run: (context: Document, options: unknown) => Promise<{ violations: AxeViolation[] }> } }).axe;
    if (!axe) return [];
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      resultTypes: ["violations"],
    });
    return result.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
      }));
  });
}

async function assertHealthyPage(page: Page, route: SmokeRoute, viewport: (typeof VIEWPORTS)[number]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await settle(page);

  const screenshotPath = path.join(SCREENS_DIR, `${route.name}-${viewport.tag}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const health = await page.evaluate(() => {
    const text = document.body?.innerText?.slice(0, 12_000) ?? "";
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const hasFrameworkOverlay = Boolean(
      text.includes("This page couldn't load") ||
        text.includes("Runtime Error") ||
        text.includes("Unhandled Runtime Error"),
    );
    return {
      title: document.title,
      text,
      textLength: text.trim().length,
      scrollWidth,
      clientWidth,
      overflowX: Math.max(0, scrollWidth - clientWidth),
      hasFrameworkOverlay,
    };
  });

  if (health.textLength < 80) {
    findings.push({ route: route.path, viewport: viewport.tag, kind: "blank", detail: `textLength=${health.textLength}` });
  }
  if (health.hasFrameworkOverlay) {
    findings.push({ route: route.path, viewport: viewport.tag, kind: "framework-overlay", detail: health.title });
  }
  if (health.overflowX > 1) {
    findings.push({
      route: route.path,
      viewport: viewport.tag,
      kind: "horizontal-overflow",
      detail: `scrollWidth=${health.scrollWidth}, clientWidth=${health.clientWidth}`,
    });
  }
  if (!health.text.includes(route.expectedText)) {
    findings.push({
      route: route.path,
      viewport: viewport.tag,
      kind: "missing-expected-text",
      detail: route.expectedText,
    });
  }

  const a11yViolations = await scanAxe(page);
  for (const violation of a11yViolations) {
    findings.push({
      route: route.path,
      viewport: viewport.tag,
      kind: `axe:${violation.id}`,
      detail: `${violation.impact}: ${violation.help} (${violation.targets.join("; ")})`,
    });
  }
}

test.describe("page a11y and visual smoke", () => {
  test("public routes are readable and accessible across mobile/tablet/desktop widths", async ({ page }) => {
    test.setTimeout(240_000);
    for (const route of PUBLIC_ROUTES) {
      for (const viewport of VIEWPORTS) {
        await assertHealthyPage(page, route, viewport);
      }
    }
  });

  test("student core routes are readable and accessible across mobile/tablet/desktop widths", async ({ page }) => {
    test.setTimeout(240_000);
    await loginAsStudent(page);
    for (const route of STUDENT_ROUTES) {
      for (const viewport of VIEWPORTS) {
        await assertHealthyPage(page, route, viewport);
      }
    }
  });

  test.afterAll(() => {
    fs.writeFileSync(path.join(OUT_DIR, "findings.json"), JSON.stringify(findings, null, 2));
    expect(findings).toEqual([]);
  });
});
