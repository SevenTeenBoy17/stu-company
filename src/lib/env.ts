import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().optional(),
  SESSION_SECRET:
    process.env.NODE_ENV === "production"
      ? z.string().min(32, "SESSION_SECRET must be ≥32 chars in production")
      : z.string().min(16).optional(),
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL_PRIMARY: z.string().url().optional(),
  AI_BASE_URL_SECONDARY: z.string().url().optional(),
  BROWN_AGENT_API_KEY: z.string().optional(),
  BROWN_AGENT_BASE_URL: z.string().url().optional(),
  BROWN_AGENT_FALLBACK_BASE_URL: z.string().url().optional(),
  ITICK_API_TOKEN: z.string().optional(),
  ITICK_REST_BASE_URL: z.string().url().optional(),
  ITICK_STOCK_WS_URL: z.string().url().optional(),
  ALLTICK_API_KEY: z.string().optional(),
  ALLTICK_STOCK_BASE_URL: z.string().url().optional(),
  // Tsanghi (沧海数据) global financial data — real EOD/daily bars for the
  // student market board. Base host is www.tsanghi.com/api/fin (NOT
  // api.tsanghi.com). Optional: when absent the market layer falls through to
  // iTick → AllTick → teaching fallback.
  TSANGHI_API_TOKEN: z.string().optional(),
  TSANGHI_REST_BASE_URL: z.string().url().optional(),
  // Transactional email (Resend) for verification + password reset. Optional:
  // when absent, those flows degrade to dev-surfaced links.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  // Shared secret for the Vercel Cron endpoints (weekly-report / recompute-leaderboard).
  // itest7/itest8 部署审计：建议 ≥32 位，但【不】用 zod 硬失败——一个偏短的 cron 令牌是轻微问题
  // （blast radius 限于写放大/邮件、且 timingSafeEqual 已挡计时攻击），不值得让【整个应用】因它 boot
  // 失败（对比 SESSION_SECRET 关乎全站 auth 才硬失败）。改为启动期【打警告不阻断】（见下方 env 解析后）。
  CRON_SECRET: z.string().optional(),
  TRUSTED_PROXY: z.enum(["vercel", "xff-rightmost", "none"]).default("vercel"),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  AI_BASE_URL_PRIMARY: process.env.AI_BASE_URL_PRIMARY,
  AI_BASE_URL_SECONDARY: process.env.AI_BASE_URL_SECONDARY,
  BROWN_AGENT_API_KEY: process.env.BROWN_AGENT_API_KEY,
  BROWN_AGENT_BASE_URL: process.env.BROWN_AGENT_BASE_URL,
  BROWN_AGENT_FALLBACK_BASE_URL: process.env.BROWN_AGENT_FALLBACK_BASE_URL,
  ITICK_API_TOKEN: process.env.ITICK_API_TOKEN,
  ITICK_REST_BASE_URL: process.env.ITICK_REST_BASE_URL,
  ITICK_STOCK_WS_URL: process.env.ITICK_STOCK_WS_URL,
  ALLTICK_API_KEY: process.env.ALLTICK_API_KEY,
  ALLTICK_STOCK_BASE_URL: process.env.ALLTICK_STOCK_BASE_URL,
  TSANGHI_API_TOKEN: process.env.TSANGHI_API_TOKEN,
  TSANGHI_REST_BASE_URL: process.env.TSANGHI_REST_BASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  CRON_SECRET: process.env.CRON_SECRET,
  TRUSTED_PROXY: process.env.TRUSTED_PROXY,
});

// itest8 部署审计：生产下 CRON_SECRET 偏短只打警告、不阻断启动（避免一个弱 cron 令牌把整个应用
// boot 拦下）。运维应据此轮换为 ≥32 位随机串以增强 /api/cron/* 鉴权强度。
if (process.env.NODE_ENV === "production" && env.CRON_SECRET && env.CRON_SECRET.length < 32) {
  console.warn(
    "[env] CRON_SECRET 少于 32 位：建议轮换为 ≥32 位随机串（openssl rand -hex 24），以增强 cron 端点鉴权强度。",
  );
}
