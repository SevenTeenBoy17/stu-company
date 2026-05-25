/**
 * Seeds the Brown Zone Postgres database with the same demo data that
 * `src/lib/store.ts` provides in memory. IDs are preserved where the seed
 * store defines them, and generated scenario/action IDs are made deterministic
 * inside this script so repeated seed runs stay idempotent.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { count, eq } from "drizzle-orm";
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

function profileNameFor(userId: string) {
  const user = seed.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new Error(`Missing seed user for profile ${userId}`);
  }
  return { name: user.name, title: user.title };
}

async function seedUsers() {
  console.log("Seeding users + profiles...");

  // Insert without circular FK fields first; relationships are synced after
  // classrooms and parent links exist.
  await db
    .insert(users)
    .values(
      seed.users.map((user) => ({
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(profiles)
    .values(
      seed.profiles.map((profile) => ({
        userId: profile.userId,
        ...profileNameFor(profile.userId),
        headline: profile.headline,
        bio: profile.bio,
        metrics: profile.metrics,
      })),
    )
    .onConflictDoNothing();
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

  for (const user of seed.users) {
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

  await db
    .insert(inviteCodes)
    .values(
      seed.invites.map((invite) => ({
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

  const expected = {
    users: 6,
    classrooms: 1,
    invites: 3,
    assignments: 2,
    runs: 3,
    growthReports: 1,
  };

  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (results[key] !== expected[key]) {
      throw new Error(`Seed count mismatch for ${key}: expected ${expected[key]}, got ${results[key]}`);
    }
  }
}

async function main() {
  console.log("Brown Zone seed starting...");
  console.log(`DATABASE_URL: ${DATABASE_URL!.replace(/:[^@]+@/, ":***@")}`);

  try {
    await seedUsers();
    await seedClassrooms();
    await seedParentLinks();
    await syncUserRelationships();
    await seedInvites();
    await seedAssignments();
    await seedScenarioRuns();
    await seedGrowthReports();
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
