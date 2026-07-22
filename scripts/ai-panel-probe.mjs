// AI 面板换装 + 标语气泡 真机探针（一次性验收用）
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8923";
const out = [];
const check = (name, ok, detail = "") => { out.push(ok); console.log(`${ok ? "[PASS]" : "[FAIL]"} ${name}${detail ? " — " + detail : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const login = await ctx.request.post(`${BASE}/api/auth/login`, {
  data: { email: "student@brownzone.ai", password: "BrownZone2026!" },
  headers: { origin: BASE },
});
check("login", login.ok(), String(login.status()));
const page = await ctx.newPage();
// 观察窗根因：/student 有持续行情后台请求，networkidle 12s+ 不静默，
// 会吃掉气泡 8-12s 的首演窗口（假 FAIL）。改 load 让轮询在首演前就位。
await page.goto(`${BASE}/student`, { waitUntil: "load", timeout: 60000 });

// 1) 悬浮球吉祥物在位（load 时刻可能未水合完，等待式断言）
const floatOk = await page
  .locator("button img[src*='ai-assistant-mascot']")
  .first()
  .waitFor({ timeout: 15000 })
  .then(() => true)
  .catch(() => false);
check("float mascot", floatOk);

// 2) 标语气泡：8s 首现（轮询至 14s），文案在预置集内
const TAGS = ["这笔交易值不值？问我", "有问题？找 Mr.Brown", "AI 助手 · 点我提问"];
let bubbleText = "";
let seenAt = -1;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  bubbleText = await page.evaluate((tags) => {
    for (const el of document.querySelectorAll("[aria-hidden='true']")) {
      const t = (el.textContent ?? "").trim();
      if (tags.includes(t) && Number(getComputedStyle(el).opacity) > 0.5) return t;
    }
    return "";
  }, TAGS);
  if (bubbleText) { seenAt = i + 1; break; }
}
console.log(`[debug] bubble seenAt=${seenAt}s`);
if (!bubbleText) {
  const dump = await page.evaluate(() => {
    const rows = [];
    for (const el of document.querySelectorAll("[aria-hidden='true']")) {
      const t = (el.textContent ?? "").trim();
      if (t && t.length < 30) rows.push({ t: t.slice(0, 24), op: getComputedStyle(el).opacity, cls: el.className.toString().slice(0, 50) });
    }
    return { rows: rows.slice(0, 10), ss: sessionStorage.getItem("brown-zone-ai-bubble-dismissed") };
  });
  console.log("[debug] aria-hidden dump:", JSON.stringify(dump));
}
check("nudge bubble appears ~8s", Boolean(bubbleText), bubbleText || "not seen in 14s");

// 3) 打开面板：头部吉祥物 + 空态一句话 + 品牌色发送钮 + sessionStorage 置位
await page.locator("button[aria-label='打开 KeyAI']").click();
await page.waitForTimeout(800);
const panel = await page.evaluate(() => {
  const imgs = document.querySelectorAll("img[src*='ai-assistant-mascot']").length;
  const empty = document.body.innerText.includes("和 Mr.Brown 聊聊你的沙盘");
  const send = [...document.querySelectorAll("button")].some((b) => b.className.includes("bg-brand") && b.closest("[role='dialog'],aside,div"));
  const flag = sessionStorage.getItem("brown-zone-ai-bubble-dismissed");
  return { imgs, empty, send, flag };
});
check("panel header mascot (>=2 mascot imgs)", panel.imgs >= 2, `imgs=${panel.imgs}`);
check("empty-state one-liner", panel.empty);
check("brand send button", panel.send);
check("bubble dismissed flag set on open", panel.flag === "1", String(panel.flag));

await browser.close();
console.log(`=== AI PANEL PROBE: ${out.filter(Boolean).length}/${out.length} passed ===`);
process.exit(out.every(Boolean) ? 0 : 1);
