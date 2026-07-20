// UI v2 (Phase 1) 公开站素材批量生产 —— docs/ui-v2/02-phase1-asset-plan.md 的 21 张清单。
// gpt-image-2（api.llm-token.cn 网关）-> PNG(b64) -> WebP via sharp。Key 仅从 env 读取。
// Run: AI_API_KEY=$(grep '^AI_API_KEY=' .env.local | cut -d= -f2) node scripts/gen-ui-v2-assets.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const KEY = process.env.AI_API_KEY;
if (!KEY) { console.error("缺少 AI_API_KEY（从 .env.local 传入）。"); process.exit(2); }
// 双网关故障转移：llm-token.cn 实测会 TCP 连通但 HTTP 挂死（2026-07-20），
// 必须带每请求超时，否则整批卡在第 1 张。gpt-agent.cc 为同 key 备用网关。
const ENDPOINTS = [
  "https://gpt-agent.cc/v1/images/generations",
  "https://api.llm-token.cn/v1/images/generations",
];
const REQUEST_TIMEOUT_MS = 210_000;
const OUT_DIR = "public/brand/v2";
fs.mkdirSync(OUT_DIR, { recursive: true });

// 风格锁（docs/ui-v2/02 §风格锁前缀）—— 整批光照/色板统一。
const MASCOT_STYLE =
  "Cute 3D rendered mascot in soft clay Pixar style, warm amber (#f08a38) accent palette, " +
  "soft studio lighting, clean pastel background with generous negative space, " +
  "consistent friendly brown bear financial-education brand for kids, no text, no watermark";
const REAL_STYLE =
  "Photorealistic cinematic render, warm morning light, amber-gold accents, shallow depth of field, " +
  "premium fintech-editorial mood, clean composition with clear negative space for headline text, " +
  "no text, no watermark";

// [file, apiSize, outWidth, outHeight|null(keep ratio), style, prompt]
const ASSETS = [
  ["hero-classroom-market", "1536x1024", 1536, null, REAL_STYLE,
    "A cozy sunlit classroom desk with a miniature holographic city financial district rising from an open textbook, a cute 3D brown bear mascot in a tiny suit standing beside it pointing with a teacher's baton, amber holographic charts floating"],
  ["story-learn", "1536x1024", 1280, 960, MASCOT_STYLE,
    "The brown bear mascot reading a glowing oversized book, floating icons of coins, a sprouting plant and a shield around him, curious expression"],
  ["story-practice", "1536x1024", 1280, 960, MASCOT_STYLE,
    "The brown bear mascot at a tiny trading desk with three candy-colored monitors showing simple rising charts, focused expression"],
  ["story-growth", "1536x1024", 1280, 960, MASCOT_STYLE,
    "The brown bear mascot standing on a staircase podium of stacked golden coins, holding a small trophy, proud expression, gentle confetti"],
  ["learn-compound", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A potted plant sprouting golden coins as leaves on a small round pastel stage, single centered prop"],
  ["learn-risk", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A small shield leaning against two dice on a small round pastel stage, single centered prop group"],
  ["learn-allocation", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A balance scale holding three colored asset blocks (gold, blue, green) on a small round pastel stage"],
  ["learn-cashflow", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A tiny water wheel with a stream of golden coins flowing through it on a small round pastel stage"],
  ["learn-credit", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A golden key beside a round merit badge on a small round pastel stage"],
  ["learn-insurance", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A piggy bank sheltered under a small amber umbrella on a small round pastel stage"],
  ["learn-autoinvest", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A desk calendar with a small watering can dripping onto a coin sprout on a small round pastel stage"],
  ["learn-market", "1024x1024", 1024, 1024, MASCOT_STYLE,
    "A small brass telescope aimed at a mountain shaped like a rising line chart on a small round pastel stage"],
  ["role-student", "1024x1024", 640, null, MASCOT_STYLE,
    "The brown bear mascot wearing a school backpack waving hello in front of a soft pastel dashboard"],
  ["role-teacher", "1024x1024", 640, null, MASCOT_STYLE,
    "The brown bear mascot with round glasses holding a pointer beside a small blackboard with a simple rising chart"],
  ["role-parent", "1024x1024", 640, null, MASCOT_STYLE,
    "A larger gentle bear and a smaller bear cub looking together at a warm glowing report card"],
  ["role-admin", "1024x1024", 640, null, MASCOT_STYLE,
    "The brown bear mascot with a headset at a tidy mission-control desk with calm green status lights"],
  ["plan-trial", "1024x1024", 640, null, MASCOT_STYLE,
    "The brown bear mascot holding a small sprout in a terracotta pot, hopeful expression, minimal props"],
  ["plan-standard", "1024x1024", 640, null, MASCOT_STYLE,
    "The brown bear mascot presenting a neat open toolbox of softly glowing financial tools, confident"],
  ["plan-school", "1024x1024", 640, null, MASCOT_STYLE,
    "Three bear mascots as a tiny classroom team under a small pennant banner, collaborative and warm"],
  ["texture-market-dark", "1536x1024", 1536, 640, REAL_STYLE,
    "Abstract dark navy financial texture with faint warm amber candlestick glow lines and soft bokeh depth, very low contrast, suitable as a background behind white text"],
  ["texture-paper-light", "1536x1024", 1536, 640, REAL_STYLE,
    "Ultra subtle warm off-white paper texture with a faint amber geometric grid, nearly invisible pattern, background use"],
];

async function genOne([name, size, outW, outH, style, prompt]) {
  const out = path.join(OUT_DIR, `${name}.webp`);
  if (fs.existsSync(out)) { console.log(`[${name}] exists, skip`); return true; }
  for (let attempt = 0; attempt < ENDPOINTS.length; attempt += 1) {
    const endpoint = ENDPOINTS[attempt];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: "gpt-image-2", prompt: `${prompt}, ${style}`, n: 1, size }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) { console.error(`[${name}] HTTP ${res.status} via ${new URL(endpoint).host}`); continue; }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) { console.error(`[${name}] 无 b64_json`); continue; }
      const png = Buffer.from(b64, "base64");
      let img = sharp(png).resize({ width: outW });
      if (outH) img = sharp(png).resize({ width: outW, height: outH, fit: "cover" });
      const info = await img.webp({ quality: name.startsWith("hero") ? 80 : 78 }).toFile(out);
      console.log(`[${name}] ok ${Math.round(info.size / 1024)}KB`);
      return true;
    } catch (error) {
      console.error(`[${name}] ${String(error).slice(0, 140)} via ${new URL(endpoint).host}`);
    }
  }
  return false;
}

let ok = 0;
for (const asset of ASSETS) {
  if (await genOne(asset)) ok += 1;
}
console.log(`DONE ${ok}/${ASSETS.length}`);
process.exit(ok === ASSETS.length ? 0 : 1);
