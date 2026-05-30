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
});
