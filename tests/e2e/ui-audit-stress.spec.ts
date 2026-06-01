/**
 * Round 3 — extreme-content stress test (长内容仿真).
 *
 * The viewport sweep (ui-audit.spec.ts) found mostly LATENT overflow risks that
 * short demo data never triggers. This pass injects realistic worst-case content
 * — long Chinese names (复姓 + 少数民族 + 演示后缀), 9-figure net worth, 58-char
 * emails — into the live DOM of the highest-risk roles, then re-detects clipping
 * and viewport overflow and screenshots the result. It DEMONSTRATES whether the
 * "会不会显示不全" risk is real. Diagnostic only; never asserts.
 *
 * Run: npx playwright test tests/e2e/ui-audit-stress.spec.ts --project=chromium --workers=1
 */
import fs from "node:fs";
import path from "node:path";

import { test } from "playwright/test";
import type { Page } from "playwright/test";

const OUT_DIR = path.join("test-results", "ui-audit");
const SCREENS_DIR = path.join(OUT_DIR, "screens-stress");
fs.mkdirSync(SCREENS_DIR, { recursive: true });

const EXTREME = {
  money: "¥1,234,567,890",
  email: "ouyang.naina.abdushalam.student2026@brownzone-education-platform.example.com.cn",
  name: "欧阳娜娜·阿依古丽·测试超长学生姓名演示用例",
};

type Finding = {
  page: string;
  viewport: string;
  kind: string;
  text: string;
  selector: string;
  detail: string;
};
const all: Finding[] = [];

// Replace money / email / truncate-target / leaderboard-name text with extreme
// values. Returns how many of each it changed. Runs in the browser.
function injectExtreme(ex: typeof EXTREME) {
   
  const moneyRe = /^\s*[¥￥]\s*-?[\d][\d,]*\s*$/;
  const emailRe = /^\s*\S+@\S+\.\S+\s*$/;
  const rankRe = /^\s*#\d+\s+\S/;
  let money = 0,
    email = 0,
    trunc = 0,
    rank = 0;
  const own = (el: Element) => {
    let t = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) t += n.textContent || "";
    });
    return t;
  };
  const setOwn = (el: Element, v: string) => {
    let done = false;
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent = done ? "" : v;
        done = true;
      }
    });
    if (!done) el.textContent = v;
  };
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const t = own(el).trim();
    if (!t) continue;
    const cls = (el.getAttribute("class") || "");
    if (moneyRe.test(t)) {
      setOwn(el, ex.money);
      money++;
    } else if (emailRe.test(t)) {
      setOwn(el, ex.email);
      email++;
    } else if (rankRe.test(t)) {
      setOwn(el, t.replace(/(#\d+\s+).*/, "$1" + ex.name));
      rank++;
    } else if (/\btruncate\b/.test(cls) || /\bline-clamp-/.test(cls)) {
      setOwn(el, ex.name);
      trunc++;
    }
  }
  return { money, email, trunc, rank };
   
}

function detect() {
  /* eslint-disable */
  const innerW = window.innerWidth;
  const out: any[] = [];
  const describe = (el: Element) => {
    const parts: string[] = [];
    let node: Element | null = el;
    let d = 0;
    while (node && node.nodeType === 1 && d < 4) {
      let s = node.tagName.toLowerCase();
      const cls = (node.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      if (cls) s += "." + cls;
      parts.unshift(s);
      node = node.parentElement;
      d++;
    }
    return parts.join(" > ");
  };
  const own = (el: Element) => {
    let t = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) t += n.textContent || "";
    });
    return t.trim().replace(/\s+/g, " ");
  };
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const he = el as HTMLElement;
    const r = he.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(he);
    if (st.visibility === "hidden" || st.display === "none" || parseFloat(st.opacity || "1") < 0.02) continue;
    const t = own(el);
    if (!t) continue;
    const nowrap = st.whiteSpace === "nowrap" || st.whiteSpace === "pre";
    const ellipsis = st.textOverflow === "ellipsis";
    const clipX = ["hidden", "clip", "auto", "scroll"].includes(st.overflowX);
    const overX = he.scrollWidth - he.clientWidth > 1;
    if ((nowrap || ellipsis) && overX && (clipX || ellipsis)) {
      out.push({
        kind: ellipsis ? "TRUNCATED_ELLIPSIS" : "CLIPPED_NO_ELLIPSIS",
        text: t.slice(0, 50),
        selector: describe(el),
        detail: `hidden≈${he.scrollWidth - he.clientWidth}px (scrollW=${he.scrollWidth}>clientW=${he.clientWidth})`,
      });
    }
    if (r.width <= innerW + 1 && r.right > innerW + 1.5) {
      out.push({
        kind: "VIEWPORT_OVERFLOW_RIGHT",
        text: t.slice(0, 50),
        selector: describe(el),
        detail: `right=${Math.round(r.right)} > vw=${innerW} (overflow ${Math.round(r.right - innerW)}px, clipped & hidden)`,
      });
    }
  }
  return out;
  /* eslint-enable */
}

async function loginApi(page: Page, email: string, password: string) {
  const r = await page.request.post("/api/auth/login", { data: { email, password } }).catch(() => null);
  return Boolean(r && r.ok());
}

async function stress(page: Page, name: string, url: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1800);
  const changed = await page.evaluate(injectExtreme, EXTREME).catch(() => null);
   
  console.log(`[stress] ${name} injected`, changed);
  await page.waitForTimeout(500);
  for (const vp of [
    { tag: "desktop", width: 1440, height: 900 },
    { tag: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENS_DIR, `${name}-${vp.tag}.png`), fullPage: true }).catch(() => {});
    const found = (await page.evaluate(detect).catch(() => [])) as Omit<Finding, "page" | "viewport">[];
    for (const x of found) all.push({ page: name, viewport: vp.tag, ...x });
     
    console.log(`[stress] ${name} @ ${vp.tag}: ${found.length} overflow/clip findings`);
  }
}

test.describe("ui audit stress", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(15_000);
  });

  test("teacher long content", async ({ page }) => {
    test.setTimeout(180_000);
    console.log("[stress] teacher login", await loginApi(page, "teacher@brownzone.ai", "BrownZone2026!"));
    await stress(page, "teacher-console", "/teacher");
  });

  test("admin long content", async ({ page }) => {
    test.setTimeout(180_000);
    console.log("[stress] admin login", await loginApi(page, "superadmin", "Super001!!!"));
    await stress(page, "admin-console", "/admin");
  });

  test("student long content", async ({ page }) => {
    test.setTimeout(180_000);
    console.log("[stress] student login", await loginApi(page, "student@brownzone.ai", "BrownZone2026!"));
    await stress(page, "student-dashboard", "/student");
    await stress(page, "student-history", "/student/history");
  });

  test.afterAll(() => {
    fs.writeFileSync(path.join(OUT_DIR, "stress-findings.json"), JSON.stringify(all, null, 2));
    const byKind = all.reduce<Record<string, number>>((a, f) => ((a[f.kind] = (a[f.kind] || 0) + 1), a), {});
     
    console.log(`[stress] TOTAL=${all.length}`, byKind);
  });
});
