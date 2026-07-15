import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRateLimitMessage, rateLimit } from "@/lib/rate-limit";

// TEST-STRATEGY R5: the limiter is a correct per-process sliding window. The
// tests also document that counts are not shared across serverless instances;
// swap the in-process Map for Redis/KV before relying on global production caps.

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
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);
    vi.setSystemTime(1001);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
  });

  it("counts retryAfterMs down within the window", () => {
    const key = "r5:retry";
    rateLimit(key, 1, 1000);
    vi.setSystemTime(300);
    expect(rateLimit(key, 1, 1000).retryAfterMs).toBe(700);
  });

  it("stays bounded and responsive past MAX_TRACKED_KEYS (5000)", () => {
    for (let i = 0; i < 5_050; i++) rateLimit(`r5:flood:${i}`, 5, 1000);
    expect(rateLimit("r5:flood:fresh", 5, 1000).ok).toBe(true);
  });
});

describe("buildRateLimitMessage", () => {
  it("rounds retryAfterMs up to whole seconds (minimum 1)", () => {
    expect(buildRateLimitMessage({ ok: false, remaining: 0, retryAfterMs: 1500 })).toContain("2");
    expect(buildRateLimitMessage({ ok: false, remaining: 0, retryAfterMs: 0 })).toContain("1");
  });
});

describe("clientIpFrom trusted proxy modes", () => {
  const reqWith = (headers: Record<string, string>) => new Request("https://x/api", { headers });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadLimiter(mode: "vercel" | "xff-rightmost" | "none") {
    vi.resetModules();
    vi.stubEnv("TRUSTED_PROXY", mode);
    return import("@/lib/rate-limit");
  }

  it("vercel mode trusts x-real-ip and ignores client-supplied XFF fallback", async () => {
    const { clientIpFrom, rateLimitKey } = await loadLimiter("vercel");

    expect(clientIpFrom(reqWith({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIpFrom(reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.9" }))).toBe("anon");

    const a = rateLimitKey("login-ip-fail", undefined, reqWith({ "x-forwarded-for": "1.1.1.1" }));
    const b = rateLimitKey("login-ip-fail", undefined, reqWith({ "x-forwarded-for": "2.2.2.2" }));
    expect(a).toBe(b);
    expect(a).toBe("login-ip-fail:ip:anon");
  });

  it("xff-rightmost mode preserves explicit trusted-proxy rightmost-hop behavior", async () => {
    const { clientIpFrom, rateLimitKey } = await loadLimiter("xff-rightmost");

    expect(clientIpFrom(reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.9" }))).toBe("10.0.0.9");

    const a = rateLimitKey(
      "register",
      undefined,
      reqWith({ "x-forwarded-for": "1.1.1.1, 10.0.0.9" }),
    );
    const b = rateLimitKey(
      "register",
      undefined,
      reqWith({ "x-forwarded-for": "2.2.2.2, 10.0.0.9" }),
    );
    expect(a).toBe(b);
    expect(a).toBe("register:ip:10.0.0.9");
  });

  it("none mode ignores all IP headers so rotating XFF cannot mint new anonymous buckets", async () => {
    const { clientIpFrom, rateLimitKey } = await loadLimiter("none");

    expect(clientIpFrom(reqWith({ "x-real-ip": "203.0.113.7" }))).toBe("anon");
    expect(clientIpFrom(reqWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.9" }))).toBe("anon");

    const a = rateLimitKey("forgot-password", undefined, reqWith({ "x-forwarded-for": "1.1.1.1" }));
    const b = rateLimitKey("forgot-password", undefined, reqWith({ "x-forwarded-for": "2.2.2.2" }));
    expect(a).toBe(b);
    expect(a).toBe("forgot-password:ip:anon");
  });

  it("a session user id always keys per-user regardless of proxy mode", async () => {
    const { rateLimitKey } = await loadLimiter("none");

    const key = rateLimitKey("scope", "user-1", reqWith({ "x-forwarded-for": "6.6.6.6" }));
    expect(key).toBe("scope:user:user-1");
  });
});
