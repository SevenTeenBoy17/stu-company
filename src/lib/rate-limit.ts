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

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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
export function peekRateLimit(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) return true;
  return bucket.count < limit;
}

export function rateLimitKey(scope: string, sessionUserId: string | undefined, request: Request) {
  if (sessionUserId) return `${scope}:user:${sessionUserId}`;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  return `${scope}:ip:${ip}`;
}

/** Convenience: run rateLimit and produce a Chinese 429 message. */
export function buildRateLimitMessage(result: RateLimitResult) {
  const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return `请求过于频繁，请 ${seconds} 秒后再试。`;
}
