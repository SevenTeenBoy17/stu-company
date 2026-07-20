import { afterEach, describe, expect, it } from "vitest";

import { isSuperAdmin, SUPERADMIN_TEAM } from "@/lib/auth-roles";

describe("isSuperAdmin (centralized super-admin authority)", () => {
  const OLD_ENV = process.env.SUPERADMIN_EMAILS;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.SUPERADMIN_EMAILS;
    else process.env.SUPERADMIN_EMAILS = OLD_ENV;
  });

  it("recognizes the built-in superadmin by id and by email", () => {
    expect(isSuperAdmin({ id: "superadmin", email: "irrelevant@x.com" })).toBe(true);
    expect(isSuperAdmin({ id: "whatever", email: "superadmin" })).toBe(true);
    expect(isSuperAdmin({ id: "whatever", email: "SUPERADMIN" })).toBe(true);
  });

  it("recognizes every named competition-team member (case-insensitive email)", () => {
    for (const member of SUPERADMIN_TEAM) {
      expect(isSuperAdmin({ id: member.id, email: member.email })).toBe(true);
      expect(isSuperAdmin({ id: "any", email: member.email.toUpperCase() })).toBe(true);
    }
    // The four names are all present.
    expect(SUPERADMIN_TEAM.map((m) => m.name).sort()).toEqual(
      ["刘煜柯", "张珺湘", "白杨晋美", "罗布朗"].sort(),
    );
  });

  it("does NOT grant super-admin to a regular admin / student", () => {
    expect(isSuperAdmin({ id: "admin-1", email: "admin@brownzone.ai" })).toBe(false);
    expect(isSuperAdmin({ id: "student-1", email: "student@brownzone.ai" })).toBe(false);
  });

  it("honors the SUPERADMIN_EMAILS env allowlist (comma-separated, trimmed, case-insensitive)", () => {
    expect(isSuperAdmin({ id: "x", email: "ops@brownzone.ai" })).toBe(false);
    process.env.SUPERADMIN_EMAILS = " Ops@brownzone.ai , second@brownzone.ai ";
    expect(isSuperAdmin({ id: "x", email: "ops@brownzone.ai" })).toBe(true);
    expect(isSuperAdmin({ id: "x", email: "second@brownzone.ai" })).toBe(true);
    expect(isSuperAdmin({ id: "x", email: "third@brownzone.ai" })).toBe(false);
  });
});
