// Generate the 12 industry illustrations ("行业示意图") for the market-radar categories.
// Uses gpt-image-2 via the gpt-agent.cc OpenAI-compatible gateway (key from AI_API_KEY / .env.local).
// Idempotent: skips an industry whose PNG already exists. Concurrency-limited + retried.
// Run: node scripts/gen-market-images.mjs            (all)
//      node scripts/gen-market-images.mjs semiconductor cloud-software   (subset)
import { writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "market", "industries");
// 密钥只从环境变量读取，绝不硬编码进仓库。运行前：  $env:AI_API_KEY="<key>"; node scripts/gen-market-images.mjs
const KEY = process.env.AI_API_KEY;
if (!KEY) {
  console.error("缺少 AI_API_KEY 环境变量。请先设置后再运行（图片已生成时无需重跑）。");
  process.exit(2);
}
const ENDPOINTS = [
  "https://gpt-agent.cc/v1/images/generations",
  "https://gpt-agent.cc/v1/images/generations", // retry same host
];
const SIZES = ["1536x1024", "1024x1024"]; // prefer 3:2 banner, fall back to square

const STYLE =
  "Flat minimal vector editorial illustration, soft gradients, rounded geometric shapes, " +
  "warm amber-gold (#E8A33D) and deep ink-navy (#16213A) accents on a clean cream background, " +
  "centered balanced composition, subtle depth, modern fintech-education aesthetic, " +
  "NO text, NO words, NO numbers, NO brand logos, NO ticker symbols. Subject: ";

const INDUSTRIES = [
  ["semiconductor", "a glowing semiconductor microchip and silicon wafer with circuit traces, symbolizing AI computing power"],
  ["cloud-software", "a stylized cloud with server racks and floating enterprise dashboard panels, symbolizing cloud computing and SaaS"],
  ["ai-platform", "a neural-network brain with flowing data nodes plus search and social feed icons, symbolizing internet AI platforms"],
  ["ev-robotics", "a sleek electric car, a battery module and a friendly robotic arm, symbolizing new-energy vehicles and smart manufacturing"],
  ["baijiu", "an elegant Chinese baijiu liquor bottle and small cups with wheat ears and a traditional ceramic fermentation jar, symbolizing premium consumer goods"],
  ["finance", "a bank building, a protective shield, balanced scales and stacked coins, symbolizing stable banking and insurance"],
  ["utility-dividend", "a hydroelectric dam, power transmission towers and steady upward dividend coins, symbolizing utilities and high dividends"],
  ["ecommerce", "shopping parcels, a delivery van and an online shopping cart, symbolizing e-commerce and consumption"],
  ["telecom", "a 5G signal tower emitting waves over fiber-optic network lines, symbolizing telecom infrastructure"],
  ["consumer-electronics", "a smartphone, a smart-watch and connected IoT devices, symbolizing consumer electronics"],
  ["broad-index", "a woven basket holding many diverse colorful assets with a rising line chart behind it, symbolizing a diversified broad index fund"],
  ["overseas-tech-index", "a globe wrapped by a rising technology stock curve and a basket of tech shares, symbolizing overseas technology index ETFs"],
];

const only = process.argv.slice(2);
const targets = only.length ? INDUSTRIES.filter(([k]) => only.includes(k)) : INDUSTRIES;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function genOne(key, subject) {
  // 直接产出与 market-catalog.ts 引用一致的 .webp（resize 1024 + q80，约 40KB）。
  const file = join(OUT_DIR, `${key}.webp`);
  if (existsSync(file) && statSync(file).size > 8_000) {
    console.log(`SKIP  ${key} (exists ${(statSync(file).size / 1024) | 0}KB)`);
    return { key, ok: true, skipped: true };
  }
  const prompt = STYLE + subject + ". 3:2 landscape banner.";
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = ENDPOINTS[Math.min(attempt, ENDPOINTS.length - 1)];
    const size = SIZES[Math.min(attempt, SIZES.length - 1)];
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 120_000);
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
        body: JSON.stringify({ model: "gpt-image-2", prompt, n: 1, size }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      if (!r.ok) {
        console.log(`  ${key} attempt ${attempt + 1} HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
        continue;
      }
      const j = await r.json();
      const b64 = j?.data?.[0]?.b64_json;
      const remote = j?.data?.[0]?.url;
      let buf = null;
      if (b64) buf = Buffer.from(b64, "base64");
      else if (remote) buf = Buffer.from(await (await fetch(remote)).arrayBuffer());
      if (!buf || buf.length < 20_000) {
        console.log(`  ${key} attempt ${attempt + 1}: empty/too-small image`);
        continue;
      }
      const webp = await sharp(buf).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      writeFileSync(file, webp);
      console.log(`OK    ${key} -> ${(webp.length / 1024) | 0}KB webp (from ${size} png)`);
      return { key, ok: true };
    } catch (e) {
      console.log(`  ${key} attempt ${attempt + 1} ERR ${e.message}`);
    }
  }
  console.log(`FAIL  ${key}`);
  return { key, ok: false };
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

(async () => {
  console.log(`# generating ${targets.length} industry images -> ${OUT_DIR}`);
  const res = await pool(targets, 3, ([k, s]) => genOne(k, s));
  const ok = res.filter((r) => r?.ok).length;
  const fail = res.filter((r) => r && !r.ok).map((r) => r.key);
  console.log(`\n=== ${ok}/${targets.length} ok${fail.length ? ", FAILED: " + fail.join(", ") : ""} ===`);
  process.exit(fail.length ? 1 : 0);
})();
