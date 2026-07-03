import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRateLimitMessage, clientIpFrom, rateLimit, rateLimitKey } from "@/lib/rate-limit";

// TEST-STRATEGY §4 R5: the limiter is a correct per-process sliding window — and
// the tests double as the executable record of its single-instance limitation
// (counts are NOT shared across serverless instances; swap for Redis/KV before
// multi-region). rateLimit reads Date.now(), so we drive it with fake timers.

describe("rateLimit sliding window (R5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to `limit` requests then blocks the next", () => {
    const key = "r5:allow-then-block";
    expect(rateLimit(key, 3, 1000)).toMatchObject({ ok: true, remaining: 2 });
    expect(rateLimit(key, 3, 1000)).toMatchObject({ ok: true, remaining: 1 });
    expect(rateLimit(key, 3, 1000)).toMatchObject({ ok: true, remaining: 0 });

    const blocked = rateLimit(key, 3, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets once the window elapses", () => {
    const key = "r5:reset";
    expect(rateLimit(key, 1, 1000).ok).toBe(true); // count = 1, resetAt = 1000
    expect(rateLimit(key, 1, 1000).ok).toBe(false); // blocked within window
    vi.setSystemTime(1001); // past resetAt
    expect(rateLimit(key, 1, 1000).ok).toBe(true); // window rolled over
  });

  it("counts retryAfterMs down within the window", () => {
    const key = "r5:retry";
    rateLimit(key, 1, 1000); // resetAt = 1000
    vi.setSystemTime(300);
    expect(rateLimit(key, 1, 1000).retryAfterMs).toBe(700); // 1000 - 300
  });

  it("stays bounded and responsive past MAX_TRACKED_KEYS (5000)", () => {
    for (let i = 0; i < 5_050; i++) rateLimit(`r5:flood:${i}`, 5, 1000);
    // A brand-new key after the flood still works — eviction kept memory bounded.
    expect(rateLimit("r5:flood:fresh", 5, 1000).ok).toBe(true);
  });
});

describe("buildRateLimitMessage", () => {
  it("rounds retryAfterMs up to whole seconds (minimum 1)", () => {
    expect(buildRateLimitMessage({ ok: false, remaining: 0, retryAfterMs: 1500 })).toContain("2 秒");
    expect(buildRateLimitMessage({ ok: false, remaining: 0, retryAfterMs: 0 })).toContain("1 秒");
  });
});

// itest4 R3 P1 回归锁：匿名限流键必须取平台注入的可信 IP，不能取客户端可写的
// X-Forwarded-For 最左段——否则轮换 XFF 即可每次拿到新桶，绕过撞库/刷注册/刷改密防护。
describe("clientIpFrom — anti-spoof IP derivation (itest4 R3 P1)", () => {
  const reqWith = (headers: Record<string, string>) => new Request("https://x/api", { headers });

  it("prefers x-real-ip (platform-injected) over a spoofed leftmost XFF", () => {
    const req = reqWith({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 203.0.113.7" });
    expect(clientIpFrom(req)).toBe("203.0.113.7");
  });

  it("a rotating leftmost XFF cannot change the key when x-real-ip is stable", () => {
    const a = rateLimitKey("login-ip-fail", undefined, reqWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }));
    const b = rateLimitKey("login-ip-fail", undefined, reqWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "2.2.2.2" }));
    expect(a).toBe(b);
    expect(a).toBe("login-ip-fail:ip:9.9.9.9");
  });

  it("without x-real-ip, uses the RIGHTMOST XFF hop (trusted-proxy end), never the leftmost", () => {
    const req = reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.9" });
    expect(clientIpFrom(req)).toBe("10.0.0.9");
  });

  it("falls back to a single shared 'anon' bucket when no IP header is present", () => {
    expect(clientIpFrom(reqWith({}))).toBe("anon");
  });

  it("a session user id always keys per-user (IP headers irrelevant)", () => {
    const key = rateLimitKey("scope", "user-1", reqWith({ "x-forwarded-for": "6.6.6.6" }));
    expect(key).toBe("scope:user:user-1");
  });
});
