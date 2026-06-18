import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  getDb: () => null,
  getDirectFallbackDb: () => null,
  getSupabaseDirectFallbackUrl: () => null,
  isDatabaseConfigured: () => false,
}));

import {
  advanceRunForUser,
  appendAiMessage,
  applyActionForUser,
  authenticateUser,
  attachManualPaymentProof,
  buildTeacherLeaderboardCards,
  canUserPayForTarget,
  createAiSession,
  createAssignmentForTeacher,
  findInviteByCode,
  findProfileByUserId,
  findUserByEmail,
  findUserById,
  getAdminOverview,
  getAiSessionById,
  getAppSetting,
  getClassroomById,
  getLearningProgress,
  getLeaderboardSnapshot,
  createPaymentOrder,
  fulfillPaymentOrder,
  getPaymentOrderByOutTradeNo,
  getParentOverview,
  getQuickDemoCredentials,
  getRiskProfile,
  getRunForUser,
  getSimulationStateForUser,
  getTeacherOverview,
  hasModuleQuizPassed,
  listAiSessionsForUser,
  listSubscriptionTargetsForUser,
  markModuleComplete,
  markModuleQuizPassed,
  registerUserByEmail,
  registerUserByInvite,
  resetStoreForTests,
  roleHomePath,
  upsertAppSetting,
  upsertRiskProfile,
  validateInviteCode,
} from "@/lib/db/repo";
import {
  getManualWechatCollectionConfig,
  getManualWechatReadiness,
  saveManualWechatCollectionConfig,
} from "@/lib/billing/manual-wechat";

describe("db repo fallback adapter", () => {
  beforeEach(async () => {
    await resetStoreForTests();
  });

  it("reads users, profiles, invites, classroom, run, simulation state and leaderboard", async () => {
    await expect(findUserByEmail("student@brownzone.ai")).resolves.toMatchObject({
      id: "student-1",
      role: "student",
    });
    await expect(findUserById("teacher-1")).resolves.toMatchObject({ role: "teacher" });
    await expect(findProfileByUserId("student-1")).resolves.toMatchObject({ userId: "student-1" });
    await expect(findInviteByCode("MRB-STUDENT-2026")).resolves.toMatchObject({ role: "student" });
    await expect(validateInviteCode("MRB-STUDENT-2026")).resolves.toMatchObject({ valid: true });
    await expect(getClassroomById("class-1")).resolves.toMatchObject({ id: "class-1" });
    await expect(getRunForUser("student-1")).resolves.toMatchObject({ userId: "student-1" });
    await expect(getSimulationStateForUser("student-1")).resolves.toMatchObject({
      user: { id: "student-1" },
      classroom: { id: "class-1" },
    });

    const leaderboard = await getLeaderboardSnapshot("classroom");
    expect(leaderboard).toHaveLength(4);
    expect(leaderboard[0]?.rank).toBe(1);
  });

  it("authenticates and registers invite users", async () => {
    await expect(authenticateUser("teacher@brownzone.ai", "BrownZone2026!")).resolves.toMatchObject({
      id: "teacher-1",
    });

    const user = await registerUserByInvite({
      inviteCode: "MRB-TEACHER-2026",
      name: "新教师",
      email: "newteacher.repo@brownzone.ai",
      password: "BrownZone2026!",
    });

    expect(user.role).toBe("teacher");
    await expect(authenticateUser("newteacher.repo@brownzone.ai", "BrownZone2026!")).resolves.toMatchObject({
      id: user.id,
    });
  });

  it("rejects wildcard invite codes instead of treating them as patterns", async () => {
    await expect(findInviteByCode("MRB-TE%")).resolves.toBeNull();
    await expect(validateInviteCode("MRB-TE%")).resolves.toMatchObject({
      valid: false,
      reason: "邀请码不存在。",
    });
    await expect(
      registerUserByInvite({
        inviteCode: "MRB-TE%",
        name: "通配码",
        email: "wildcard-invite@brownzone.ai",
        password: "BrownZone2026!",
      }),
    ).rejects.toThrow("邀请码不存在");
  });

  it("mutates simulation runs through action and advance helpers", async () => {
    const before = await getRunForUser("student-1");
    const afterTrade = await applyActionForUser("student-1", {
      type: "trade",
      assetId: "asset-etf",
      side: "buy",
      quantity: 1,
      orderMode: "market",
    });
    expect(afterTrade.cash).toBeLessThan(before?.cash ?? 0);

    const advanced = await advanceRunForUser("student-1");
    expect(advanced.currentRound).toBe(afterTrade.currentRound + 1);
  });

  it("builds teacher, parent and admin overviews and creates assignments", async () => {
    const assignment = await createAssignmentForTeacher("teacher-1", {
      title: "Repo adapter 测试任务",
      brief: "验证教师任务写入路径。",
      difficulty: "策略",
      dueLabel: "本周五",
    });
    expect(assignment.createdBy).toBe("teacher-1");

    await expect(getTeacherOverview("teacher-1")).resolves.toMatchObject({
      teacher: { id: "teacher-1" },
      classroom: { id: "class-1" },
    });
    await expect(getParentOverview("parent-1")).resolves.toMatchObject({
      parent: { id: "parent-1" },
      student: { id: "student-1" },
    });
    await expect(getAdminOverview()).resolves.toMatchObject({
      metrics: expect.any(Array),
      invites: expect.any(Array),
    });
  });

  // SECURITY REGRESSION (internal-test 2026-06-05, P0): teacher/parent overviews
  // embed full user rows (their own + students'). They MUST NOT serialize the
  // bcrypt passwordHash — doing so shipped offline-crackable credential material
  // to any teacher/parent browser. Pin it so the projection can't be removed.
  it("teacher & parent overviews never expose a passwordHash", async () => {
    const teacherOverview = await getTeacherOverview("teacher-1");
    expect(JSON.stringify(teacherOverview)).not.toContain("passwordHash");
    expect(teacherOverview.teacher).not.toHaveProperty("passwordHash");
    expect(teacherOverview.students.length).toBeGreaterThan(0);
    for (const student of teacherOverview.students) {
      expect(student).not.toHaveProperty("passwordHash");
      expect(student.id).toBeTruthy(); // data still present, only the hash is gone
    }

    const parentOverview = await getParentOverview("parent-1");
    expect(JSON.stringify(parentOverview)).not.toContain("passwordHash");
    expect(parentOverview.parent).not.toHaveProperty("passwordHash");
    expect(parentOverview.student).not.toHaveProperty("passwordHash");
    expect(parentOverview.student.id).toBe("student-1");
  });

  it("stores AI sessions and trims message history", async () => {
    const session = await createAiSession({
      userId: "student-1",
      mode: "student-context",
      title: "Repo AI 会话",
    });

    for (let index = 0; index < 22; index += 1) {
      await appendAiMessage(session.id, "student-1", {
        id: `repo-msg-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        text: `message-${index}`,
        createdAt: new Date(2026, 3, 14, 10, index).toISOString(),
      });
    }

    const stored = await getAiSessionById(session.id, "student-1");
    expect(stored?.messages).toHaveLength(20);
    expect(stored?.messages[0]?.text).toBe("message-2");

    const sessions = await listAiSessionsForUser("student-1");
    expect(sessions[0]?.id).toBe(session.id);
  });

  it("re-exports pure store helpers", () => {
    expect(roleHomePath("student")).toBe("/student");
    expect(getQuickDemoCredentials()).toHaveLength(5);
    expect(buildTeacherLeaderboardCards([{ userId: "u", name: "A", classroomId: "c", netWorth: 1, disciplineScore: 1, rank: 1 }])[0]?.headline).toBeTruthy();
  });

  it("counts learning progress only after quiz pass", async () => {
    await expect(getLearningProgress("student-1")).resolves.toMatchObject({
      completed: 0,
      completedKeys: [],
    });
    await expect(hasModuleQuizPassed("student-1", "equities")).resolves.toBe(false);

    await markModuleQuizPassed("student-1", "equities");
    await expect(hasModuleQuizPassed("student-1", "equities")).resolves.toBe(true);
    await expect(getLearningProgress("student-1")).resolves.toMatchObject({
      completed: 1,
      completedKeys: ["equities"],
    });

    await markModuleComplete("student-1", "equities");
    await expect(getLearningProgress("student-1")).resolves.toMatchObject({
      completed: 1,
      completedKeys: ["equities"],
    });
  });

  it("checks sponsored subscription target permissions in fallback mode", async () => {
    await expect(canUserPayForTarget("teacher-1", "student-1")).resolves.toBe(true);
    await expect(canUserPayForTarget("parent-1", "student-1")).resolves.toBe(true);
    await expect(canUserPayForTarget("parent-1", "student-2")).resolves.toBe(false);
    await expect(canUserPayForTarget("student-1", "student-1")).resolves.toBe(false);

    await expect(listSubscriptionTargetsForUser("parent-1")).resolves.toEqual([
      expect.objectContaining({ id: "student-1" }),
    ]);
  });

  it("creates, fulfills and reads back a paid subscription order", async () => {
    const order = await createPaymentOrder({
      userId: "parent-1",
      targetUserId: "student-1",
      tier: "standard",
      channel: "mock",
      amountFen: 1500,
      description: "Mr.Brown AI 经济沙盘标准版月卡",
      outTradeNo: "wxorder-repo-paid",
      expiresAt: new Date("2026-06-11T12:30:00.000Z"),
      codeUrl: "brown-zone://mock-wechat-pay/wxorder-repo-paid",
    });

    await expect(getPaymentOrderByOutTradeNo(order.outTradeNo)).resolves.toMatchObject({
      status: "pending",
      codeUrl: expect.stringContaining("wxorder-repo-paid"),
    });

    const result = await fulfillPaymentOrder({
      outTradeNo: order.outTradeNo,
      transactionId: "mock-wxorder-repo-paid",
      paidAt: "2026-06-11T12:00:00.000Z",
      paidAmountFen: 1500,
    });

    await expect(getPaymentOrderByOutTradeNo(order.outTradeNo)).resolves.toMatchObject({
      status: "paid",
      transactionId: "mock-wxorder-repo-paid",
    });
    await expect(findUserById("student-1")).resolves.toMatchObject({
      subscriptionTier: "standard",
    });
    expect(result.grant?.expiresAt).toContain("2026-07-11");
  });

  it("records manual WeChat proof before admin fulfillment in fallback mode", async () => {
    const order = await createPaymentOrder({
      userId: "parent-1",
      targetUserId: "student-1",
      tier: "standard",
      channel: "manual",
      amountFen: 1500,
      description: "Mr.Brown AI 经济沙盘 · 标准版月卡",
      outTradeNo: "wxorder-repo-manual",
      expiresAt: new Date("2026-06-12T12:30:00.000Z"),
    });

    await expect(
      attachManualPaymentProof(order.outTradeNo, {
        note: "微信转账单号 420000-repo",
        proofImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        submittedBy: "parent-1",
      }),
    ).resolves.toMatchObject({
      rawNotify: expect.objectContaining({
        manualProof: expect.objectContaining({
          note: "微信转账单号 420000-repo",
          proofImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        }),
      }),
    });

    await expect(
      fulfillPaymentOrder({
        outTradeNo: order.outTradeNo,
        transactionId: "manual-wxorder-repo-manual",
        paidAmountFen: 1500,
      }),
    ).resolves.toMatchObject({
      order: expect.objectContaining({ status: "paid" }),
      grant: expect.objectContaining({ tier: "standard" }),
    });
  });

  it("persists manual WeChat settings through the repo fallback adapter", async () => {
    const saved = await upsertAppSetting("billing.manual_wechat", {
      qrUrl: "https://cdn.example.com/repo-wechat.png",
      payeeName: "Brown Zone Demo",
      instruction: "Submit the transfer note after payment.",
    }, "superadmin");

    expect(saved.updatedBy).toBe("superadmin");
    await expect(getAppSetting("billing.manual_wechat")).resolves.toMatchObject({
      value: expect.objectContaining({
        qrUrl: "https://cdn.example.com/repo-wechat.png",
        payeeName: "Brown Zone Demo",
      }),
    });
  });

  it("uses an uploaded WeChat QR image ahead of the external URL", async () => {
    const qrImageDataUrl = "data:image/png;base64,iVBORw0KGgo=";
    await saveManualWechatCollectionConfig({
      qrUrl: "https://cdn.example.com/external-wechat.png",
      qrImageDataUrl,
      payeeName: "Brown Zone Upload",
      instruction: "Scan the uploaded QR and submit proof.",
    }, "superadmin");

    await expect(getManualWechatCollectionConfig()).resolves.toMatchObject({
      qrUrl: qrImageDataUrl,
      qrImageDataUrl,
      externalQrUrl: "https://cdn.example.com/external-wechat.png",
      qrConfigured: true,
      payeeName: "Brown Zone Upload",
      source: "database",
    });
  });

  it("reports manual WeChat launch readiness from the saved QR config", async () => {
    const initial = await getManualWechatCollectionConfig();
    expect(getManualWechatReadiness(initial)).toMatchObject({
      ready: false,
      label: "needs_setup",
      nextSteps: expect.arrayContaining([
        expect.stringContaining("需要上传真实收款码图片"),
      ]),
    });

    const config = await saveManualWechatCollectionConfig({
      qrImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      payeeName: "Brown Zone",
      instruction: "扫码付款后提交订单号和付款截图。",
    }, "superadmin");

    expect(getManualWechatReadiness(config)).toMatchObject({
      ready: true,
      label: "ready",
      nextSteps: [],
    });
  });

  it("registers a new user by email without invite code", async () => {
    const user = await registerUserByEmail({
      name: "邮箱用户",
      email: "email-only@brownzone.ai",
      password: "BrownTest2026!",
    });

    expect(user.role).toBe("student");
    expect(user.name).toBe("邮箱用户");
    expect(user.email).toBe("email-only@brownzone.ai");
    expect(user.trialExpiresAt).toBeDefined();
    expect(user.subscriptionTier).toBe("free");
    expect(user.onboardingCompleted).toBe(0);

    await expect(authenticateUser("email-only@brownzone.ai", "BrownTest2026!")).resolves.toMatchObject({
      id: user.id,
    });
  });

  it("registers a user by email with valid invite code", async () => {
    const user = await registerUserByEmail({
      name: "邀请码用户",
      email: "invited-email@brownzone.ai",
      password: "BrownTest2026!",
      inviteCode: "MRB-STUDENT-2026",
    });

    expect(user.role).toBe("student");
    expect(user.classroomId).toBe("class-1");
  });

  it("persists and overwrites risk-profile answers in fallback mode", async () => {
    await expect(getRiskProfile("student-1")).resolves.toBeNull();

    await expect(
      upsertRiskProfile("student-1", {
        riskLabel: "稳健观察者",
        answers: {
          selectedAnswers: [
            { questionId: "loss-reaction", optionId: "steady" },
            { questionId: "time-horizon", optionId: "long" },
          ],
        },
      }),
    ).resolves.toMatchObject({
      userId: "student-1",
      riskLabel: "稳健观察者",
      answers: expect.objectContaining({
        selectedAnswers: expect.any(Array),
      }),
      updatedAt: expect.any(String),
    });

    await expect(getRiskProfile("student-1")).resolves.toMatchObject({
      riskLabel: "稳健观察者",
      answers: expect.objectContaining({
        selectedAnswers: expect.arrayContaining([
          expect.objectContaining({ questionId: "loss-reaction", optionId: "steady" }),
        ]),
      }),
    });

    await expect(
      upsertRiskProfile("student-1", {
        riskLabel: "成长进攻型",
        answers: {
          selectedAnswers: [{ questionId: "loss-reaction", optionId: "growth" }],
        },
      }),
    ).resolves.toMatchObject({
      riskLabel: "成长进攻型",
    });
    await expect(getRiskProfile("student-1")).resolves.toMatchObject({
      riskLabel: "成长进攻型",
      answers: expect.objectContaining({
        selectedAnswers: [expect.objectContaining({ optionId: "growth" })],
      }),
    });
  });

  it("rejects duplicate email in registerUserByEmail", async () => {
    await expect(
      registerUserByEmail({
        name: "重复",
        email: "student@brownzone.ai",
        password: "BrownTest2026!",
      }),
    ).rejects.toThrow("已经被注册");
  });

  it("rejects invalid invite code in registerUserByEmail", async () => {
    await expect(
      registerUserByEmail({
        name: "坏码",
        email: "badcode@brownzone.ai",
        password: "BrownTest2026!",
        inviteCode: "INVALID-CODE-XXX",
      }),
    ).rejects.toThrow("邀请码无效");
  });
});
