import { beforeEach, describe, expect, it } from "vitest";

import {
  getOrCreateGuardianInviteForStudent,
  registerUserByEmail,
  resetStoreForTests,
} from "@/lib/store";

// Pre-merge review findings #1/#2/#3: the guardian-invite flow must enforce the
// system's 1-student -> 1-guardian model (growth_reports is unique per student).
describe("getOrCreateGuardianInviteForStudent guard (pre-merge review #1/#3)", () => {
  beforeEach(() => resetStoreForTests());

  it("is idempotent per student — a second call reuses the same still-valid code", () => {
    const first = getOrCreateGuardianInviteForStudent("student-2");
    const again = getOrCreateGuardianInviteForStudent("student-2");
    expect(again.invite.code).toBe(first.invite.code);
    expect(again.reused).toBe(true);
  });

  it("refuses to mint a second guardian code once a real parent has bound (no 1 student -> N parents)", async () => {
    const { invite } = getOrCreateGuardianInviteForStudent("student-2");
    // A parent registers with the code -> claims the link.
    const parent = await registerUserByEmail({
      name: "家长甲",
      email: "guard-parent-a@example.com",
      password: "GuardPass1",
      inviteCode: invite.code,
    });
    expect(parent.role).toBe("parent");
    // The student can no longer mint a second guardian code for a second parent.
    expect(() => getOrCreateGuardianInviteForStudent("student-2")).toThrow(/已经绑定了家长/);
  });

  it("refuses when the student is already bound in seed data (student-1 <- parent-1)", () => {
    expect(() => getOrCreateGuardianInviteForStudent("student-1")).toThrow(/已经绑定了家长/);
  });
});
