// itest11 交付实拍：BASE_URL=http://127.0.0.1:8922 OUT_DIR=<dir> node scripts/itest11-shots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8922";
const OUT = process.env.OUT_DIR ?? "test-results/itest11-shots";
mkdirSync(OUT, { recursive: true });

const PUBLIC_PAGES = [
  ["home", "/"],
  ["learn", "/learn"],
  ["demo", "/demo"],
  ["pricing", "/pricing"],
];
const ROLE_PAGES = [
  ["student@brownzone.ai", [["student-home", "/student"], ["student-market", "/student/market"], ["student-wealth", "/student/wealth"], ["student-quests", "/student/quests"], ["student-rank", "/student/rank"]]],
  ["teacher@brownzone.ai", [["teacher", "/teacher"]]],
  ["parent@brownzone.ai", [["parent", "/parent"]]],
  ["admin@brownzone.ai", [["admin", "/admin"]]],
];

async function shoot(page, name, path, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
  // 滚动触发懒加载/滚动揭示后回顶
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  console.log(`[shot] ${name}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

for (const [name, path] of PUBLIC_PAGES) {
  await shoot(page, `${name}-desktop`, path, { width: 1440, height: 900 });
  await shoot(page, `${name}-mobile`, path, { width: 375, height: 812 });
}

for (const [email, pages] of ROLE_PAGES) {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email, password: "BrownZone2026!" },
    headers: { origin: BASE },
  });
  if (!res.ok()) { console.log(`[login-fail] ${email} ${res.status()}`); continue; }
  for (const [name, path] of pages) {
    await shoot(page, `${name}-desktop`, path, { width: 1440, height: 900 });
    await shoot(page, `${name}-mobile`, path, { width: 375, height: 812 });
  }
  await ctx.request.post(`${BASE}/api/auth/logout`, { headers: { origin: BASE } }).catch(() => {});
}

await browser.close();
console.log("DONE");
