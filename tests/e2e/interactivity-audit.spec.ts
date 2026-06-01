/**
 * Interactivity / dead-control audit (diagnostic, non-asserting).
 *
 * Static code analysis confirms handler wiring (a button's onClick isn't visible
 * in the DOM because React delegates at the root). This live pass catches the
 * signals the DOM CAN reveal — placeholder/anchor-to-missing-id links, buttons
 * with no accessible name — plus any browser console errors / uncaught
 * exceptions per page. Writes test-results/interactivity/findings.json.
 *
 * Run: npx playwright test tests/e2e/interactivity-audit.spec.ts --project=chromium --workers=1
 */
import fs from "node:fs";
import path from "node:path";

import { test } from "playwright/test";
import type { ConsoleMessage, Page } from "playwright/test";

const OUT_DIR = path.join("test-results", "interactivity");
fs.mkdirSync(OUT_DIR, { recursive: true });

type PageReport = {
  page: string;
  url: string;
  counts: { anchors: number; buttons: number; inputs: number; forms: number; roleButtons: number };
  deadLinks: { reason: string; text: string }[];
  noAccessibleName: { html: string }[];
  formsNoHandler: number;
  disabledAtLoad: number;
  consoleErrors: string[];
  pageErrors: string[];
};

const reports: PageReport[] = [];

function domAudit() {
   
  const txt = (el: Element) => (el.textContent || "").trim().replace(/\s+/g, " ");
  const anchors = Array.from(document.querySelectorAll("a"));
  const deadLinks: { reason: string; text: string }[] = [];
  for (const a of anchors) {
    const href = a.getAttribute("href");
    const hasClick = a.hasAttribute("onclick");
    if (href === null) {
      if (!hasClick) deadLinks.push({ reason: "no-href-no-onclick", text: txt(a).slice(0, 40) });
    } else if (href === "#" || href.trim() === "" || href.startsWith("javascript:")) {
      deadLinks.push({ reason: `placeholder-href:${href}`, text: txt(a).slice(0, 40) });
    } else if (href.startsWith("#")) {
      const id = href.slice(1);
      if (id && !document.getElementById(id) && document.getElementsByName(id).length === 0) {
        deadLinks.push({ reason: `anchor-target-missing:${href}`, text: txt(a).slice(0, 40) });
      }
    }
  }
  const buttons = Array.from(document.querySelectorAll("button"));
  const noAccessibleName: { html: string }[] = [];
  let disabledAtLoad = 0;
  for (const b of buttons) {
    const name =
      txt(b) ||
      b.getAttribute("aria-label") ||
      b.getAttribute("title") ||
      (b.querySelector("[aria-label]") as HTMLElement | null)?.getAttribute("aria-label") ||
      "";
    if (!name) noAccessibleName.push({ html: b.outerHTML.replace(/\s+/g, " ").slice(0, 100) });
    if ((b as HTMLButtonElement).disabled) disabledAtLoad++;
  }
  const forms = Array.from(document.querySelectorAll("form"));
  let formsNoHandler = 0;
  for (const f of forms) {
    if (!f.getAttribute("action") && !f.hasAttribute("onsubmit")) formsNoHandler++; // React onSubmit not in DOM; informational
  }
  return {
    counts: {
      anchors: anchors.length,
      buttons: buttons.length,
      inputs: document.querySelectorAll("input,select,textarea").length,
      forms: forms.length,
      roleButtons: document.querySelectorAll('[role="button"]').length,
    },
    deadLinks,
    noAccessibleName,
    formsNoHandler,
    disabledAtLoad,
  };
   
}

async function loginApi(page: Page, email: string, password: string) {
  const r = await page.request.post("/api/auth/login", { data: { email, password } }).catch(() => null);
  return Boolean(r && r.ok());
}

async function auditPage(page: Page, name: string, url: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const onConsole = (m: ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  };
  const onPageError = (e: Error) => pageErrors.push(String(e.message).slice(0, 200));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2000);
  const audit = (await page.evaluate(domAudit).catch(() => null)) as Omit<
    PageReport,
    "page" | "url" | "consoleErrors" | "pageErrors"
  > | null;
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  if (audit) {
    reports.push({ page: name, url, ...audit, consoleErrors, pageErrors });
     
    console.log(
      `[interact] ${name}: a=${audit.counts.anchors} btn=${audit.counts.buttons} in=${audit.counts.inputs} | dead=${audit.deadLinks.length} noName=${audit.noAccessibleName.length} consoleErr=${consoleErrors.length} pageErr=${pageErrors.length}`,
    );
  }
}

test.describe("interactivity audit", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(15_000);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("public pages", async ({ page }) => {
    test.setTimeout(180_000);
    for (const [n, u] of [
      ["home", "/"],
      ["learn", "/learn"],
      ["demo", "/demo"],
      ["pricing", "/pricing"],
    ] as const) {
      await auditPage(page, n, u);
    }
  });

  test("guest sandbox", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /游客体验/ }).click().catch(() => {});
    await page.waitForURL(/\/student/, { timeout: 30_000 }).catch(() => {});
    await auditPage(page, "guest-student", "/student");
  });

  test("student pages", async ({ page }) => {
    test.setTimeout(180_000);
    await loginApi(page, "student@brownzone.ai", "BrownZone2026!");
    await auditPage(page, "student-dashboard", "/student");
    await auditPage(page, "student-market", "/student/market");
    await auditPage(page, "student-history", "/student/history");
  });

  test("teacher / parent / admin", async ({ page }) => {
    test.setTimeout(180_000);
    await loginApi(page, "teacher@brownzone.ai", "BrownZone2026!");
    await auditPage(page, "teacher", "/teacher");
    await loginApi(page, "parent@brownzone.ai", "BrownZone2026!");
    await auditPage(page, "parent", "/parent");
    await loginApi(page, "superadmin", "Super001!!!");
    await auditPage(page, "admin", "/admin");
  });

  test.afterAll(() => {
    fs.writeFileSync(path.join(OUT_DIR, "findings.json"), JSON.stringify(reports, null, 2));
    const totals = reports.reduce(
      (a, r) => ({
        dead: a.dead + r.deadLinks.length,
        noName: a.noName + r.noAccessibleName.length,
        consoleErr: a.consoleErr + r.consoleErrors.length,
        pageErr: a.pageErr + r.pageErrors.length,
        buttons: a.buttons + r.counts.buttons,
        anchors: a.anchors + r.counts.anchors,
      }),
      { dead: 0, noName: 0, consoleErr: 0, pageErr: 0, buttons: 0, anchors: 0 },
    );
     
    console.log(`[interact] TOTALS`, totals);
  });
});
