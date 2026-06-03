import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRateLimitMessage, rateLimit } from "@/lib/rate-limit";

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
