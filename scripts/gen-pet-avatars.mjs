// 生成萌宠工作室可切换 3D 形象（与 quest-world 12 只角色同风格，凑足 20+ 选择）。
// gpt-image-2（api.llm-token.cn 网关，国内低延迟）-> PNG(b64) -> WebP via sharp。Key 仅从 env 读取。
// Run: AI_API_KEY=$(grep '^AI_API_KEY=' .env.local | cut -d= -f2) node scripts/gen-pet-avatars.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const KEY = process.env.AI_API_KEY;
if (!KEY) { console.error("缺少 AI_API_KEY（从 .env.local 传入）。"); process.exit(2); }
const ENDPOINT = "https://api.llm-token.cn/v1/images/generations";
const OUT_DIR = "public/brand/pet-avatars";
fs.mkdirSync(OUT_DIR, { recursive: true });

const STYLE =
  "cute 3D clay render mascot for a kids financial-literacy app, single chubby round character, " +
  "big glossy eyes, soft pastel colors with warm golden accent, smooth studio lighting, " +
  "centered, plain soft dark navy background, high detail, Pixar-like, no text, no watermark";

const PETS = [
  ["dino", "a tiny friendly green baby dinosaur with small gold coin pattern on belly"],
  ["shiba", "a smiling shiba inu puppy wearing a tiny gold scarf"],
  ["tiger", "a baby tiger cub with a small piggy-bank charm"],
  ["hamster", "a chubby hamster holding a tiny golden acorn"],
  ["elephant", "a baby elephant with big gentle eyes and a tiny ledger book"],
  ["frog", "a cheerful round frog with a little green sprout hat"],
  ["unicorn", "a small pastel unicorn with a star-shaped golden badge"],
  ["bear", "a honey-colored bear cub hugging a small treasure chest"],
  ["koi", "a round friendly koi fish with golden scales, floating"],
  ["chick", "a fluffy yellow chick wearing tiny round glasses"],
];

const SIZES = ["1024x1024", "512x512"];

async function genOne(name, desc) {
  for (let attempt = 0; attempt < SIZES.length; attempt += 1) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: "gpt-image-2", prompt: `${desc}, ${STYLE}`, n: 1, size: SIZES[attempt] }),
      });
      if (!res.ok) { console.error(`[${name}] HTTP ${res.status} (size=${SIZES[attempt]})`); continue; }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) { console.error(`[${name}] 无 b64_json`); continue; }
      const png = Buffer.from(b64, "base64");
      const out = path.join(OUT_DIR, `pet-${name}.webp`);
      const info = await sharp(png).resize({ width: 512, height: 512, fit: "cover" }).webp({ quality: 82 }).toFile(out);
      console.log(`[${name}] ok ${Math.round(info.size / 1024)}KB`);
      return true;
    } catch (error) {
      console.error(`[${name}] ${String(error).slice(0, 120)}`);
    }
  }
  return false;
}

let ok = 0;
for (const [name, desc] of PETS) {
  if (await genOne(name, desc)) ok += 1;
}
console.log(`DONE ${ok}/${PETS.length}`);
process.exit(ok > 0 ? 0 : 1);
