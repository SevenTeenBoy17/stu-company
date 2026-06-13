import { describe, expect, it } from "vitest";

import {
  firstRegisterError,
  INVITE_CODE_FORMAT_MESSAGE,
  passwordRequirements,
  registerFieldErrors,
  registerSchema,
} from "@/lib/auth-validation";

describe("firstRegisterError", () => {
  const valid = { name: "zhao", email: "zhao@qq.com", password: "abc12345" };

  it("accepts a well-formed payload (no invite code)", () => {
    expect(firstRegisterError(valid)).toBeNull();
  });

  it("accepts a well-formed payload with an invite code", () => {
    expect(firstRegisterError({ ...valid, inviteCode: "MRB-STUDENT-2026" })).toBeNull();
  });

  it("rejects a password with no digit, with a specific Chinese message", () => {
    expect(firstRegisterError({ ...valid, password: "abcdefgh" })).toBe(
      "密码需要包含至少一个数字。",
    );
  });

  it("rejects a password with no letter, with a specific Chinese message", () => {
    expect(firstRegisterError({ ...valid, password: "12345678" })).toBe(
      "密码需要包含至少一个字母。",
    );
  });

  it("rejects a password shorter than 8, with a specific Chinese message", () => {
    expect(firstRegisterError({ ...valid, password: "ab1" })).toBe("密码至少 8 位。");
  });

  it("rejects a nickname shorter than 2 characters", () => {
    expect(firstRegisterError({ ...valid, name: "z" })).toBe("昵称至少需要 2 个字符。");
  });

  it("rejects an invalid email", () => {
    expect(firstRegisterError({ ...valid, email: "not-an-email" })).toBe(
      "请输入有效的邮箱地址。",
    );
  });

  it("rejects a too-short invite code in Simplified Chinese (no English leak)", () => {
    const message = firstRegisterError({ ...valid, inviteCode: "abc" });
    expect(message).toBe("邀请码至少 6 位。");
  });

  it("rejects wildcard invite codes before they reach persistence", () => {
    expect(firstRegisterError({ ...valid, inviteCode: "MRB-TE%" })).toBe(
      INVITE_CODE_FORMAT_MESSAGE,
    );
    expect(firstRegisterError({ ...valid, inviteCode: "MRB_TEACHER" })).toBe(
      INVITE_CODE_FORMAT_MESSAGE,
    );
  });

  it("never returns an empty string for an invalid payload", () => {
    const message = firstRegisterError({ name: "", email: "", password: "" });
    expect(message).toBeTruthy();
  });
});

describe("registerSchema", () => {
  it("treats an omitted invite code as valid (optional)", () => {
    const result = registerSchema.safeParse({
      name: "zhao",
      email: "zhao@qq.com",
      password: "abc12345",
    });
    expect(result.success).toBe(true);
  });
});

describe("registerFieldErrors", () => {
  const valid = { name: "zhao", email: "zhao@qq.com", password: "abc12345" };

  it("returns an empty object for a valid payload", () => {
    expect(registerFieldErrors(valid)).toEqual({});
  });

  it("attaches the password message to the password field", () => {
    expect(registerFieldErrors({ ...valid, password: "abcdefgh" })).toEqual({
      password: "密码需要包含至少一个数字。",
    });
  });

  it("reports at most one message per field, across multiple bad fields", () => {
    const errors = registerFieldErrors({ name: "z", email: "nope", password: "123" });
    expect(errors.name).toBe("昵称至少需要 2 个字符。");
    expect(errors.email).toBe("请输入有效的邮箱地址。");
    expect(errors.password).toBe("密码至少 8 位。");
    // first-issue-per-field, not an array — exactly one string each
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "password"]);
  });

  it("does not produce a key for an omitted (valid) invite code", () => {
    expect(registerFieldErrors(valid).inviteCode).toBeUndefined();
  });
});

describe("passwordRequirements", () => {
  it("exposes the three rules used to guide the user", () => {
    expect(passwordRequirements).toHaveLength(3);
    for (const req of passwordRequirements) {
      expect(req.label.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["abc12345", [true, true, true]],
    ["abcdefgh", [true, true, false]],
    ["12345678", [true, false, true]],
    ["ab1", [false, true, true]],
    ["", [false, false, false]],
  ])("evaluates %s live as %j", (password, expected) => {
    expect(passwordRequirements.map((req) => req.test(password))).toEqual(expected);
  });

  it("stays consistent with the schema: all rules met <=> no password field error", () => {
    for (const password of ["abc12345", "abcdefgh", "12345678", "ab1", "passw0rd"]) {
      const allMet = passwordRequirements.every((req) => req.test(password));
      const hasPasswordError = Boolean(
        registerFieldErrors({ name: "zhao", email: "zhao@qq.com", password }).password,
      );
      expect(allMet).toBe(!hasPasswordError);
    }
  });
});
