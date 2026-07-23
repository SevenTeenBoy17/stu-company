// 判定：真视口逐屏滚动后，首页各 section 是否真实可见（opacity/尺寸）
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8922";

async function probe(viewport, label) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 });
  // 模拟真实用户逐屏滚动到底
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += viewport.height * 0.75) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  const report = await page.evaluate(() => {
    const out = [];
    for (const sec of document.querySelectorAll("main section, section")) {
      const h2 = sec.querySelector("h2");
      const name = h2 ? h2.textContent.slice(0, 18) : (sec.id || "(anon)");
      const rect = sec.getBoundingClientRect();
      const style = getComputedStyle(sec);
      // 找区内首个被 GSAP 控制的揭示元素
      const reveal = sec.querySelector("[data-motion-reveal]");
      const revealOp = reveal ? getComputedStyle(reveal).opacity : "n/a";
      out.push({ name, h: Math.round(rect.height), secOp: style.opacity, revealOp });
    }
    return out;
  });
  console.log(`=== ${label} ===`);
  for (const r of report) console.log(`${r.name} | h=${r.h} secOp=${r.secOp} revealOp=${r.revealOp}`);
  await browser.close();
}

await probe({ width: 375, height: 812 }, "mobile-375");
await probe({ width: 1440, height: 900 }, "desktop-1440");

// /student（需登录）：真视口滚动后统计仍为 opacity<1 的揭示元素数量
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const login = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
    headers: { origin: BASE },
  });
  console.log(`student login=${login.status()}`);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/student`, { waitUntil: "networkidle", timeout: 45000 });
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += 650) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(900);
  const hidden = await page.evaluate(() => {
    const sel = "[data-motion-reveal],[data-goal-reveal],[data-sandbox-reveal],[data-wealth-reveal]";
    const all = [...document.querySelectorAll(sel)];
    const bad = all.filter((el) => Number(getComputedStyle(el).opacity) < 0.9);
    return { total: all.length, hidden: bad.length, names: bad.slice(0, 5).map((el) => (el.querySelector("h2,h3,p")?.textContent ?? "?").slice(0, 20)) };
  });
  console.log(`student reveal total=${hidden.total} still-hidden=${hidden.hidden} ${JSON.stringify(hidden.names)}`);
  await browser.close();
}
console.log("PROBE_DONE");
