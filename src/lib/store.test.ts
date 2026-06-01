import { beforeEach, describe, expect, it } from "vitest";

import {
  appendAiMessage,
  authenticateUser,
  canUserPayForTarget,
  createAdminManagedUser,
  createAiSession,
  createPaymentOrder,
  findUserById,
  fulfillPaymentOrder,
  getAiSessionById,
  getQuickDemoCredentials,
  getLeaderboardSnapshot,
  listAdminUsers,
  listSubscriptionTargetsForUser,
  listAiSessionsForUser,
  registerUserByInvite,
  resetStoreForTests,
  updateAdminManagedUser,
  updateUserEmail,
  validateInviteCode,
} from "@/lib/store";

describe("store", () => {
  beforeEach(() => {
    resetStoreForTests();
  });

  it("validates seeded invite codes", () => {
    const result = validateInviteCode("MRB-STUDENT-2026");
    expect(result.valid).toBe(true);
    expect(result.invite?.role).toBe("student");
  });

  it("registers a new user by invite and allows login", async () => {
    const user = await registerUserByInvite({
      inviteCode: "MRB-TEACHER-2026",
      name: "新老师",
      email: "newteacher@brownzone.ai",
      password: "BrownZone2026!",
    });

    const authenticated = await authenticateUser("newteacher@brownzone.ai", "BrownZone2026!");
    expect(user.role).toBe("teacher");
    expect(authenticated?.id).toBe(user.id);
  });

  it("allows the seeded super administrator account to authenticate", async () => {
    const authenticated = await authenticateUser("superadmin", "Super001!!!");
    expect(authenticated).toMatchObject({
      id: "superadmin",
      role: "admin",
    });
  });

  it("keeps superadmin credentials out of public demo credential helpers", () => {
    const credentials = getQuickDemoCredentials();
    expect(credentials).toHaveLength(5);
    expect(credentials.some((item) => item.email === "superadmin")).toBe(false);
    expect(credentials.some((item) => item.password === "Super001!!!")).toBe(false);
  });

  it("normalizes email updates and rejects duplicates", async () => {
    const user = await updateUserEmail("student-1", "  NEWSTUDENT@BROWNZONE.AI ");
    expect(user.email).toBe("newstudent@brownzone.ai");
    await expect(updateUserEmail("student-2", "newstudent@brownzone.ai")).rejects.toThrow(
      "这个邮箱已经被注册过了。",
    );
  });

  it("lets super admin list, create and update managed users", async () => {
    const created = await createAdminManagedUser({
      name: "运营新生",
      email: "managed@brownzone.ai",
      password: "Managed001!",
      role: "student",
      title: "后台创建体验账号",
      trialDays: 7,
    });

    expect(created.email).toBe("managed@brownzone.ai");
    expect(created.role).toBe("student");

    const filtered = await listAdminUsers({ query: "managed", role: "student", subscription: "trial" });
    expect(filtered.some((user) => user.email === "managed@brownzone.ai")).toBe(true);

    const updated = await updateAdminManagedUser(created.id, {
      name: "运营教师",
      role: "teacher",
      subscriptionTier: "premium",
      subscriptionDays: 30,
      onboardingCompleted: true,
    });

    expect(updated.name).toBe("运营教师");
    expect(updated.role).toBe("teacher");
    expect(updated.subscriptionTier).toBe("premium");
    expect(updated.tokenVersion).toBeGreaterThan(created.tokenVersion);
  });

  it("fulfills a monthly payment order once and extends the target subscription", async () => {
    const order = await createPaymentOrder({
      userId: "parent-1",
      targetUserId: "student-1",
      tier: "standard",
      channel: "mock",
      amountFen: 1500,
      description: "Mr.Brown AI 经济沙盘标准版月卡",
      outTradeNo: "wxorder-test-1",
      expiresAt: new Date("2026-05-28T12:30:00.000Z"),
    });

    const first = await fulfillPaymentOrder({
      outTradeNo: order.outTradeNo,
      transactionId: "wx-tx-1",
      paidAt: "2026-05-28T12:00:00.000Z",
    });
    const second = await fulfillPaymentOrder({
      outTradeNo: order.outTradeNo,
      transactionId: "wx-tx-1",
      paidAt: "2026-05-28T12:00:00.000Z",
    });

    const student = findUserById("student-1");
    expect(first.alreadyFulfilled).toBe(false);
    expect(second.alreadyFulfilled).toBe(true);
    expect(first.grant?.expiresAt).toContain("2026-06-27");
    expect(student?.subscriptionTier).toBe("standard");
    expect(student?.subscriptionExpiresAt).toContain("2026-06-27");
  });

  it("limits sponsored subscription targets to linked students or teacher classrooms", () => {
    expect(canUserPayForTarget("teacher-1", "student-1")).toBe(true);
    expect(canUserPayForTarget("parent-1", "student-1")).toBe(true);
    expect(canUserPayForTarget("parent-1", "student-2")).toBe(false);
    expect(canUserPayForTarget("student-1", "student-1")).toBe(false);

    const parentTargets = listSubscriptionTargetsForUser("parent-1");
    expect(parentTargets).toHaveLength(1);
    expect(parentTargets[0]?.id).toBe("student-1");
  });

  it("builds a classroom leaderboard from seeded runs", () => {
    const leaderboard = getLeaderboardSnapshot("classroom");
    expect(leaderboard.length).toBeGreaterThanOrEqual(3);
    expect(leaderboard[0].rank).toBe(1);
  });

  it("stores ai sessions per user and trims message history", () => {
    const session = createAiSession({
      userId: "student-1",
      mode: "student-context",
      title: "测试会话",
    });

    for (let index = 0; index < 22; index += 1) {
      appendAiMessage(session.id, "student-1", {
        id: `msg-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        text: `message-${index}`,
        createdAt: new Date(2026, 3, 14, 10, index).toISOString(),
      });
    }

    const stored = getAiSessionById(session.id, "student-1");
    expect(stored?.messages).toHaveLength(20);
    expect(stored?.messages[0]?.text).toBe("message-2");
    expect(listAiSessionsForUser("student-1")[0]?.id).toBe(session.id);
  });
});
