/**
 * UI layout / typography audit harness (NOT a pass/fail test).
 *
 * Drives the post-login interface across desktop / tablet / mobile viewports,
 * captures full-page screenshots, and runs an in-page detector that flags text
 * that is clipped, truncated, overflowing the viewport, line-clamped, or set in
 * a sub-12px font. Findings are written to test-results/ui-audit/findings.json
 * and screenshots to test-results/ui-audit/screens/. Purely diagnostic — it does
 * not assert, so a broken layout never aborts capture.
 *
 * Run: npx playwright test tests/e2e/ui-audit.spec.ts --project=chromium
 */
import fs from "node:fs";
import path from "node:path";

import { test } from "playwright/test";
import type { Page } from "playwright/test";

const OUT_DIR = path.join("test-results", "ui-audit");
const SCREENS_DIR = path.join(OUT_DIR, "screens");
fs.mkdirSync(SCREENS_DIR, { recursive: true });

type Viewport = { tag: string; width: number; height: number };
const VIEWPORTS: Viewport[] = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "tablet", width: 768, height: 1024 },
  { tag: "mobile", width: 390, height: 844 },
];

type Finding = {
  page: string;
  url: string;
  viewport: string;
  kind: string;
  severity: "high" | "medium" | "low";
  text: string;
  selector: string;
  detail: string;
};

const allFindings: Finding[] = [];

// Detector runs in the browser. Returns raw findings for one (page, viewport).
function detectorSource() {
  /* eslint-disable */
  return (() => {
    const innerW = window.innerWidth;
    const out: any[] = [];
    const seen = new Set<string>();

    function describe(el: Element): string {
      const parts: string[] = [];
      let node: Element | null = el;
      let depth = 0;
      while (node && node.nodeType === 1 && depth < 4) {
        let s = node.tagName.toLowerCase();
        if ((node as HTMLElement).id) {
          s += "#" + (node as HTMLElement).id;
          parts.unshift(s);
          break;
        }
        const cls = (node.getAttribute("class") || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .join(".");
        if (cls) s += "." + cls;
        const parent: Element | null = node.parentElement;
        if (parent) {
          const sames = Array.from(parent.children).filter(
            (c) => c.tagName === node!.tagName,
          );
          if (sames.length > 1) s += ":nth(" + sames.indexOf(node) + ")";
        }
        parts.unshift(s);
        node = node.parentElement;
        depth++;
      }
      return parts.join(" > ");
    }

    function ownText(el: Element): string {
      let t = "";
      el.childNodes.forEach((n) => {
        if (n.nodeType === 3) t += n.textContent || "";
      });
      return t.trim().replace(/\s+/g, " ");
    }

    const els = Array.from(document.body.querySelectorAll("*"));
    for (const el of els) {
      const he = el as HTMLElement;
      const rect = he.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const style = getComputedStyle(he);
      if (
        style.visibility === "hidden" ||
        style.display === "none" ||
        parseFloat(style.opacity || "1") < 0.02
      )
        continue;

      const own = ownText(el);
      const snippet = (he.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70);
      const fontSize = parseFloat(style.fontSize) || 16;
      const overflowX = style.overflowX;
      const clipsX = ["hidden", "clip", "auto", "scroll"].includes(overflowX);
      const nowrap = style.whiteSpace === "nowrap" || style.whiteSpace === "pre";
      const ellipsis = style.textOverflow === "ellipsis";
      const lineClamp =
        style.webkitLineClamp && style.webkitLineClamp !== "none" ? parseInt(style.webkitLineClamp) : 0;
      const overX = he.scrollWidth - he.clientWidth > 1;
      const overY = he.scrollHeight - he.clientHeight > 1;

      const push = (kind: string, severity: string, detail: string, key: string) => {
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ kind, severity, detail, text: snippet, selector: describe(el) });
      };

      // 1. Single-line text clipped (ellipsis or hidden) — hides information.
      if (own && (nowrap || ellipsis) && overX && (clipsX || ellipsis)) {
        const sev = ellipsis ? "medium" : "high";
        push(
          ellipsis ? "TRUNCATED_ELLIPSIS" : "CLIPPED_NO_ELLIPSIS",
          sev,
          `scrollW=${he.scrollWidth} > clientW=${he.clientWidth}, white-space=${style.whiteSpace}, text-overflow=${style.textOverflow}`,
          "clipx:" + describe(el) + snippet.slice(0, 20),
        );
      }

      // 2. Multi-line clamp actually hiding content (usually intentional, low).
      if (own && lineClamp > 0 && overY) {
        push(
          "LINE_CLAMPED",
          "low",
          `-webkit-line-clamp=${lineClamp}, scrollH=${he.scrollHeight} > clientH=${he.clientHeight}`,
          "clamp:" + describe(el) + snippet.slice(0, 20),
        );
      }

      // 3. Non-clamp vertical clipping of text (content cut off vertically).
      if (own && !lineClamp && overY && ["hidden", "clip"].includes(style.overflowY) && he.clientHeight > 0) {
        push(
          "VERTICAL_CLIP",
          "medium",
          `scrollH=${he.scrollHeight} > clientH=${he.clientHeight}, overflow-y=${style.overflowY}`,
          "clipy:" + describe(el) + snippet.slice(0, 20),
        );
      }

      // 4. Text element / control overflowing the viewport horizontally
      //    (silently clipped by html{overflow-x:clip}). High signal.
      const isControl = ["BUTTON", "INPUT", "A", "SELECT"].includes(el.tagName);
      if ((own || isControl) && rect.width <= innerW + 1) {
        if (rect.right > innerW + 1.5) {
          push(
            "VIEWPORT_OVERFLOW_RIGHT",
            "high",
            `right=${Math.round(rect.right)} > viewport=${innerW} (overflow ${Math.round(rect.right - innerW)}px, clipped & hidden)`,
            "vor:" + describe(el) + snippet.slice(0, 20),
          );
        }
        if (rect.left < -1.5) {
          push(
            "VIEWPORT_OVERFLOW_LEFT",
            "high",
            `left=${Math.round(rect.left)} < 0 (overflow ${Math.round(-rect.left)}px)`,
            "vol:" + describe(el) + snippet.slice(0, 20),
          );
        }
      }

      // 5. Sub-12px text (crowding / readability risk). Skip pure-number micro UI.
      if (own && own.length >= 2 && fontSize < 12) {
        push(
          "SMALL_FONT",
          fontSize < 11 ? "medium" : "low",
          `font-size=${fontSize.toFixed(1)}px`,
          "small:" + describe(el) + snippet.slice(0, 20),
        );
      }
    }
    return out;
  })();
  /* eslint-enable */
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1800); // let framer-motion / async data settle
}

async function auditPage(page: Page, name: string, url: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
    await settle(page);
    const file = path.join(SCREENS_DIR, `${name}-${vp.tag}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    const raw = (await page.evaluate(detectorSource).catch(() => [])) as Omit<
      Finding,
      "page" | "url" | "viewport"
    >[];
    for (const r of raw) {
      allFindings.push({ page: name, url, viewport: vp.tag, ...r });
    }
     
    console.log(`[audit] ${name} @ ${vp.tag}: ${raw.length} findings -> ${file}`);
  }
}

async function loginApi(page: Page, email: string, password: string): Promise<boolean> {
  const res = await page
    .request.post("/api/auth/login", { data: { email, password } })
    .catch(() => null);
  return Boolean(res && res.ok());
}

test.describe("ui audit", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(15_000);
  });

  test("guest sandbox", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /游客体验/ }).click().catch(() => {});
    await page.waitForURL(/\/student/, { timeout: 30_000 }).catch(() => {});
    await auditPage(page, "guest-student", "/student");
  });

  test("student", async ({ page }) => {
    test.setTimeout(240_000);
    const ok = await loginApi(page, "student@brownzone.ai", "BrownZone2026!");
    console.log(`[audit] student login ok=${ok}`);
    await auditPage(page, "student-dashboard", "/student");
    await auditPage(page, "student-market", "/student/market");
    await auditPage(page, "student-history", "/student/history");
  });

  test("teacher", async ({ page }) => {
    test.setTimeout(180_000);
    const ok = await loginApi(page, "teacher@brownzone.ai", "BrownZone2026!");
    console.log(`[audit] teacher login ok=${ok}`);
    await auditPage(page, "teacher-console", "/teacher");
  });

  test("parent", async ({ page }) => {
    test.setTimeout(180_000);
    const ok = await loginApi(page, "parent@brownzone.ai", "BrownZone2026!");
    console.log(`[audit] parent login ok=${ok}`);
    await auditPage(page, "parent-dashboard", "/parent");
  });

  test("admin", async ({ page }) => {
    test.setTimeout(180_000);
    const ok = await loginApi(page, "superadmin", "Super001!!!");
    console.log(`[audit] admin login ok=${ok}`);
    await auditPage(page, "admin-console", "/admin");
  });

  test("demo portal + pricing", async ({ page }) => {
    test.setTimeout(180_000);
    await auditPage(page, "demo-portal", "/demo");
    await auditPage(page, "pricing", "/pricing");
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      path.join(OUT_DIR, "findings.json"),
      JSON.stringify(allFindings, null, 2),
    );
    const bySev = allFindings.reduce<Record<string, number>>((a, f) => {
      a[f.severity] = (a[f.severity] || 0) + 1;
      return a;
    }, {});
     
    console.log(`[audit] TOTAL findings=${allFindings.length}`, bySev);
  });
});
