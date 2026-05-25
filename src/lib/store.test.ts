import { beforeEach, describe, expect, it } from "vitest";

import {
  appendAiMessage,
  authenticateUser,
  createAiSession,
  getAiSessionById,
  getLeaderboardSnapshot,
  listAiSessionsForUser,
  registerUserByInvite,
  resetStoreForTests,
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
