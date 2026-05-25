import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  getDb: () => null,
  isDatabaseConfigured: () => false,
}));

import {
  advanceRunForUser,
  appendAiMessage,
  applyActionForUser,
  authenticateUser,
  buildTeacherLeaderboardCards,
  createAiSession,
  createAssignmentForTeacher,
  findInviteByCode,
  findProfileByUserId,
  findUserByEmail,
  findUserById,
  getAdminOverview,
  getAiSessionById,
  getClassroomById,
  getLeaderboardSnapshot,
  getParentOverview,
  getQuickDemoCredentials,
  getRunForUser,
  getSimulationStateForUser,
  getTeacherOverview,
  listAiSessionsForUser,
  registerUserByInvite,
  resetStoreForTests,
  roleHomePath,
  validateInviteCode,
} from "@/lib/db/repo";

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
    expect(leaderboard).toHaveLength(3);
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
    expect(getQuickDemoCredentials()).toHaveLength(4);
    expect(buildTeacherLeaderboardCards([{ userId: "u", name: "A", classroomId: "c", netWorth: 1, disciplineScore: 1, rank: 1 }])[0]?.headline).toBeTruthy();
  });
});
