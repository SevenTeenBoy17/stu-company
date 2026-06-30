import { describe, expect, it } from "vitest";

import { sanitizeAuthNextPath } from "@/lib/safe-next-path";

describe("sanitizeAuthNextPath", () => {
  it("keeps safe in-app return paths with query strings", () => {
    expect(sanitizeAuthNextPath("/pricing?upgrade=token_123")).toBe("/pricing?upgrade=token_123");
    expect(sanitizeAuthNextPath("/student/quests#today")).toBe("/student/quests#today");
  });

  it("rejects external, protocol-like, newline, and unknown return paths", () => {
    expect(sanitizeAuthNextPath("https://evil.example/pricing")).toBeNull();
    expect(sanitizeAuthNextPath("//evil.example/pricing")).toBeNull();
    expect(sanitizeAuthNextPath("/\\evil")).toBeNull();
    expect(sanitizeAuthNextPath("/pricing\n/evil")).toBeNull();
    expect(sanitizeAuthNextPath("/api/admin/users")).toBeNull();
  });
});
