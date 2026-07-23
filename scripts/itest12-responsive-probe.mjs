// itest12 响应式实测：电脑/平板/手机三档真视口，横向溢出 + 视口比例 + 截图
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8923";
const OUT = "test-results/itest12-responsive";
mkdirSync(OUT, { recursive: true });

// 电脑 / 平板竖 / 平板横 / 手机 —— 覆盖用户点名的三类设备
const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-portrait-820", width: 820, height: 1180 },
  { name: "tablet-landscape-1024", width: 1024, height: 768 },
  { name: "mobile-390", width: 390, height: 844 },
];

const PUBLIC = ["/", "/learn", "/demo", "/pricing"];
const STUDENT = ["/student", "/student/market", "/student/wealth", "/student/quests", "/student/rank", "/student/history"];

const results = [];

async function checkPage(page, path, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(900);
  // 逐屏滚动触发懒加载/揭示，再回顶
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    // 找出真正撑破视口的元素（右边界 > 视口 + 2px 容差）
    offenders: [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > window.innerWidth + 2 && r.left >= -1;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className ?? "").toString().split(" ").slice(0, 2).join(".")}=${Math.round(el.getBoundingClientRect().right)}`),
  }));
  const overflow = m.docW > m.innerW + 2;
  const label = `${path} @ ${vp.name}`;
  results.push({ label, overflow, docW: m.docW, innerW: m.innerW, offenders: m.offenders });
  console.log(`${overflow ? "[FAIL]" : "[PASS]"} ${label} — docW=${m.docW} innerW=${m.innerW}${overflow ? " OFFENDERS:" + m.offenders.join(", ") : ""}`);
  const safe = path.replace(/\//g, "_") || "_home";
  await page.screenshot({ path: join(OUT, `${safe}__${vp.name}.png`), fullPage: false });
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

for (const vp of VIEWPORTS) for (const p of PUBLIC) await checkPage(page, p, vp);

const login = await ctx.request.post(`${BASE}/api/auth/login`, {
  data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
  headers: { origin: BASE },
});
console.log(`student login=${login.status()}`);
for (const vp of VIEWPORTS) for (const p of STUDENT) await checkPage(page, p, vp);

await browser.close();
const fails = results.filter((r) => r.overflow);
console.log(`\n=== RESPONSIVE: ${results.length - fails.length}/${results.length} no-overflow ===`);
if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log(`  ${f.label} → ${f.offenders.join(", ")}`)); }
process.exit(fails.length ? 1 : 0);
