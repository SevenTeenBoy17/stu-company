/**
 * Seeds the Brown Zone Postgres database with the same demo data that
 * `src/lib/store.ts` provides in memory. IDs are preserved where the seed
 * store defines them, and generated scenario/action IDs are made deterministic
 * inside this script so repeated seed runs stay idempotent.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { count, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  assignments,
  classrooms,
  growthReports,
  inviteCodes,
  profiles,
  scenarioRuns,
  studentParentLinks,
  users,
} from "@/lib/db/schema";
import { createSeedStore } from "@/lib/store";
import type { UserRecord } from "@/lib/types";
import {
  type EnvAdmin,
  selectSeedInvites,
  selectSeedUsers,
  shouldSeedDemoData,
} from "./seed-data";

function loadEnvFile(fileName: string, override = false) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. See docs/ENV-CHECKLIST.md");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client);

function createDeterministicSeedStore() {
  const originalRandom = Math.random;
  let state = 0x20260525;

  Math.random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return createSeedStore();
  } finally {
    Math.random = originalRandom;
  }
}

const seed = createDeterministicSeedStore();

// --- Production-safety gate (internal-audit P0-1 + P0-2) ---------------------
// The seed store ships demo accounts with PUBLIC passwords (documented in
// AGENTS.md) and public, valid invite codes (MRB-STUDENT/PARENT/TEACHER-2026).
// Planting either into a publicly-exposed instance is a backdoor + a
// self-register-as-teacher path. In production we skip ALL of them and create
// at most ONE admin from strong env credentials. Dev/test seed is unchanged.
const isProd = process.env.NODE_ENV === "production";
const seedDemo = process.env.SEED_DEMO === "true";
const seedMode = { isProd, seedDemo } as const;
const plantDemoData = shouldSeedDemoData(seedMode);

function resolveEnvAdmin(): EnvAdmin | null {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return null;

  return {
    id: "admin-seeded",
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    name: "运营管理员",
    title: "生产管理员",
  };
}

const adminFromEnv = plantDemoData ? null : resolveEnvAdmin();
const seedUserRows = selectSeedUsers(seed.users, {
  ...seedMode,
  adminFromEnv,
});
const seedInviteRows = selectSeedInvites(seed.invites, seedMode);
const seedUserIds = new Set(seedUserRows.map((user) => user.id));

function profileNameFor(userId: string) {
  const user = seed.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new Error(`Missing seed user for profile ${userId}`);
  }
  return { name: user.name, title: user.title };
}

async function seedUsers() {
  console.log("Seeding users + profiles...");
  if (seedUserRows.length === 0) {
    console.log("  (no credentialed accounts selected — skipping user seed)");
    return;
  }
  const guestTrialEnd = new Date();
  guestTrialEnd.setDate(guestTrialEnd.getDate() + 3);

  // Insert without circular FK fields first; relationships are synced after
  // classrooms and parent links exist.
  await db
    .insert(users)
    .values(
      seedUserRows.map((user) => ({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        trialExpiresAt: user.id === "guest-student" ? guestTrialEnd : null,
        subscriptionTier: user.id === "guest-student" ? "free" : "standard",
        onboardingCompleted: user.id === "guest-student" ? 0 : 1,
      })),
    )
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: sql`excluded.email`,
        passwordHash: sql`excluded.password_hash`,
        role: sql`excluded.role`,
        trialExpiresAt: sql`excluded.trial_expires_at`,
        onboardingCompleted: sql`excluded.onboarding_completed`,
        subscriptionTier: sql`excluded.subscription_tier`,
      },
    });

  const profileRows = seed.profiles.filter((profile) =>
    seedUserIds.has(profile.userId),
  );
  if (profileRows.length === 0) return;

  await db
    .insert(profiles)
    .values(
      profileRows.map((profile) => ({
        userId: profile.userId,
        ...profileNameFor(profile.userId),
        headline: profile.headline,
        bio: profile.bio,
        metrics: profile.metrics,
      })),
    )
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        name: sql`excluded.name`,
        title: sql`excluded.title`,
        headline: sql`excluded.headline`,
        bio: sql`excluded.bio`,
        metrics: sql`excluded.metrics`,
      },
    });
}

async function seedClassrooms() {
  console.log("Seeding classrooms...");

  await db
    .insert(classrooms)
    .values(seed.classrooms)
    .onConflictDoNothing();
}

async function seedParentLinks() {
  console.log("Seeding parent links...");

  await db
    .insert(studentParentLinks)
    .values(seed.parentLinks)
    .onConflictDoNothing();
}

async function syncUserRelationships() {
  console.log("Syncing user classroom/link relationships...");

  for (const user of seedUserRows) {
    const values: Partial<Pick<UserRecord, "classroomId" | "studentLinkId">> = {};

    if (user.classroomId) values.classroomId = user.classroomId;
    if (user.studentLinkId) values.studentLinkId = user.studentLinkId;

    if (Object.keys(values).length > 0) {
      await db.update(users).set(values).where(eq(users.id, user.id));
    }
  }
}

async function seedInvites() {
  console.log("Seeding invite codes...");
  if (seedInviteRows.length === 0) {
    console.log("  (no public invite codes selected — skipping invite seed)");
    return;
  }

  await db
    .insert(inviteCodes)
    .values(
      seedInviteRows.map((invite) => ({
        id: invite.id,
        code: invite.code,
        role: invite.role,
        label: invite.label,
        classroomId: invite.classroomId,
        studentLinkId: invite.studentLinkId,
        createdBy: invite.createdBy,
        usesRemaining: invite.usesRemaining,
        expiresAt: new Date(invite.expiresAt),
      })),
    )
    .onConflictDoNothing();
}

async function seedAssignments() {
  console.log("Seeding assignments...");

  await db
    .insert(assignments)
    .values(
      seed.assignments.map((assignment) => ({
        ...assignment,
        createdAt: new Date(assignment.createdAt),
      })),
    )
    .onConflictDoNothing();
}

async function seedScenarioRuns() {
  console.log("Seeding scenario runs...");

  const seededRunUserIds = seed.runs.map((run) => run.userId);
  await db.delete(scenarioRuns).where(inArray(scenarioRuns.userId, seededRunUserIds));

  await db
    .insert(scenarioRuns)
    .values(seed.runs)
    .onConflictDoNothing();
}

async function seedGrowthReports() {
  console.log("Seeding growth reports...");

  await db
    .insert(growthReports)
    .values(
      seed.growthReports.map((report, index) => ({
        id: `growth-report-${index + 1}`,
        studentUserId: report.studentUserId,
        parentUserId: report.parentUserId,
        payload: report,
      })),
    )
    .onConflictDoNothing();
}

async function verifySeedCounts() {
  const [userCount] = await db.select({ value: count() }).from(users);
  const [classroomCount] = await db.select({ value: count() }).from(classrooms);
  const [inviteCount] = await db.select({ value: count() }).from(inviteCodes);
  const [assignmentCount] = await db.select({ value: count() }).from(assignments);
  const [runCount] = await db.select({ value: count() }).from(scenarioRuns);
  const [growthReportCount] = await db.select({ value: count() }).from(growthReports);

  const results = {
    users: userCount?.value ?? 0,
    classrooms: classroomCount?.value ?? 0,
    invites: inviteCount?.value ?? 0,
    assignments: assignmentCount?.value ?? 0,
    runs: runCount?.value ?? 0,
    growthReports: growthReportCount?.value ?? 0,
  };

  console.log("Seed verification counts:", results);

  // The demo baseline only applies when the full demo data set is planted. A
  // hardened production seed legitimately has zero (or one env-admin) accounts.
  if (!plantDemoData) {
    return;
  }

  const expectedMinimum = {
    users: 8,
    classrooms: 1,
    invites: 3,
    assignments: 2,
    runs: 4,
    growthReports: 1,
  };

  for (const key of Object.keys(expectedMinimum) as Array<keyof typeof expectedMinimum>) {
    if (results[key] < expectedMinimum[key]) {
      throw new Error(
        `Seed count below baseline for ${key}: expected at least ${expectedMinimum[key]}, got ${results[key]}`,
      );
    }
  }
}

function logSeedMode() {
  if (plantDemoData) {
    if (isProd) {
      console.log(
        "PRODUCTION seed with SEED_DEMO=true: planting the FULL demo data set " +
          "(public-password accounts + public invite codes). Do NOT use on a " +
          "publicly-exposed instance.",
      );
    }
    return;
  }

  const skippedAccounts = seed.users.length;
  const skippedInvites = seed.invites.length;
  const adminSummary = adminFromEnv
    ? `created from SEED_ADMIN_EMAIL (${adminFromEnv.email})`
    : "NONE — set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD or create one manually";
  console.log(
    `PRODUCTION seed: skipped ${skippedAccounts} demo accounts + ` +
      `${skippedInvites} public invite codes; admin: ${adminSummary}.`,
  );
  if (!adminFromEnv) {
    console.warn(
      "WARNING: no admin account was seeded. Provision one out-of-band " +
        "(SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD, or a manual insert).",
    );
  }
}

async function main() {
  console.log("Brown Zone seed starting...");
  console.log(`DATABASE_URL: ${DATABASE_URL!.replace(/:[^@]+@/, ":***@")}`);
  logSeedMode();

  try {
    await seedUsers();
    if (plantDemoData) {
      await seedClassrooms();
      await seedParentLinks();
    }
    await syncUserRelationships();
    await seedInvites();
    if (plantDemoData) {
      await seedAssignments();
      await seedScenarioRuns();
      await seedGrowthReports();
    }
    await verifySeedCounts();

    console.log("Seed complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
