// UI v3 学生端视觉验收（实拍 + 删句断言 + /brand/v3 图状态码 + 真视口隐藏揭示计数）
//   用法：BASE_URL=http://127.0.0.1:8923 node scripts/ui-v3-accept.mjs
// 依据 scripts/itest11-shots.mjs（登录/滚动/fullPage 截图）与 scripts/itest11-reveal-probe.mjs
// （真视口逐屏滚动后 getComputedStyle().opacity 判定）的写法。GSAP fullPage 有 pin 伪影是已知现象，
// 可见性判定一律用真视口 computed opacity（不看截图）。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8923";
const OUT = process.env.OUT_DIR ?? "test-results/ui-v3-final-shots";
mkdirSync(OUT, { recursive: true });

// 本轮已删句：这四句在九页任一渲染 innerText 中必须【零出现】
const FORBIDDEN = [
  "任务不会一股脑摊开",
  "页面默认只展示关键信息",
  "先看摘要，再展开动作",
  "负责让你不被迫退出游戏",
];

// 九个登录后学生页
const PAGES = [
  ["student-home", "/student"],
  ["student-market", "/student/market"],
  ["student-wealth", "/student/wealth"],
  ["student-quests", "/student/quests"],
  ["student-history", "/student/history"],
  ["student-risk-profile", "/student/risk-profile"],
  ["student-auto-invest", "/student/auto-invest"],
  ["student-life", "/student/life"],
  ["student-credit", "/student/credit"],
];

// 每页期望命中的 v3 新图（其余三张 market-readonly/history-trend/autoinvest-dca 为“锦上添花”未接线）
const EXPECT_V3 = {
  "student-risk-profile": "rp-empty-persona.webp",
  "student-wealth": "wealth-life-map.webp",
  "student-market": "watchlist-why.webp",
};

// 覆盖九页全部 data-*-reveal 变体（motion/risk/quest/wealth/life/auto/credit/temp/goal/sandbox/protection）
const REVEAL_SEL = [
  "[data-motion-reveal]",
  "[data-risk-reveal]",
  "[data-quest-reveal]",
  "[data-wealth-reveal]",
  "[data-life-reveal]",
  "[data-auto-reveal]",
  "[data-credit-reveal]",
  "[data-temp-reveal]",
  "[data-goal-reveal]",
  "[data-sandbox-reveal]",
  "[data-protection-reveal]",
].join(",");

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

async function scrollThrough(page, vh) {
  await page.evaluate(async (step) => {
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 130));
    }
  }, Math.round(vh * 0.8));
  await page.waitForTimeout(700);
}

async function readInnerText(page) {
  return page.evaluate(() => document.body.innerText || "");
}

async function readRevealHidden(page) {
  return page.evaluate((sel) => {
    const all = [...document.querySelectorAll(sel)];
    const bad = all.filter((el) => Number(getComputedStyle(el).opacity) < 0.9);
    return {
      total: all.length,
      hidden: bad.length,
      names: bad
        .slice(0, 5)
        .map((el) => (el.querySelector("h1,h2,h3,p")?.textContent ?? el.getAttribute("data-testid") ?? "?").trim().slice(0, 24)),
    };
  }, REVEAL_SEL);
}

async function visit(page, label, path, viewport, currentRef) {
  currentRef.label = label;
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await scrollThrough(page, viewport.height); // 触发懒加载图 + GSAP 揭示
  // —— 真视口测量（滚动到底后，未回顶）——
  const innerText = await readInnerText(page);
  const reveal = await readRevealHidden(page);
  // —— 回顶后 fullPage 截图（pin 伪影已知，仅存档）——
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const suffix = viewport.width >= 1440 ? "desktop" : "mobile";
  await page.screenshot({ path: join(OUT, `${label}-${suffix}.png`), fullPage: true });
  return { innerText, reveal, shot: `${label}-${suffix}.png` };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });

// 登录（沿用参考脚本：ctx.request.post + origin 头）
const login = await ctx.request.post(`${BASE}/api/auth/login`, {
  data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
  headers: { origin: BASE },
});
console.log(`login student@brownzone.ai -> ${login.status()}`);
if (!login.ok()) {
  console.log("FATAL: 登录失败，无法继续");
  await browser.close();
  process.exit(2);
}

const page = await ctx.newPage();

// v3 图网络监听（Next/Image 走 /_next/image?url=%2Fbrand%2Fv3%2F… → 先 decode 再匹配）
const currentRef = { label: "" };
const v3Hits = []; // {page,file,status,url}
page.on("response", (resp) => {
  let decoded = resp.url();
  try {
    decoded = decodeURIComponent(resp.url());
  } catch {}
  if (decoded.includes("/brand/v3/")) {
    const m = decoded.match(/\/brand\/v3\/([^&?"']+\.webp)/);
    v3Hits.push({ page: currentRef.label, file: m ? m[1] : decoded, status: resp.status(), url: resp.url() });
  }
});

const results = [];
for (const [label, path] of PAGES) {
  const d = await visit(page, label, path, DESKTOP, currentRef);
  const m = await visit(page, label, path, MOBILE, currentRef);
  await page.waitForTimeout(300); // 收尾等late响应落地

  const combined = `${d.innerText}\n${m.innerText}`;
  const forbiddenHits = FORBIDDEN.filter((s) => combined.includes(s));

  const v3ForPage = v3Hits.filter((h) => h.page === label);
  const expectFile = EXPECT_V3[label];
  const v3Ok = expectFile ? v3ForPage.some((h) => h.file === expectFile && h.status === 200) : true;

  results.push({
    label,
    path,
    shotDesktop: d.shot,
    shotMobile: m.shot,
    forbiddenHits,
    revealHiddenDesktop: d.reveal,
    revealHiddenMobile: m.reveal,
    expectFile,
    v3ForPage,
    v3Ok,
  });
}

await browser.close();

// ————— 报告 —————
console.log("\n==================== UI v3 验收结果（九页逐页）====================");
let anyFail = false;
for (const r of results) {
  const shotLine = `shots: ${r.shotDesktop} + ${r.shotMobile}`;
  const delLine =
    r.forbiddenHits.length === 0 ? "删句检查: 0 命中 ✓" : `删句检查: 命中 ${JSON.stringify(r.forbiddenHits)} ✗`;
  let v3Line;
  if (r.expectFile) {
    const hit = r.v3ForPage.find((h) => h.file === r.expectFile);
    v3Line = hit ? `v3图: ${r.expectFile}=${hit.status}${hit.status === 200 ? " ✓" : " ✗"}` : `v3图: 期望 ${r.expectFile} 未命中 ✗`;
  } else {
    v3Line = "v3图: 该页无接线新图 (—)";
  }
  const revLine = `隐藏揭示: 桌面 ${r.revealHiddenDesktop.hidden}/${r.revealHiddenDesktop.total}, 移动 ${r.revealHiddenMobile.hidden}/${r.revealHiddenMobile.total}`;
  const pageFail =
    r.forbiddenHits.length > 0 ||
    !r.v3Ok ||
    r.revealHiddenDesktop.hidden > 0 ||
    r.revealHiddenMobile.hidden > 0;
  if (pageFail) anyFail = true;
  console.log(`\n[${pageFail ? "FAIL" : "PASS"}] ${r.label}  ${r.path}`);
  console.log(`   ${shotLine}`);
  console.log(`   ${delLine}`);
  console.log(`   ${v3Line}`);
  console.log(`   ${revLine}`);
  if (r.revealHiddenDesktop.hidden > 0) console.log(`     桌面仍隐藏: ${JSON.stringify(r.revealHiddenDesktop.names)}`);
  if (r.revealHiddenMobile.hidden > 0) console.log(`     移动仍隐藏: ${JSON.stringify(r.revealHiddenMobile.names)}`);
}

// 全局 v3：全部请求都必须 <400，且三页各命中
const v3Bad = v3Hits.filter((h) => h.status >= 400);
console.log("\n==================== /brand/v3 图请求汇总 ====================");
for (const h of v3Hits) console.log(`   ${h.page} | ${h.file} | ${h.status}`);
console.log(`   v3 请求总数=${v3Hits.length}  非200/失败(>=400)=${v3Bad.length}`);
for (const [pg, file] of Object.entries(EXPECT_V3)) {
  const ok = v3Hits.some((h) => h.page === pg && h.file === file && h.status === 200);
  console.log(`   期望命中 ${pg} → ${file}: ${ok ? "✓" : "✗"}`);
  if (!ok) anyFail = true;
}
if (v3Bad.length > 0) anyFail = true;

const totalShots = results.length * 2;
console.log("\n==================== 总结 ====================");
console.log(`截图: ${totalShots} 张 → ${OUT}`);
console.log(`删句(4句)零出现: ${results.every((r) => r.forbiddenHits.length === 0) ? "全部通过 ✓" : "有命中 ✗"}`);
console.log(`真视口隐藏揭示(<0.9)总计: 桌面 ${results.reduce((a, r) => a + r.revealHiddenDesktop.hidden, 0)}, 移动 ${results.reduce((a, r) => a + r.revealHiddenMobile.hidden, 0)}`);
console.log(`v3 新图: 三页命中=${Object.entries(EXPECT_V3).every(([pg, f]) => v3Hits.some((h) => h.page === pg && h.file === f && h.status === 200)) ? "✓" : "✗"}  全请求200=${v3Bad.length === 0 ? "✓" : "✗"}`);
console.log(`\n最终: ${anyFail ? "FAIL ✗" : "PASS ✓"}`);
process.exitCode = anyFail ? 1 : 0;
