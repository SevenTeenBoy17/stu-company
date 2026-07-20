// @vitest-environment node
//
// itest7 P3：令牌吊销此前只做源码字符串审计（session-security-regression），从未【行为】验证
// 「登出后旧 cookie 失效」。若重构把 tokenVersion 比较写反（=== 而非 !==）或漏 await bump，
// 字符串审计仍绿，但旧 cookie 会继续可用。此处直接驱动 requireUser 的 tv 校验主路径。

import { beforeEach, describe, expect, it, vi } from "vitest";

const readSession = vi.fn();
const findUserById = vi.fn();

vi.mock("@/lib/auth", () => ({ readSession: () => readSession() }));
vi.mock("@/lib/db/repo", () => ({
  findUserById: (id: string) => findUserById(id),
  // requireUser 会对通过校验的用户套用家庭权益；测试里原样返回即可。
  applyFamilyEntitlement: (user: unknown) => user,
}));

const baseUser = {
  id: "u1",
  email: "student@brownzone.ai",
  role: "student" as const,
  name: "学生",
  classroomId: "class-1",
};

describe("令牌吊销行为：bump 后旧 tv 的 cookie 失效 (itest7 P3)", () => {
  beforeEach(() => {
    readSession.mockReset();
    findUserById.mockReset();
  });

  it("旧 cookie(tv=0) 在服务端 tokenVersion 已 bump 到 1 后 → 401 unauthorized", async () => {
    const { requireUser } = await import("@/lib/api-guard");
    readSession.mockResolvedValue({ userId: "u1", role: "student", tv: 0 });
    findUserById.mockResolvedValue({ ...baseUser, tokenVersion: 1 }); // 已登出/改密后 bump
    const auth = await requireUser();
    expect(auth.error).toBeDefined();
    expect(auth.user).toBeUndefined();
    const body = (await auth.error!.json()) as { error: string };
    expect(auth.error!.status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("tv 匹配(cookie tv=1 == 服务端 tokenVersion=1) → 放行，返回 user", async () => {
    const { requireUser } = await import("@/lib/api-guard");
    readSession.mockResolvedValue({ userId: "u1", role: "student", tv: 1 });
    findUserById.mockResolvedValue({ ...baseUser, tokenVersion: 1 });
    const auth = await requireUser();
    expect(auth.error).toBeUndefined();
    expect(auth.user?.id).toBe("u1");
  });

  it("缺省 tv 视为 0：服务端 tokenVersion=0 且 cookie 无 tv → 放行（不误杀历史 cookie）", async () => {
    const { requireUser } = await import("@/lib/api-guard");
    readSession.mockResolvedValue({ userId: "u1", role: "student" }); // 无 tv
    findUserById.mockResolvedValue({ ...baseUser }); // 无 tokenVersion → 0
    const auth = await requireUser();
    expect(auth.error).toBeUndefined();
    expect(auth.user?.id).toBe("u1");
  });
});
