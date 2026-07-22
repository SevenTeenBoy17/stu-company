import { beforeEach, describe, expect, it } from "vitest";

import {
  getOrCreateGuardianInviteForStudent,
  registerUserByEmail,
  registerUserByInvite,
  resetGuardianBindingForStudent,
  resetStoreForTests,
} from "@/lib/store";
import { canUserOperate, resolveSubscriptionState } from "@/lib/billing/subscription";

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

// itest10 #11/#6: the store fallback path (which the unit suite exercises) must
// carry the SAME placeholder guard as the DB path, or the demo parent code can
// hijack an already-bound student — and the anti-hijack fix would be a false green.
describe("store guardian claim placeholder guard (itest10 #11)", () => {
  beforeEach(() => resetStoreForTests());

  it("registerUserByInvite with the shared demo parent code can NOT hijack an already-bound student", async () => {
    // Seed: student-1 <- parent-1 via bond-1; MRB-PARENT-2026 carries studentLinkId=bond-1.
    const attacker = await registerUserByInvite({
      name: "陌生人",
      email: "hijack-attacker@example.com",
      password: "Passw0rd1",
      inviteCode: "MRB-PARENT-2026",
    });
    expect(attacker.role).toBe("parent");
    // The already-claimed link was NOT reassigned to the attacker: resetting it
    // reports the ORIGINAL parent as the previous holder, proving no hijack.
    const reset = resetGuardianBindingForStudent("student-1");
    expect(reset.previousParentId).toBe("parent-1");
    expect(reset.previousParentId).not.toBe(attacker.id);
  });
});

// itest10 #12: a mis-claimed guardian binding must be recoverable, or the
// refuse-second-guardian guard locks the student out forever.
describe("resetGuardianBindingForStudent remediation (itest10 #12)", () => {
  beforeEach(() => resetStoreForTests());

  it("frees a wrongly-bound student to mint a fresh guardian code", async () => {
    const { invite } = getOrCreateGuardianInviteForStudent("student-2");
    await registerUserByEmail({
      name: "误绑家长",
      email: "wrong-parent@example.com",
      password: "GuardPass1",
      inviteCode: invite.code,
    });
    // Now locked: student-2 can't mint a second code.
    expect(() => getOrCreateGuardianInviteForStudent("student-2")).toThrow(/已经绑定了家长/);
    // Admin remediation resets the binding...
    const reset = resetGuardianBindingForStudent("student-2");
    expect(reset.studentUserId).toBe("student-2");
    // ...and the student can mint a fresh code again.
    const fresh = getOrCreateGuardianInviteForStudent("student-2");
    expect(fresh.invite.code).toMatch(/^MRB-P-/);
  });

  it("refuses to reset a student who has no bound guardian", () => {
    getOrCreateGuardianInviteForStudent("student-3"); // placeholder only, unclaimed
    expect(() => resetGuardianBindingForStudent("student-3")).toThrow(/没有已绑定的家长/);
  });
});

// itest12 P1: invite-code registration must grant the SAME 3-day trial as email
// registration. The real repro: a new student registered by MRB-STUDENT-2026 had
// no trialExpiresAt, so resolveSubscriptionState judged them expired and their
// first sim/actions call 403'd「试用已结束」. Guard the two paths stay symmetric.
describe("trial parity between invite-code and email registration (itest12 P1)", () => {
  beforeEach(() => resetStoreForTests());

  it("registerUserByInvite grants an operable 3-day trial (not expired)", async () => {
    const student = await registerUserByInvite({
      name: "邀请码新生",
      email: "invite-trial@example.com",
      password: "Passw0rd1",
      inviteCode: "MRB-STUDENT-2026",
    });
    expect(student.role).toBe("student");
    // The account carries a trial + free tier, mirroring the email path.
    expect(student.subscriptionTier).toBe("free");
    expect(student.trialExpiresAt).toBeTruthy();

    const state = resolveSubscriptionState(
      student.subscriptionTier,
      student.trialExpiresAt,
      student.subscriptionExpiresAt,
    );
    expect(state.status).toBe("trial");
    expect(state.canOperate).toBe(true);
    // canUserOperate is the exact gate /api/sim/actions uses — it must pass.
    expect(canUserOperate(student.subscriptionTier, student.trialExpiresAt, student.subscriptionExpiresAt)).toBe(true);
  });

  it("invite-code and email registrations reach the same operable trial state", async () => {
    const viaInvite = await registerUserByInvite({
      name: "邀请码生",
      email: "parity-invite@example.com",
      password: "Passw0rd1",
      inviteCode: "MRB-STUDENT-2026",
    });
    const viaEmail = await registerUserByEmail({
      name: "邮箱生",
      email: "parity-email@example.com",
      password: "Passw0rd1",
    });

    const inviteState = resolveSubscriptionState(
      viaInvite.subscriptionTier,
      viaInvite.trialExpiresAt,
      viaInvite.subscriptionExpiresAt,
    );
    const emailState = resolveSubscriptionState(
      viaEmail.subscriptionTier,
      viaEmail.trialExpiresAt,
      viaEmail.subscriptionExpiresAt,
    );
    expect(inviteState.status).toBe(emailState.status);
    expect(inviteState.canOperate).toBe(emailState.canOperate);
    expect(inviteState.canOperate).toBe(true);
  });
});
