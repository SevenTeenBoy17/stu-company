// @vitest-environment node
//
// itest7 P2：登录 DoS 缓解（peekRateLimit + 仅失败消费 + email+IP 键隔离）此前零测试。回归把
// peek 换回 rateLimit（每次尝试都消费）、或边界 `<` 改 `<=`、或成功分支也消费，都会让受害者账号
// 被 12 次错误密码锁死、正确密码同样 429（正是修复前的缺陷），而现有测试全绿。此处锁死该行为。

import { afterEach, describe, expect, it, vi } from "vitest";

import { peekRateLimit, rateLimit } from "@/lib/rate-limit";

const authenticateUser = vi.fn();
vi.mock("@/lib/db/repo", () => ({
  authenticateUser: (email: string, pw: string) => authenticateUser(email, pw),
  roleHomePath: () => "/student",
}));
vi.mock("@/lib/auth", () => ({ persistSession: vi.fn() }));

function loginReq(email: string, password: string, ip: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify({ email, password }),
  });
}

describe("peekRateLimit 原语 (itest7 P2)", () => {
  it("count<limit → true；count==limit → false；且 peek 不消耗名额", () => {
    const key = "peek-unit-key";
    // peek 不创建/不增加 bucket：连续 peek 后预算仍是满的。
    expect(peekRateLimit(key, 3)).toBe(true);
    expect(peekRateLimit(key, 3)).toBe(true);
    expect(peekRateLimit(key, 3)).toBe(true);
    // 真正消费 3 次（此时才建桶）。
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    // count==limit → peek 判否，后续消费被拒。
    expect(peekRateLimit(key, 3)).toBe(false);
    expect(rateLimit(key, 3, 10_000).ok).toBe(false);
  });
});

describe("登录 DoS 隔离：email+IP 键 + peek + 仅失败消费 (itest7 P2)", () => {
  afterEach(() => authenticateUser.mockReset());

  it("攻击者错密码打满(email+IP1)→第13次429；受害者正确密码从 IP2 仍 200；攻击者本 IP 正确密码仍 429", async () => {
    authenticateUser.mockImplementation((_email: string, pw: string) =>
      Promise.resolve(
        pw === "correct-pw"
          ? { id: "u1", role: "student", email: "dos@x.com", classroomId: null, tokenVersion: 0 }
          : null,
      ),
    );
    const { POST } = await import("@/app/api/auth/login/route");
    const email = "dos-unit-victim@x.com";
    const attackerIp = "10.9.9.1";
    const victimIp = "10.9.9.2";

    let first429 = -1;
    for (let i = 1; i <= 13; i += 1) {
      const res = await POST(loginReq(email, "wrong-pw", attackerIp));
      if (res.status === 429 && first429 < 0) first429 = i;
    }
    // 12 次错误密码放行(401)，第 13 次账户+IP1 桶打满 → 429。
    expect(first429).toBe(13);

    // 关键隔离：受害者用【正确密码】从【另一个 IP】登录 → 200（未被攻击者锁死）。
    const victim = await POST(loginReq(email, "correct-pw", victimIp));
    expect(victim.status).toBe(200);

    // 佐证：攻击者本 IP 即便用对密码也仍 429（锁真实、且 peek 在校验前拦下，仅困住攻击者自己）。
    const attackerCorrect = await POST(loginReq(email, "correct-pw", attackerIp));
    expect(attackerCorrect.status).toBe(429);
  });

  it("正确密码在有历史失败时永不被 429（成功分支不消耗账户预算）", async () => {
    authenticateUser.mockImplementation((_email: string, pw: string) =>
      Promise.resolve(pw === "correct-pw" ? { id: "u2", role: "student", email: "ok@x.com", classroomId: null, tokenVersion: 0 } : null),
    );
    const { POST } = await import("@/app/api/auth/login/route");
    const email = "repeat-login@x.com";
    const ip = "10.9.9.3";
    // 少量失败（未打满）后，反复用正确密码登录多次都应 200——成功不消耗账户桶。
    await POST(loginReq(email, "wrong-pw", ip));
    await POST(loginReq(email, "wrong-pw", ip));
    for (let i = 0; i < 20; i += 1) {
      const res = await POST(loginReq(email, "correct-pw", ip));
      expect(res.status).toBe(200);
    }
  });
});
