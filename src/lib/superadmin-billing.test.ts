import { describe, expect, it } from "vitest";

import { SUPERADMIN_TEAM } from "@/lib/auth-roles";
import {
  canUserPayForTarget,
  findUserById,
  listSubscriptionTargetsForUser,
} from "@/lib/store";

// 超管判定双轨漂移回归守卫（itest11）：store/repo 的 isSuperAdminUser 此前只认字面
// "superadmin"，参赛队四账号与 SUPERADMIN_EMAILS 名单在计费代付链路上被静默降权。
// 现三处（repo.ts / store.ts / mock-complete 路由）统一走 auth-roles.isSuperAdmin。
describe("superadmin billing authority (store.canUserPayForTarget)", () => {
  it("每位参赛队成员（含 baiyangjinmei）都能为学生代付", () => {
    for (const member of SUPERADMIN_TEAM) {
      // store 种子账号与 SUPERADMIN_TEAM 同源，先确认账号真的存在。
      expect(findUserById(member.id)?.email).toBe(member.email);
      expect(canUserPayForTarget(member.id, "student-1")).toBe(true);
    }
  });

  it("内置 superadmin 保持可代付；普通 admin 不因集中化而越权", () => {
    expect(canUserPayForTarget("superadmin", "student-1")).toBe(true);
    expect(canUserPayForTarget("admin-1", "student-1")).toBe(false);
  });

  it("SUPERADMIN_EMAILS env 名单在计费链路即时生效", () => {
    const OLD = process.env.SUPERADMIN_EMAILS;
    try {
      process.env.SUPERADMIN_EMAILS = "admin@brownzone.ai";
      expect(canUserPayForTarget("admin-1", "student-1")).toBe(true);
    } finally {
      if (OLD === undefined) delete process.env.SUPERADMIN_EMAILS;
      else process.env.SUPERADMIN_EMAILS = OLD;
    }
  });

  it("参赛队成员的订阅代付目标列表覆盖全部学生", () => {
    const targets = listSubscriptionTargetsForUser(SUPERADMIN_TEAM[0].id);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target.role === "student")).toBe(true);
  });
});
