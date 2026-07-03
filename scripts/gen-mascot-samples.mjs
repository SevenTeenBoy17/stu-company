// One-off: generate SAMPLE designer-toy mascot / reward visuals for the 任务中心 UI dev doc.
// Reference aesthetic = POP-MART blind-box / designer-toy collectible (the 4 参考图):
// 3D claymation render, vibrant solid backgrounds, big expressive eyes, finance-education themed.
// gpt-image-2 (gpt-agent.cc gateway) -> PNG (b64) -> WebP via sharp. Key from env only.
// Run: AI_API_KEY=$(grep '^AI_API_KEY=' .env.local | cut -d= -f2) node scripts/gen-mascot-samples.mjs
import { writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "ui-spec", "task-center", "assets");
const KEY = process.env.AI_API_KEY;
if (!KEY) { console.error("缺少 AI_API_KEY（从 .env.local 传入）。"); process.exit(2); }
const ENDPOINT = "https://gpt-agent.cc/v1/images/generations";
const SIZES = ["1024x1024", "1024x1024"];

const STYLE =
  "POP-MART blind-box designer-toy collectible aesthetic, 3D claymation soft render, smooth matte clay texture, " +
  "big glossy expressive eyes, rounded friendly chibi proportions, studio rim lighting and soft shadows, " +
  "single bold vibrant solid-color background, centered full-body hero composition, premium product render, " +
  "high detail, NO text, NO words, NO logo, NO watermark. Subject: ";

// Finance-literacy themed mascots mapped to the app's teaching concepts (each = one rarity/role).
const SAMPLES = [
  ["mascot-steady-bear", "a chubby calm bear mascot wearing a small forest-green knit scarf and hugging a tiny golden shield, symbolizing steady defensive investing, on a teal solid background"],
  ["mascot-compound-turtle", "a cute round turtle mascot whose shell is a glowing amber spiral of stacked coins, symbolizing long-term compounding, on a warm amber-gold solid background"],
  ["mascot-diversify-squirrel", "a cheerful squirrel mascot holding a woven basket full of many colorful coins and acorns, symbolizing diversification, on a soft coral-pink solid background"],
  ["mascot-calm-observer-cat", "a cool composed cat mascot wearing tiny round glasses, sitting in a zen pose observing a small floating chart, symbolizing the calm observer, on a deep ink-navy solid background"],
  ["reward-burst-hero", "a celebratory gacha reward reveal — a single glowing collectible card floating and bursting outward with golden confetti, sparkles and soft light rays, premium festive mood, on a warm radial-glow background"],
];

const only = process.argv.slice(2);
const targets = only.length ? SAMPLES.filter(([k]) => only.includes(k)) : SAMPLES;
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function genOne(key, subject) {
  const file = join(OUT_DIR, `${key}.webp`);
  if (existsSync(file) && statSync(file).size > 8_000) { console.log(`SKIP  ${key}`); return { key, ok: true }; }
  const prompt = STYLE + subject + ".";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 120_000);
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + KEY },
        body: JSON.stringify({ model: "gpt-image-2", prompt, n: 1, size: SIZES[Math.min(attempt, SIZES.length - 1)] }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      if (!r.ok) { console.log(`  ${key} attempt ${attempt + 1} HTTP ${r.status}`); continue; }
      const j = await r.json();
      const b64 = j?.data?.[0]?.b64_json;
      const buf = b64 ? Buffer.from(b64, "base64") : (j?.data?.[0]?.url ? Buffer.from(await (await fetch(j.data[0].url)).arrayBuffer()) : null);
      if (!buf || buf.length < 20_000) { console.log(`  ${key} empty`); continue; }
      const webp = await sharp(buf).resize({ width: 768, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      writeFileSync(file, webp);
      console.log(`OK    ${key} -> ${(webp.length / 1024) | 0}KB`);
      return { key, ok: true };
    } catch (e) { console.log(`  ${key} attempt ${attempt + 1} ERR ${e.message}`); }
  }
  console.log(`FAIL  ${key}`); return { key, ok: false };
}

async function pool(items, size, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } }));
  return out;
}

(async () => {
  console.log(`# generating ${targets.length} mascot samples -> ${OUT_DIR}`);
  const res = await pool(targets, 3, ([k, s]) => genOne(k, s));
  const ok = res.filter((r) => r?.ok).length;
  console.log(`\n=== ${ok}/${targets.length} ok ===`);
  process.exit(res.some((r) => r && !r.ok) ? 1 : 0);
})();
