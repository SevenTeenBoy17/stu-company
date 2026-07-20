import { describe, expect, it } from "vitest";

import {
  addFamilyMember,
  applyFamilyEntitlement,
  findUserById,
  listFamilyMembers,
  removeFamilyMember,
} from "@/lib/store";

function setOwnerTier(tier: "free" | "premium") {
  const owner = findUserById("parent-1");
  if (!owner) throw new Error("seed owner missing");
  owner.subscriptionTier = tier;
  owner.subscriptionExpiresAt =
    tier === "premium" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : undefined;
}

describe("family store (Option B)", () => {
  it("rejects adding a member when the owner is not Premium", () => {
    setOwnerTier("free");
    expect(() => addFamilyMember("parent-1", "student-1")).toThrow();
  });

  it("adds a linked student to a Premium family and the student inherits Premium", () => {
    setOwnerTier("premium");
    const member = addFamilyMember("parent-1", "student-1");
    expect(member.studentUserId).toBe("student-1");
    expect(listFamilyMembers("parent-1").some((m) => m.studentUserId === "student-1")).toBe(true);

    const student = findUserById("student-1")!;
    expect(student.subscriptionTier).not.toBe("premium"); // own tier unchanged
    expect(applyFamilyEntitlement(student).subscriptionTier).toBe("premium"); // inherited
  });

  it("revokes inheritance once removed from the family", () => {
    setOwnerTier("premium");
    if (!listFamilyMembers("parent-1").some((m) => m.studentUserId === "student-1")) {
      addFamilyMember("parent-1", "student-1");
    }
    expect(removeFamilyMember("parent-1", "student-1")).toBe(true);
    const student = findUserById("student-1")!;
    expect(applyFamilyEntitlement(student).subscriptionTier).not.toBe("premium");
  });

  it("stops inheritance when the owner is no longer Premium-active", () => {
    setOwnerTier("premium");
    addFamilyMember("parent-1", "student-1");
    setOwnerTier("free");
    const student = findUserById("student-1")!;
    expect(applyFamilyEntitlement(student).subscriptionTier).not.toBe("premium");
    removeFamilyMember("parent-1", "student-1");
  });

  // itest10 #8: family sharing extends, never shortens. A student with their own
  // longer Premium must keep their own later expiry, not inherit the owner's earlier one.
  it("never downgrades a student's own longer Premium expiry to the owner's earlier one", () => {
    setOwnerTier("premium"); // owner expires in ~30 days
    addFamilyMember("parent-1", "student-1");
    const owner = findUserById("parent-1")!;
    const student = findUserById("student-1")!;
    const studentOwnExpiry = new Date(Date.now() + 720 * 86_400_000).toISOString(); // ~2 years out
    student.subscriptionTier = "premium";
    student.subscriptionExpiresAt = studentOwnExpiry;

    const resolved = applyFamilyEntitlement(student);
    expect(resolved.subscriptionTier).toBe("premium");
    // Keeps the student's own later coverage, not the owner's ~30-day one.
    expect(resolved.subscriptionExpiresAt).toBe(studentOwnExpiry);
    expect(new Date(resolved.subscriptionExpiresAt!).getTime()).toBeGreaterThan(
      new Date(owner.subscriptionExpiresAt!).getTime(),
    );

    // cleanup so later files/tests see the seed student untouched
    student.subscriptionTier = "free";
    student.subscriptionExpiresAt = undefined;
    removeFamilyMember("parent-1", "student-1");
  });
});
