// itest11 修复后运行时抽检：P1 KPI 活性 / quest webp / 三幕 a11y / SectionNav
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8922";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const login = await ctx.request.post(`${BASE}/api/auth/login`, {
  data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
  headers: { origin: BASE },
});
check("student login", login.ok(), String(login.status()));
const page = await ctx.newPage();

// 1) P1：/student KPI count-up 后做一次银行存款，可用现金 KPI 必须跟着变
await page.goto(`${BASE}/student`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2200); // 等 count-up 完成
const cashCard = page.locator("[data-motion-number][data-motion-format='currency']").nth(1);
const before = (await cashCard.textContent())?.trim();
// Secure cookie 在 http://127.0.0.1 只有浏览器栈会发（localhost 安全上下文特例），
// 动作必须在页面内 fetch 执行，Node 侧 APIRequestContext 会拒发 → 401 伪影。
const act = await page.evaluate(async () => {
  const r = await fetch("/api/sim/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "bank", action: "deposit", amount: 1000 }),
  });
  return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 120) };
});
check("bank deposit action", act.ok, `${act.status} ${act.ok ? "" : act.body}`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2200);
const after = (await cashCard.textContent())?.trim();
check("cash KPI reflects new state after action", Boolean(before && after && before !== after), `${before} -> ${after}`);
// 同页面内活性：SSR 文本非空且是 ¥ 金额
check("cash KPI renders ¥ amount", /¥[\d,]+/.test(after ?? ""), after ?? "");

// 2) quest 页：webp 图 200、无 png 引用残留、SectionNav 挂载
const respPromise = page.waitForResponse((r) => r.url().includes("mission-route-map-v2"), { timeout: 30000 }).catch(() => null);
await page.goto(`${BASE}/student/quests`, { waitUntil: "networkidle", timeout: 60000 });
const mapResp = await respPromise;
check("quest map webp requested & ok", Boolean(mapResp && mapResp.ok() && mapResp.url().includes(".webp")), mapResp ? mapResp.url().split("/").pop().slice(0, 60) : "no request");
const pngRefs = await page.evaluate(() => document.body.innerHTML.includes("mission-route-map-v2.png"));
check("no stale png refs on quest page", !pngRefs);
const questNav = await page.locator("nav[aria-label]").filter({ hasText: "任务" }).count();
check("quest SectionNav mounted", questNav > 0 || (await page.locator("nav").filter({ hasText: "赛季" }).count()) > 0);

// 3) 公开首页：三幕 step 隐藏态必须是 opacity 而非 visibility:hidden
const pub = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await pub.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await pub.waitForTimeout(2500);
const storyState = await pub.evaluate(() => {
  const steps = [...document.querySelectorAll("[data-motion-story-step]")];
  return steps.map((s) => {
    const cs = getComputedStyle(s);
    return { vis: cs.visibility, op: cs.opacity };
  });
});
const anyHiddenVis = storyState.some((s) => s.vis === "hidden");
check("story steps stay in a11y tree (no visibility:hidden)", storyState.length >= 3 && !anyHiddenVis, JSON.stringify(storyState));

// 4) 行情带 scrim：section 背景含 linear-gradient
const tickerBg = await pub.evaluate(() => {
  const el = document.querySelector("[data-ticker-tape]") ?? document.querySelector("section[style*='texture-market-dark']");
  if (!el) {
    for (const s of document.querySelectorAll("section,div")) {
      const bg = getComputedStyle(s).backgroundImage;
      if (bg.includes("texture-market-dark")) return bg.slice(0, 120);
    }
    return "not-found";
  }
  return getComputedStyle(el).backgroundImage.slice(0, 120);
});
check("ticker texture has darkening scrim", tickerBg.includes("linear-gradient"), tickerBg.slice(0, 80));

await browser.close();
const fails = results.filter((r) => !r.ok).length;
console.log(`=== SPOTCHECK: ${results.length - fails}/${results.length} passed ===`);
process.exit(fails ? 1 : 0);
