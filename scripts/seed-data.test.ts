import { describe, expect, it } from "vitest";

import {
  type EnvAdmin,
  selectSeedInvites,
  selectSeedUsers,
  shouldSeedDemoData,
} from "./seed-data";
import type { InviteCode, UserRecord } from "@/lib/types";

const demoUsers: UserRecord[] = [
  {
    id: "admin-1",
    email: "admin@brownzone.ai",
    passwordHash: "hash-public-BrownZone2026",
    role: "admin",
    name: "Demo 管理员",
    title: "Demo 管理员",
  },
  {
    id: "superadmin",
    email: "superadmin",
    passwordHash: "hash-public-Super001",
    role: "admin",
    name: "超级管理员",
    title: "账号与权限总控",
  },
  {
    id: "student-1",
    email: "student@brownzone.ai",
    passwordHash: "hash-public-BrownZone2026",
    role: "student",
    name: "林知夏",
    title: "高一",
  },
  {
    id: "teacher-1",
    email: "teacher@brownzone.ai",
    passwordHash: "hash-public-BrownZone2026",
    role: "teacher",
    name: "秦老师",
    title: "指导老师",
  },
];

const demoInvites: InviteCode[] = [
  {
    id: "invite-1",
    code: "MRB-STUDENT-2026",
    role: "student",
    label: "试点学生邀请码",
    createdBy: "teacher-1",
    usesRemaining: 18,
    expiresAt: "2026-06-30T23:59:59.000Z",
  },
  {
    id: "invite-3",
    code: "MRB-TEACHER-2026",
    role: "teacher",
    label: "校内教师演示邀请码",
    createdBy: "admin-1",
    usesRemaining: 5,
    expiresAt: "2026-09-01T23:59:59.000Z",
  },
];

const envAdmin: EnvAdmin = {
  id: "admin-env",
  email: "ops@example.com",
  passwordHash: "bcrypt-hash-of-strong-password",
  name: "运营管理员",
  title: "生产管理员",
};

describe("shouldSeedDemoData", () => {
  it("seeds demo data in dev/test", () => {
    expect(shouldSeedDemoData({ isProd: false, seedDemo: false })).toBe(true);
  });

  it("does NOT seed demo data in production by default", () => {
    expect(shouldSeedDemoData({ isProd: true, seedDemo: false })).toBe(false);
  });

  it("seeds demo data in production when SEED_DEMO is forced", () => {
    expect(shouldSeedDemoData({ isProd: true, seedDemo: true })).toBe(true);
  });
});

describe("selectSeedUsers", () => {
  it("dev: returns every demo account unchanged", () => {
    const result = selectSeedUsers(demoUsers, {
      isProd: false,
      seedDemo: false,
      adminFromEnv: null,
    });
    expect(result).toEqual(demoUsers);
  });

  it("prod without env admin: plants ZERO credentialed accounts", () => {
    const result = selectSeedUsers(demoUsers, {
      isProd: true,
      seedDemo: false,
      adminFromEnv: null,
    });
    expect(result).toEqual([]);
    // The public-password backdoor accounts must all be gone.
    expect(result.some((u) => u.email === "admin@brownzone.ai")).toBe(false);
    expect(result.some((u) => u.id === "superadmin")).toBe(false);
  });

  it("prod with env admin: plants ONLY the single env admin", () => {
    const result = selectSeedUsers(demoUsers, {
      isProd: true,
      seedDemo: false,
      adminFromEnv: envAdmin,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "admin-env",
      email: "ops@example.com",
      role: "admin",
      passwordHash: "bcrypt-hash-of-strong-password",
    });
    // None of the public-password demo accounts leaked through.
    expect(result.some((u) => u.passwordHash.startsWith("hash-public"))).toBe(
      false,
    );
  });

  it("prod with SEED_DEMO forced: returns the full demo set", () => {
    const result = selectSeedUsers(demoUsers, {
      isProd: true,
      seedDemo: true,
      adminFromEnv: null,
    });
    expect(result).toEqual(demoUsers);
  });
});

describe("selectSeedInvites", () => {
  it("dev: returns every invite unchanged", () => {
    expect(
      selectSeedInvites(demoInvites, { isProd: false, seedDemo: false }),
    ).toEqual(demoInvites);
  });

  it("prod by default: plants ZERO public invite codes (no self-register-as-teacher)", () => {
    const result = selectSeedInvites(demoInvites, {
      isProd: true,
      seedDemo: false,
    });
    expect(result).toEqual([]);
    expect(result.some((i) => i.code === "MRB-TEACHER-2026")).toBe(false);
  });

  it("prod with SEED_DEMO forced: returns the full invite set", () => {
    expect(
      selectSeedInvites(demoInvites, { isProd: true, seedDemo: true }),
    ).toEqual(demoInvites);
  });
});
