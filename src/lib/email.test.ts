import { describe, expect, it } from "vitest";

import {
  isEmailConfigured,
  passwordResetEmail,
  sendEmail,
  verificationEmail,
} from "@/lib/email";

describe("email seam", () => {
  it("reports not configured when RESEND_API_KEY / EMAIL_FROM are absent", () => {
    // No Resend env is set in the test environment.
    expect(isEmailConfigured()).toBe(false);
  });

  it("does not attempt delivery when not configured", async () => {
    const result = await sendEmail({ to: "a@b.com", subject: "x", html: "<p>x</p>" });
    expect(result).toEqual({ delivered: false, reason: "not_configured" });
  });

  it("builds a verification email containing the link and a CTA", () => {
    const { subject, html } = verificationEmail("林同学", "https://app.test/verify?token=abc");
    expect(subject).toContain("验证");
    expect(html).toContain("https://app.test/verify?token=abc");
    expect(html).toContain("林同学");
  });

  it("builds a password-reset email containing the link", () => {
    const { html } = passwordResetEmail("Kid", "https://app.test/reset-password?token=xyz");
    expect(html).toContain("https://app.test/reset-password?token=xyz");
  });

  it("escapes HTML in the recipient name", () => {
    const { html } = verificationEmail("<script>", "https://app.test/v");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
