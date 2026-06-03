import { describe, expect, it } from "vitest";

import { scrubError } from "@/lib/db/repo";

// P6: fallback logs must not leak PII / secrets. scrubError redacts emails and
// long hex tokens and caps length before the message reaches console/log drains.

describe("scrubError (P6 — no PII/secrets in fallback logs)", () => {
  it("redacts email addresses", () => {
    const out = scrubError(new Error("duplicate key for student@school.edu.cn"));
    expect(out).not.toContain("student@school.edu.cn");
    expect(out).toContain("<email>");
  });

  it("redacts long hex tokens", () => {
    const token = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
    const out = scrubError(new Error(`session ${token} rejected`));
    expect(out).not.toContain(token);
    expect(out).toContain("<token>");
  });

  it("caps length and tolerates non-Error / nullish input", () => {
    expect(scrubError("x".repeat(500)).length).toBeLessThanOrEqual(200);
    expect(scrubError(null)).toBe("");
    expect(scrubError(undefined)).toBe("");
  });
});
