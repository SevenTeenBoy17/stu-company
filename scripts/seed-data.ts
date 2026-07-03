/**
 * Pure selectors that decide WHICH credentialed demo data the seed script
 * plants, so the decision can be unit-tested without touching Postgres.
 *
 * Security invariant (internal-audit P0-1 + P0-2): the in-memory seed store
 * (`src/lib/store.ts`) ships demo accounts whose passwords are documented in
 * AGENTS.md (superadmin / `Super001!!!`, admin@brownzone.ai / `BrownZone2026!`,
 * student/teacher/parent demos / `BrownZone2026!`) and public, valid invite
 * codes (`MRB-STUDENT/PARENT/TEACHER-2026`). Planting any of those into a
 * publicly-exposed instance is a backdoor (log in as admin) and a privilege-
 * escalation path (self-register as teacher). In production we therefore skip
 * ALL of them and create at most ONE admin from strong env credentials.
 *
 * In dev/test the selectors are byte-for-byte pass-throughs, so the offline
 * teacher-laptop demo seed is unchanged.
 */

import type { InviteCode, UserRecord } from "@/lib/types";

export type SeedMode = {
  /** process.env.NODE_ENV === "production" */
  isProd: boolean;
  /** SEED_DEMO=true forces demo data even in production (opt-in staging). */
  seedDemo: boolean;
};

/** A single admin account derived from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. */
export type EnvAdmin = {
  id: string;
  email: string;
  /** bcrypt hash of SEED_ADMIN_PASSWORD — never the plaintext. */
  passwordHash: string;
  name: string;
  title: string;
};

/** True when the seed should plant the full public/demo data set as-is. */
export function shouldSeedDemoData(mode: SeedMode): boolean {
  return !mode.isProd || mode.seedDemo;
}

/**
 * Decide the user rows to seed.
 *
 * - dev/test, or `SEED_DEMO=true`: return `allUsers` unchanged (full demo set).
 * - prod (and no `SEED_DEMO`): drop every credentialed demo account; return the
 *   env-admin row only when both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD were
 *   supplied (already hashed into `adminFromEnv`). Never fall back to a public
 *   password.
 */
export function selectSeedUsers(
  allUsers: UserRecord[],
  options: SeedMode & { adminFromEnv: EnvAdmin | null },
): UserRecord[] {
  if (shouldSeedDemoData(options)) {
    return allUsers;
  }

  if (!options.adminFromEnv) {
    return [];
  }

  const admin = options.adminFromEnv;
  const row: UserRecord = {
    id: admin.id,
    email: admin.email,
    passwordHash: admin.passwordHash,
    role: "admin",
    name: admin.name,
    title: admin.title,
  };
  return [row];
}

/**
 * Decide the invite-code rows to seed.
 *
 * - dev/test, or `SEED_DEMO=true`: return `allInvites` unchanged.
 * - prod (and no `SEED_DEMO`): return `[]` — no public, valid invite codes.
 */
export function selectSeedInvites(
  allInvites: InviteCode[],
  mode: SeedMode,
): InviteCode[] {
  if (shouldSeedDemoData(mode)) {
    return allInvites;
  }
  return [];
}
