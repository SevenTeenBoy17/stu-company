// UI v3（学生端图文卡）素材批量生产 —— docs/ui-v3/01-student-text-audit.md 末节「素材计划表 B」的 6 张清单。
// gpt-image-2 -> PNG(b64) -> WebP via sharp。风格延续 public/brand/v2（3D 萌宠棕熊 × 写实渲染混合）。
// Key 仅从 .env.local 的 AI_API_KEY 读取（绝不落盘、不打印、不上命令行）。
// Run: node scripts/gen-ui-v3-assets.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import sharp from "sharp";

dns.setDefaultResultOrder("ipv4first");

// 无论从哪个 cwd 调用，都相对仓库根解析路径（scripts/ 的上一级）。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// —— 密钥只从 .env.local 读，且只读 AI_API_KEY 这一行。不写文件、不打印明文。——
function readKeyFromEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  let raw;
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch {
    return "";
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?AI_API_KEY\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[1].trim();
    // 去掉可能的成对引号
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v.trim();
  }
  return "";
}

const KEY = readKeyFromEnvLocal();
if (!KEY) {
  console.error("缺少 AI_API_KEY（应在仓库根 .env.local 中）。");
  process.exit(2);
}

// 直连 gpt-agent.cc 为指定主网关；沿用 v2 的双网关故障转移，llm-token.cn 为同 key 备用。
// 2026-07-21 现场复核：gpt-agent.cc 的 TLS 握手被 ECONNRESET（其 DNS 指向本地代理 fake-ip
// 198.18.0.205，上游隧道被重置，网络层不可达），而 llm-token.cn TLS+HTTP 可达（401 拒空鉴权）。
// 故顺序=先按指令打 gpt-agent.cc，失败再落 llm-token.cn。每请求带超时，避免网关挂死拖死整批。
const ENDPOINTS = [
  "https://gpt-agent.cc/v1/images/generations",
  "https://api.llm-token.cn/v1/images/generations",
];
const REQUEST_TIMEOUT_MS = 210_000;
const OUT_DIR = path.join(ROOT, "public/brand/v3");
const MAX_KB = 80; // 单图体积上限（目标 ≤80KB）
fs.mkdirSync(OUT_DIR, { recursive: true });

// 风格锚（与 v2 一致的暖橙/深墨底、柔和棚拍光、圆润 3D 棕熊主角），统一整批质感并强制无文字。
const V3_STYLE =
  "consistent friendly 3D brown bear financial-education mascot brand, warm amber (#f08a38) accents, " +
  "soft studio lighting, realistic soft-toy render blended with clean 3D, generous negative space, " +
  "no text, no readable letters, no watermark";

// [file, apiSize, outWidth, outHeight, prompt]（提示词取自审计计划表 B，微润色）
const ASSETS = [
  ["rp-empty-persona", "1536x1024", 800, 600,
    "3D rendered friendly brown bear mascot in warm amber studio light, peeking curiously at a face-down glowing tarot-style scenario card and a small brass compass on a soft desk, cozy realistic-toy hybrid style, deep navy-to-amber gradient background, soft rim light, empty-state illustration"],
  ["wealth-life-map", "1536x1024", 900, 500,
    "3D brown bear mascot standing on a small balance beam juggling four glowing floating islands marked only by icon (piggy-bank, rocket, house, warning-coin), warm amber and teal palette, realistic soft-toy render, dark ink background with a subtle grid"],
  ["market-readonly-deck", "1024x1024", 640, 640,
    "3D brown bear mascot with paws politely behind its back, watching a wall of glowing stock ticker cards, look-but-do-not-touch read-only mood, warm studio light, amber-to-navy gradient, realistic toy render, square composition"],
  ["watchlist-why", "1024x1024", 640, 640,
    "3D brown bear mascot writing a short sticky note beside a small candlestick chart, thoughtful pose holding a pencil, warm amber light, soft realistic-toy render, navy background, square composition"],
  ["history-trend-lens", "1536x1024", 900, 500,
    "3D brown bear mascot holding a magnifying glass over a glowing rising-then-dipping net-worth line on a dark chart, calm analytical mood, warm amber highlight on the line, realistic soft-toy render, wide composition"],
  ["autoinvest-dca-vs-lump", "1536x1024", 900, 500,
    "3D brown bear mascot beside two side-by-side glowing stacks of coins, one built gradually in small steps and one dropped in a single pile, neutral comparison mood, warm amber and slate palette, realistic toy render"],
  // 全局 AI 助手悬浮球吉祥物：圆形构图、半身特写、贴近圆边（供圆形按钮裁切），512×512。
  ["ai-assistant-mascot", "1024x1024", 512, 512,
    "3D rendered friendly cute Mr.Brown brown bear mascot, upper-body bust close-up portrait centered in a tight circular composition, wearing a cozy warm amber-orange hoodie and a customer-support headset with boom mic, a small glowing round AI emblem badge on its chest (icon only, no letters), one shiny gold coin resting beside a paw and a small softly upward-rising golden mini curve line at its side, clean deep navy background, full composition filling close to the circular edge for a round floating-button crop, cute but restrained expression, soft studio key light"],
];

// 自适应质量编码：从 q82 起步，若超过 MAX_KB 逐级降质，保证 ≤80KB。
async function encodeUnderCap(png, outW, outH, out) {
  let quality = 82;
  let info;
  for (;;) {
    const pipeline = sharp(png).resize({ width: outW, height: outH, fit: "cover" });
    info = await pipeline.webp({ quality }).toFile(out);
    if (info.size / 1024 <= MAX_KB || quality <= 46) break;
    quality -= 8;
  }
  return { info, quality };
}

async function genOne([name, size, outW, outH, prompt]) {
  const out = path.join(OUT_DIR, `${name}.webp`);
  if (fs.existsSync(out)) { console.log(`[${name}] exists, skip`); return true; }
  for (let attempt = 0; attempt < ENDPOINTS.length; attempt += 1) {
    const endpoint = ENDPOINTS[attempt];
    const host = new URL(endpoint).host;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: "gpt-image-2", prompt: `${prompt}, ${V3_STYLE}`, n: 1, size }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[${name}] HTTP ${res.status} via ${host} ${body.slice(0, 160)}`);
        continue;
      }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) { console.error(`[${name}] 无 b64_json via ${host}（键：${Object.keys(data || {}).join(",")}）`); continue; }
      const png = Buffer.from(b64, "base64");
      const { info, quality } = await encodeUnderCap(png, outW, outH, out);
      console.log(`[${name}] ok ${outW}x${outH} ${Math.round(info.size / 1024)}KB q${quality} via ${host}`);
      return true;
    } catch (error) {
      console.error(`[${name}] ${String(error).slice(0, 160)} via ${host}`);
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
