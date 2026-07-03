/**
 * H4: lightweight per-process sliding-window rate limiter.
 *
 * Sufficient for single-instance dev/demo deployments. For multi-region
 * production replace the in-process Map with Upstash Redis / Vercel KV so
 * the bucket survives across function instances. The exported API stays the
 * same.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

/**
 * 测试基建旋钮：E2E 全套会用同一演示账号在几分钟内登录数十次，会确定性打爆
 * login-account 12 次/10 分钟 的限流（页面被重定向到 /demo，用例 120s 超时）。
 * 仅当显式设置 E2E_RATE_LIMIT_MULTIPLIER（由 playwright.config webServer.env 注入）
 * 时按倍数放宽所有 limit；生产/常规 dev 不设置该变量，行为完全不变。
 */
const LIMIT_MULTIPLIER = (() => {
  const raw = Number.parseInt(process.env.E2E_RATE_LIMIT_MULTIPLIER ?? "", 10);
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
})();

function effectiveLimit(limit: number) {
  return limit * LIMIT_MULTIPLIER;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, rawLimit: number, windowMs: number): RateLimitResult {
  const limit = effectiveLimit(rawLimit);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // Evict the oldest entry to keep memory bounded.
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/**
 * Check whether a key is still under its limit WITHOUT consuming a slot. Used to
 * gate an action on an existing failure counter (e.g. block a password-spraying
 * IP) while letting the actual attempt increment the counter only on failure —
 * so legitimate users sharing one NAT IP (a whole classroom) are never blocked
 * by each other's successful logins.
 */
export function peekRateLimit(key: string, rawLimit: number): boolean {
  const limit = effectiveLimit(rawLimit);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) return true;
  return bucket.count < limit;
}

/**
 * Best-effort trusted client IP for anonymous rate-limit keys.
 *
 * SECURITY: the *leftmost* `X-Forwarded-For` segment is CLIENT-CONTROLLED — an
 * attacker can rotate it every request to mint a fresh bucket, defeating the
 * anonymous spray/flood limits (login-ip-fail, register, forgot/reset password,
 * demo-login). Prefer the platform-injected `x-real-ip` (Vercel overwrites this
 * with the true TCP peer and it cannot be forged through the proxy); fall back
 * to the RIGHTMOST XFF segment (the hop appended by our trusted proxy), never the
 * leftmost. Last resort `"anon"` (local/no-proxy) is a single shared bucket —
 * still bounded, just coarse.
 */
export function clientIpFrom(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((segment) => segment.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "anon";
}

export function rateLimitKey(scope: string, sessionUserId: string | undefined, request: Request) {
  if (sessionUserId) return `${scope}:user:${sessionUserId}`;
  return `${scope}:ip:${clientIpFrom(request)}`;
}

/** Convenience: run rateLimit and produce a Chinese 429 message. */
export function buildRateLimitMessage(result: RateLimitResult) {
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return `请求过于频繁，请 ${seconds} 秒后再试。`;
}
