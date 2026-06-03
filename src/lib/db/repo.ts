/**
 * Brown Zone DB Adapter Layer
 * ============================================
 * This module is the single bridge between API routes and persistence.
 *
 * When DATABASE_URL is missing or a DB query fails, every function delegates to
 * the legacy in-memory store. That keeps the offline teacher-computer demo
 * working while allowing the hosted app to use Supabase Postgres.
 */

import { and, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";

import { z } from "zod";

import {
  ActionLogSchema,
  HoldingSchema,
  PortfolioSnapshotSchema,
} from "@/lib/db/payload-schemas";
import { hashPassword, verifyPassword } from "@/lib/password";

import { learningModules } from "@/lib/content";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import { getRequestExecutor } from "@/lib/db/rls-context";
import {
  aiMessages,
  aiSessions,
  assignments,
  classrooms,
  familyMembers,
  growthReports,
  inviteCodes,
  leaderboardSnapshots,
  learningProgress,
  paymentOrders,
  profiles,
  rankProfiles,
  scenarioRuns,
  schools,
  studentParentLinks,
  subscriptionGrants,
  users,
} from "@/lib/db/schema";
import {
  canAddFamilyMember,
  resolveSubscriptionState,
} from "@/lib/billing/subscription";
import { currentSeasonSeed } from "@/lib/season";
import { applySoftFloor, tierFromPower } from "@/lib/leaderboard/tiers";
import { normalizeSchoolName } from "@/lib/leaderboard/school-normalize";
import type { RankSnapshot } from "@/lib/leaderboard/ranking";
import {
  advanceSimulationRun,
  applyEventChoice,
  applySimulationAction,
  buildBehaviorSignals,
  buildGrowthReport,
  buildLeaderboard,
  buildSimulationState,
  createInitialRun,
  deriveInvestorPersona,
} from "@/lib/simulation";
import * as store from "@/lib/store";
import type {
  AiChatMessage,
  AiChatMode,
  AiChatSession,
  Assignment,
  Classroom,
  FamilyDigest,
  GrowthReport,
  InviteCode,
  LeaderboardSnapshot,
  LearningProgressRow,
  LearningProgressSummary,
  PaymentChannel,
  PaymentOrder,
  PaymentStatus,
  PowerComponentsRecord,
  ProfileRecord,
  RankPeriod,
  RankProfile,
  RankVisibility,
  Role,
  ScenarioRun,
  School,
  SubscriptionGrant,
  SubscriptionTier,
  UserRecord,
} from "@/lib/types";
import { createId } from "@/lib/utils";

type Db = NonNullable<ReturnType<typeof getDb>>;
type DbExecutor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbUser = typeof users.$inferSelect;
type DbProfile = typeof profiles.$inferSelect;
type DbInvite = typeof inviteCodes.$inferSelect;
type DbClassroom = typeof classrooms.$inferSelect;
type DbRun = typeof scenarioRuns.$inferSelect;
type DbAssignment = typeof assignments.$inferSelect;
type DbAiSession = typeof aiSessions.$inferSelect;
type DbPaymentOrder = typeof paymentOrders.$inferSelect;
type DbSubscriptionGrant = typeof subscriptionGrants.$inferSelect;
type DbSchool = typeof schools.$inferSelect;
type DbRankProfile = typeof rankProfiles.$inferSelect;
type DbLeaderboardSnapshot = typeof leaderboardSnapshots.$inferSelect;
type FallbackReason = "no_database_url" | "connection_failed" | "query_failed";

const DB_QUERY_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT_MS ?? 5000);

// In production, default to NO memory fallback so DB outages surface as 5xx
// rather than silently returning seed data. Set ALLOW_MEMORY_FALLBACK=true to
// keep the offline teacher-laptop demo behaviour.
const ALLOW_MEMORY_FALLBACK =
  process.env.ALLOW_MEMORY_FALLBACK === "true" || process.env.NODE_ENV !== "production";

// P5/P6: fallback observability. The stable "[repo.fallback]" prefix is the
// greppable SLI (wire a Vercel log-drain / Sentry alert to it). Transient failures
// are rate-limited (5s) so a sustained DB outage can't flood logs; the error text
// is scrubbed of emails/tokens; and "no DATABASE_URL" is logged once so a
// misconfigured prod silently running on ephemeral memory is detectable.
let fallbackCount = 0;
let loggedNoDb = false;
let lastFallbackLogAt = 0;

/** Redact emails / long hex secrets from an error message before logging (P6). */
export function scrubError(err: unknown): string {
  if (err === undefined || err === null) return "";
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>")
    .replace(/\b[a-f0-9]{16,}\b/gi, "<token>")
    .slice(0, 200);
}

function logFallback(fn: string, reason: FallbackReason, err?: unknown) {
  fallbackCount += 1;
  if (process.env.NODE_ENV === "test") return;

  if (reason === "no_database_url") {
    if (loggedNoDb) return;
    loggedNoDb = true;
    console.warn("[repo.fallback] running on in-memory store (no DATABASE_URL) — degraded mode");
    return;
  }

  const now = Date.now();
  if (now - lastFallbackLogAt < 5000) return;
  lastFallbackLogAt = now;
  console.warn(`[repo.fallback] fn=${fn} reason=${reason} count=${fallbackCount} ${scrubError(err)}`.trim());
}

async function withQueryTimeout<T>(fn: string, promise: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${fn} timed out after ${DB_QUERY_TIMEOUT_MS}ms`)),
          DB_QUERY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

// Functions that PERSIST data. A configured DB that throws on one of these must
// surface the error — never silently fall back to the in-memory store, which would
// be a fake success + lost/diverged student data (audit R1 / P2). Reads may still
// fall back to seed/demo data when ALLOW_MEMORY_FALLBACK is on (offline demo).
const WRITE_FNS = new Set<string>([
  "applyActionForUser", "applyEventChoiceForUser", "advanceRunForUser", "replayRunForUser",
  "upsertLeaderboardSnapshot", "upsertRankProfile", "findOrCreateSchool", "markModuleComplete",
  "markOnboardingCompleted", "markEmailVerified", "createAiSession", "appendAiMessage",
  "registerUserByInvite", "registerUserByEmail", "addFamilyMember", "removeFamilyMember",
  "createAssignmentForTeacher", "bumpTokenVersion", "updateUserPassword", "updateUserEmail",
  "createAdminManagedUser", "updateAdminManagedUser", "createPaymentOrder",
  "updatePaymentOrderProviderFields", "markPaymentOrderStatus", "fulfillPaymentOrder",
]);

async function withDbExecutor<T>(
  fn: string,
  executor: DbExecutor | null,
  dbFn: (db: DbExecutor) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isDatabaseConfigured()) {
    if (!ALLOW_MEMORY_FALLBACK) {
      throw new Error(`[repo] ${fn}: DATABASE_URL not configured`);
    }
    logFallback(fn, "no_database_url");
    return await fallback();
  }

  if (!executor) {
    if (!ALLOW_MEMORY_FALLBACK) {
      throw new Error(`[repo] ${fn}: DB client unavailable`);
    }
    logFallback(fn, "connection_failed");
    return await fallback();
  }

  try {
    return await withQueryTimeout(fn, dbFn(executor));
  } catch (err) {
    logFallback(fn, "query_failed", err);
    // Writes never silently fall back (P2): a failed persist must surface as an
    // error, not pretend success in memory. Reads fall back only when allowed.
    if (WRITE_FNS.has(fn) || !ALLOW_MEMORY_FALLBACK) {
      throw err;
    }
    return await fallback();
  }
}

// Default service path (owner connection, RLS bypassed). Used by the vast
// majority of repo functions and ALL system / cron / admin / auth-bootstrap work.
async function withDb<T>(
  fn: string,
  dbFn: (db: Db) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  // Sound: withDbExecutor only ever invokes this with getDb()'s Db.
  return withDbExecutor(fn, getDb(), dbFn as unknown as (db: DbExecutor) => Promise<T>, fallback);
}

// Per-request user-scoped path. Uses the active request's executor: the scoped
// `authenticated` tx when inside withUserRls (RLS enforced), else the owner
// connection (default, today's behaviour). Opt user-scoped READ paths into this
// — system callers reach it outside any withUserRls and transparently get owner.
// See docs/rls-enforcement-staging-plan.md.
async function withScopedDb<T>(
  fn: string,
  dbFn: (db: DbExecutor) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  return withDbExecutor(fn, getRequestExecutor(), dbFn, fallback);
}

function maybeUndefined<T>(value: T | null | undefined) {
  return value === null ? undefined : value;
}

function maybeIso(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toUserRecord(row: DbUser, profile?: DbProfile | null): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    name: profile?.name ?? row.email,
    title: profile?.title ?? row.role,
    classroomId: maybeUndefined(row.classroomId),
    studentLinkId: maybeUndefined(row.studentLinkId),
    tokenVersion: row.tokenVersion ?? 0,
    trialExpiresAt: maybeIso(row.trialExpiresAt),
    subscriptionTier: (["free", "standard", "premium"].includes(row.subscriptionTier) ? row.subscriptionTier : "free") as UserRecord["subscriptionTier"],
    subscriptionExpiresAt: maybeIso(row.subscriptionExpiresAt),
    onboardingCompleted: row.onboardingCompleted ?? 0,
    emailVerifiedAt: maybeIso(row.emailVerifiedAt),
  };
}

function toAdminUserSummary(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    title: user.title,
    classroomId: user.classroomId,
    tokenVersion: user.tokenVersion ?? 0,
    trialExpiresAt: user.trialExpiresAt,
    subscriptionTier: user.subscriptionTier ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    onboardingCompleted: user.onboardingCompleted ?? 0,
  };
}

function toPaymentOrder(row: DbPaymentOrder): PaymentOrder {
  return {
    id: row.id,
    outTradeNo: row.outTradeNo,
    userId: row.userId,
    targetUserId: row.targetUserId,
    tier: row.tier as Exclude<SubscriptionTier, "free">,
    channel: row.channel as PaymentChannel,
    amountFen: row.amountFen,
    description: row.description,
    status: row.status as PaymentStatus,
    codeUrl: maybeUndefined(row.codeUrl),
    prepayId: maybeUndefined(row.prepayId),
    transactionId: maybeUndefined(row.transactionId),
    paidAt: maybeIso(row.paidAt),
    expiresAt: maybeIso(row.expiresAt) ?? new Date().toISOString(),
    createdAt: maybeIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: maybeIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toSubscriptionGrant(row: DbSubscriptionGrant): SubscriptionGrant {
  return {
    id: row.id,
    userId: row.userId,
    orderId: row.orderId,
    tier: row.tier as Exclude<SubscriptionTier, "free">,
    startsAt: maybeIso(row.startsAt) ?? new Date().toISOString(),
    expiresAt: maybeIso(row.expiresAt) ?? new Date().toISOString(),
    createdAt: maybeIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toProfileRecord(row: DbProfile): ProfileRecord {
  return {
    userId: row.userId,
    headline: row.headline,
    bio: row.bio,
    metrics: row.metrics as ProfileRecord["metrics"],
  };
}

function toClassroom(row: DbClassroom): Classroom {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    teacherId: row.teacherId,
    challengeTheme: row.challengeTheme,
    schoolRank: row.schoolRank,
  };
}

function toInvite(row: DbInvite): InviteCode {
  return {
    id: row.id,
    code: row.code,
    role: row.role,
    classroomId: maybeUndefined(row.classroomId),
    studentLinkId: maybeUndefined(row.studentLinkId),
    label: row.label,
    createdBy: row.createdBy,
    usesRemaining: row.usesRemaining,
    expiresAt: row.expiresAt.toISOString(),
  };
}

// L2: structural validation at the JSONB boundary. Each schema only checks
// the load-bearing fields (id/type/round/etc.); unknown extras pass through
// via .passthrough(). Failures throw so a malformed row surfaces as a
// caught DB error instead of crashing a React component downstream.
function parseJsonbArray<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  fieldName: string,
): unknown[] {
  const parsed = z.array(schema).safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[repo] scenario_runs.${fieldName} JSONB is malformed`);
  }
  return parsed.data;
}

function parseEventHistory(raw: unknown): string[] {
  const parsed = z.array(z.unknown()).safeParse(raw);
  if (!parsed.success) {
    throw new Error(`[repo] scenario_runs.eventHistory JSONB is malformed`);
  }

  return parsed.data
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const readable =
          record.title ?? record.name ?? record.label ?? record.id ?? record.type;
        if (typeof readable === "string" && readable.trim()) return readable;
      }
      return null;
    })
    .filter((entry): entry is string => Boolean(entry));
}

function toRun(row: DbRun): ScenarioRun {
  const eventHistory = parseEventHistory(row.eventHistory);

  return {
    id: row.id,
    userId: row.userId,
    classroomId: row.classroomId,
    scenarioName: row.scenarioName,
    currentRound: row.currentRound,
    totalRounds: row.totalRounds,
    cash: row.cash,
    savings: row.savings,
    debt: row.debt,
    propertyUnits: row.propertyUnits,
    propertyBasis: row.propertyBasis,
    ventureStake: row.ventureStake,
    ventureBasis: row.ventureBasis,
    holdings: parseJsonbArray(HoldingSchema, row.holdings, "holdings") as unknown as ScenarioRun["holdings"],
    eventHistory,
    actionLog: parseJsonbArray(ActionLogSchema, row.actionLog, "actionLog") as unknown as ScenarioRun["actionLog"],
    snapshots: parseJsonbArray(
      PortfolioSnapshotSchema,
      row.snapshots,
      "snapshots",
    ) as unknown as ScenarioRun["snapshots"],
    lastInsight: maybeUndefined(row.lastInsight),
    seed: row.seed ?? undefined,
    eventTimeline: Array.isArray(row.eventTimeline)
      ? (row.eventTimeline as string[])
      : undefined,
    netWorth: row.netWorth ?? undefined,
  };
}

function toRunInsert(run: ScenarioRun): typeof scenarioRuns.$inferInsert {
  return {
    id: run.id,
    userId: run.userId,
    classroomId: run.classroomId,
    scenarioName: run.scenarioName,
    currentRound: run.currentRound,
    totalRounds: run.totalRounds,
    cash: run.cash,
    savings: run.savings,
    debt: run.debt,
    propertyUnits: run.propertyUnits,
    propertyBasis: run.propertyBasis,
    ventureStake: run.ventureStake,
    ventureBasis: run.ventureBasis,
    holdings: run.holdings,
    eventHistory: run.eventHistory,
    actionLog: run.actionLog,
    snapshots: run.snapshots,
    lastInsight: run.lastInsight,
    seed: run.seed ?? null,
    eventTimeline: run.eventTimeline ?? null,
    netWorth: run.netWorth ?? null,
  };
}

function toRunUpdate(run: ScenarioRun) {
  return {
    scenarioName: run.scenarioName,
    currentRound: run.currentRound,
    totalRounds: run.totalRounds,
    cash: run.cash,
    savings: run.savings,
    debt: run.debt,
    propertyUnits: run.propertyUnits,
    propertyBasis: run.propertyBasis,
    ventureStake: run.ventureStake,
    ventureBasis: run.ventureBasis,
    holdings: run.holdings,
    eventHistory: run.eventHistory,
    actionLog: run.actionLog,
    snapshots: run.snapshots,
    lastInsight: run.lastInsight,
    seed: run.seed ?? null,
    eventTimeline: run.eventTimeline ?? null,
    netWorth: run.netWorth ?? null,
  };
}

function toAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id,
    classroomId: row.classroomId,
    title: row.title,
    brief: row.brief,
    difficulty: row.difficulty as Assignment["difficulty"],
    dueLabel: row.dueLabel,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function toGrowthReport(row: typeof growthReports.$inferSelect): GrowthReport {
  return row.payload as GrowthReport;
}

function toAiSession(row: DbAiSession): AiChatSession {
  return row.payload as AiChatSession;
}

async function selectUserById(executor: DbExecutor, id: string) {
  const [row] = await executor
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, id))
    .limit(1);

  return row ? toUserRecord(row.user, row.profile) : null;
}

async function selectUserByEmail(executor: DbExecutor, email: string) {
  const [row] = await executor
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(ilike(users.email, email))
    .limit(1);

  return row ? toUserRecord(row.user, row.profile) : null;
}

async function selectRunForUser(executor: DbExecutor, userId: string) {
  const [row] = await executor.select().from(scenarioRuns).where(eq(scenarioRuns.userId, userId)).limit(1);
  return row ? toRun(row) : null;
}

async function selectClassroomById(executor: DbExecutor, classroomId?: string) {
  if (!classroomId) return null;
  const [row] = await executor.select().from(classrooms).where(eq(classrooms.id, classroomId)).limit(1);
  return row ? toClassroom(row) : null;
}

async function selectDefaultClassroomId(executor: DbExecutor, fallbackTeacherId: string) {
  const [existing] = await executor.select().from(classrooms).limit(1);
  if (existing) return existing.id;

  const classroomId = "sandbox-open";
  await executor
    .insert(classrooms)
    .values({
      id: classroomId,
      name: "开放沙盘",
      region: "线上",
      teacherId: fallbackTeacherId,
      challengeTheme: "自由探索",
      schoolRank: 0,
    })
    .onConflictDoNothing();
  return classroomId;
}

async function ensureStudentSandbox(executor: DbExecutor, user: UserRecord) {
  if (user.role !== "student") {
    throw new Error("当前账号不是学生账号。");
  }

  let classroomId = user.classroomId;
  if (!classroomId) {
    classroomId = await selectDefaultClassroomId(executor, user.id);
    await executor.update(users).set({ classroomId }).where(eq(users.id, user.id));
    user.classroomId = classroomId;
  }

  let classroom = await selectClassroomById(executor, classroomId);
  if (!classroom) {
    const fallbackClassroomId = await selectDefaultClassroomId(executor, user.id);
    await executor.update(users).set({ classroomId: fallbackClassroomId }).where(eq(users.id, user.id));
    user.classroomId = fallbackClassroomId;
    classroomId = fallbackClassroomId;
    classroom = await selectClassroomById(executor, fallbackClassroomId);
  }

  if (!classroom) {
    throw new Error("沙盘课堂暂时不可用，请稍后重试。");
  }

  let run = await selectRunForUser(executor, user.id);
  if (!run) {
    const initialRun = createInitialRun(user.id, classroomId);
    await executor.insert(scenarioRuns).values(toRunInsert(initialRun)).onConflictDoNothing();
    run = (await selectRunForUser(executor, user.id)) ?? initialRun;
  }

  return { user, classroom, run };
}

async function selectAllUsers(executor: DbExecutor) {
  const rows = await executor
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id));

  return rows.map((row) => toUserRecord(row.user, row.profile));
}

async function selectAllRuns(executor: DbExecutor) {
  const rows = await executor.select().from(scenarioRuns);
  return rows.map(toRun);
}

async function syncGrowthReportForStudent(executor: DbExecutor, studentUserId: string) {
  const [linkRow] = await executor
    .select()
    .from(studentParentLinks)
    .where(eq(studentParentLinks.studentUserId, studentUserId))
    .limit(1);
  const run = await selectRunForUser(executor, studentUserId);

  if (!linkRow || !run) return;

  const report = buildGrowthReport(run, linkRow.studentUserId, linkRow.parentUserId);

  // H8: atomic upsert. The unique index on student_user_id makes this race
  // free, so concurrent applyAction calls can't produce duplicate reports.
  await executor
    .insert(growthReports)
    .values({
      id: createId("growth-report"),
      studentUserId: linkRow.studentUserId,
      parentUserId: linkRow.parentUserId,
      payload: report,
    })
    .onConflictDoUpdate({
      target: growthReports.studentUserId,
      set: {
        parentUserId: linkRow.parentUserId,
        payload: report,
      },
    });
}

type DbAiMessage = typeof aiMessages.$inferSelect;

function toAiMessage(row: DbAiMessage): AiChatMessage {
  return {
    id: row.id,
    role: row.role as AiChatMessage["role"],
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    meta: (row.meta ?? undefined) as AiChatMessage["meta"],
  };
}

async function loadSessionMessages(executor: DbExecutor, sessionId: string) {
  const rows = await executor
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.sessionId, sessionId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(50);

  // Reverse to oldest-first for downstream consumers.
  return rows.reverse().map(toAiMessage);
}

async function listAiSessionRows(executor: DbExecutor, userId: string) {
  const rows = await executor
    .select()
    .from(aiSessions)
    .where(eq(aiSessions.userId, userId))
    .orderBy(desc(aiSessions.updatedAt));

  // H7: session list excludes message bodies; callers load on demand via
  // getAiSessionById. Keep the legacy AiChatSession shape (messages: []) so
  // existing UI code paths continue to compile without churn.
  return rows.map((row) => {
    const session = toAiSession(row);
    return { ...session, messages: [] as AiChatMessage[] };
  });
}

// ---------------------------------------------------------------------------
// Reset / test helpers
// ---------------------------------------------------------------------------

export async function resetStoreForTests() {
  return store.resetStoreForTests();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string) {
  return withDb("findUserByEmail", (db) => selectUserByEmail(db, email), () => store.findUserByEmail(email));
}

export async function findUserById(id: string) {
  return withDb("findUserById", (db) => selectUserById(db, id), () => store.findUserById(id));
}

export async function findProfileByUserId(userId: string) {
  return withDb(
    "findProfileByUserId",
    async (db) => {
      const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      return row ? toProfileRecord(row) : null;
    },
    () => store.findProfileByUserId(userId),
  );
}

// ---------------------------------------------------------------------------
// Auth & invite
// ---------------------------------------------------------------------------

export async function findInviteByCode(code: string) {
  return withDb(
    "findInviteByCode",
    async (db) => {
      const [row] = await db.select().from(inviteCodes).where(ilike(inviteCodes.code, code)).limit(1);
      return row ? toInvite(row) : null;
    },
    () => store.findInviteByCode(code),
  );
}

export async function validateInviteCode(code: string) {
  return withDb(
    "validateInviteCode",
    async (db) => {
      const invite = await findInviteByCodeWithExecutor(db, code);
      if (!invite) return { valid: false, reason: "邀请码不存在。" };
      if (invite.usesRemaining <= 0) return { valid: false, reason: "邀请码已达到使用上限。" };
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return { valid: false, reason: "邀请码已过期。" };
      }
      return { valid: true, invite };
    },
    () => store.validateInviteCode(code),
  );
}

async function findInviteByCodeWithExecutor(executor: DbExecutor, code: string) {
  const [row] = await executor.select().from(inviteCodes).where(ilike(inviteCodes.code, code)).limit(1);
  return row ? toInvite(row) : null;
}

export async function markEmailVerified(userId: string) {
  return withDb(
    "markEmailVerified",
    async (db) => {
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
      return true;
    },
    () => store.markEmailVerified(userId),
  );
}

export async function authenticateUser(email: string, password: string) {
  return withDb(
    "authenticateUser",
    async (db) => {
      const user = await selectUserByEmail(db, email);
      if (!user) return null;
      return (await verifyPassword(password, user.passwordHash)) ? user : null;
    },
    () => store.authenticateUser(email, password),
  );
}

export async function registerUserByInvite(input: {
  inviteCode: string;
  name: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  return withDb(
    "registerUserByInvite",
    async (db) =>
      db.transaction(async (tx) => {
        // C5: atomic reservation — decrement usesRemaining only if there is
        // still capacity AND the code has not expired. Prevents the
        // SELECT-then-UPDATE race that previously allowed multiple concurrent
        // registrations to share the same one-time invite.
        const reservedRows = await tx
          .update(inviteCodes)
          .set({ usesRemaining: sql`${inviteCodes.usesRemaining} - 1` })
          .where(
            and(
              ilike(inviteCodes.code, input.inviteCode),
              sql`${inviteCodes.usesRemaining} > 0`,
              sql`${inviteCodes.expiresAt} > now()`,
            ),
          )
          .returning();

        if (reservedRows.length === 0) {
          const probe = await findInviteByCodeWithExecutor(tx, input.inviteCode);
          if (!probe) throw new Error("邀请码不存在。");
          if (new Date(probe.expiresAt).getTime() < Date.now()) {
            throw new Error("邀请码已过期。");
          }
          throw new Error("邀请码已达到使用上限。");
        }

        const invite = toInvite(reservedRows[0]);

        const existingUser = await selectUserByEmail(tx, normalizedEmail);
        if (existingUser) throw new Error("这个邮箱已经被注册过了。");

        const newUser: UserRecord = {
          id: createId("user"),
          email: normalizedEmail,
          passwordHash: await hashPassword(input.password),
          role: invite.role,
          name: input.name,
          title:
            invite.role === "student"
              ? "新加入的试点学生"
              : invite.role === "teacher"
                ? "新加入的教师账号"
                : invite.role === "parent"
                  ? "新绑定的家长账号"
                  : "新加入的管理员",
          classroomId: invite.classroomId,
          studentLinkId: invite.studentLinkId,
        };

        await tx.insert(users).values({
          id: newUser.id,
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          role: newUser.role,
          classroomId: newUser.classroomId,
          studentLinkId: newUser.studentLinkId,
        });

        await tx.insert(profiles).values({
          userId: newUser.id,
          name: newUser.name,
          title: newUser.title,
          headline: "刚刚加入 Brown Zone 试点环境。",
          bio: "欢迎来到示范环境，建议先从 Demo 入口体验完整路径。",
          metrics: [
            { label: "角色", value: newUser.role },
            { label: "加入方式", value: "邀请码" },
          ],
        });

        if (newUser.role === "student" && newUser.classroomId) {
          await tx.insert(scenarioRuns).values(toRunInsert(createInitialRun(newUser.id, newUser.classroomId)));
        }

        if (newUser.role === "parent" && invite.studentLinkId) {
          const [link] = await tx
            .update(studentParentLinks)
            .set({ parentUserId: newUser.id })
            .where(eq(studentParentLinks.id, invite.studentLinkId))
            .returning();
          const linkedRun = link ? await selectRunForUser(tx, link.studentUserId) : null;

          if (link && linkedRun) {
            const report = buildGrowthReport(linkedRun, link.studentUserId, newUser.id);
            await tx.insert(growthReports).values({
              id: createId("growth-report"),
              studentUserId: link.studentUserId,
              parentUserId: newUser.id,
              payload: report,
            });
          }
        }

        // usesRemaining already decremented above via atomic reservation.

        return newUser;
      }),
    () => store.registerUserByInvite({ ...input, email: normalizedEmail }),
  );
}

export async function registerUserByEmail(input: {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  return withDb(
    "registerUserByEmail",
    async (db) =>
      db.transaction(async (tx) => {
        const existingUser = await selectUserByEmail(tx, normalizedEmail);
        if (existingUser) throw new Error("这个邮箱已经被注册过了。");

        let role: UserRecord["role"] = "student";
        let classroomId: string | undefined;
        let studentLinkId: string | undefined;

        if (input.inviteCode) {
          const reservedRows = await tx
            .update(inviteCodes)
            .set({ usesRemaining: sql`${inviteCodes.usesRemaining} - 1` })
            .where(
              and(
                ilike(inviteCodes.code, input.inviteCode),
                sql`${inviteCodes.usesRemaining} > 0`,
                sql`${inviteCodes.expiresAt} > now()`,
              ),
            )
            .returning();

          if (reservedRows.length > 0) {
            const invite = toInvite(reservedRows[0]);
            role = invite.role;
            classroomId = invite.classroomId;
            studentLinkId = invite.studentLinkId;
          } else {
            throw new Error("邀请码无效、已过期或已用完。如不需要邀请码，请留空后重试。");
          }
        }

        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 3);

        const newUser: UserRecord = {
          id: createId("user"),
          email: normalizedEmail,
          passwordHash: await hashPassword(input.password),
          role,
          name: input.name,
          title: role === "student" ? "沙盘新玩家" : role === "teacher" ? "教师账号" : role === "parent" ? "家长账号" : "管理员",
          classroomId,
          studentLinkId,
          trialExpiresAt: trialEnd.toISOString(),
          subscriptionTier: "free",
          onboardingCompleted: 0,
        };

        await tx.insert(users).values({
          id: newUser.id,
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          role: newUser.role,
          classroomId: newUser.classroomId ?? null,
          studentLinkId: newUser.studentLinkId ?? null,
          trialExpiresAt: trialEnd,
          subscriptionTier: "free",
          onboardingCompleted: 0,
        });

        await tx.insert(profiles).values({
          userId: newUser.id,
          name: newUser.name,
          title: newUser.title,
          headline: "刚刚注册，准备开始 Mr.Brown 经济沙盘之旅。",
          bio: "新用户，享受 1 天全功能试用期。",
          metrics: [
            { label: "角色", value: newUser.role },
            { label: "加入方式", value: input.inviteCode ? "邀请码+邮箱" : "邮箱注册" },
          ],
        });

        if (newUser.role === "student" && newUser.classroomId) {
          await tx.insert(scenarioRuns).values(toRunInsert(createInitialRun(newUser.id, newUser.classroomId)));
        }

        if (newUser.role === "student" && !newUser.classroomId) {
          const SANDBOX_CLASSROOM_ID = "sandbox-open";
          const existing = await tx.select().from(classrooms).where(eq(classrooms.id, SANDBOX_CLASSROOM_ID)).limit(1);
          if (existing.length === 0) {
            await tx.insert(classrooms).values({
              id: SANDBOX_CLASSROOM_ID,
              name: "开放沙盘",
              region: "线上",
              teacherId: newUser.id,
              challengeTheme: "自由探索",
              schoolRank: 0,
            }).onConflictDoNothing();
          }
          await tx.update(users).set({ classroomId: SANDBOX_CLASSROOM_ID }).where(eq(users.id, newUser.id));
          newUser.classroomId = SANDBOX_CLASSROOM_ID;
          await tx.insert(scenarioRuns).values(toRunInsert(createInitialRun(newUser.id, SANDBOX_CLASSROOM_ID)));
        }

        return newUser;
      }),
    () => store.registerUserByEmail({ ...input, email: normalizedEmail }),
  );
}

export async function markOnboardingCompleted(userId: string) {
  return withDb(
    "markOnboardingCompleted",
    async (db) => {
      await db.update(users).set({ onboardingCompleted: 1 }).where(eq(users.id, userId));
      return true;
    },
    () => store.markOnboardingCompleted(userId),
  );
}

// ---------------------------------------------------------------------------
// Classroom & sim
// ---------------------------------------------------------------------------

export async function getClassroomById(classroomId?: string) {
  return withDb("getClassroomById", (db) => selectClassroomById(db, classroomId), () =>
    store.getClassroomById(classroomId),
  );
}

export async function getRunForUser(userId: string) {
  return withDb("getRunForUser", (db) => selectRunForUser(db, userId), () => store.getRunForUser(userId));
}

export async function getSimulationStateForUser(userId: string) {
  return withDb(
    "getSimulationStateForUser",
    async (db) => {
      const user = await selectUserById(db, userId);
      if (!user || user.role !== "student") {
        throw new Error("当前账号没有可用的学生沙盘。");
      }

      const ready = await db.transaction((tx) => ensureStudentSandbox(tx, user));

      const [allUsers, allRuns] = await Promise.all([selectAllUsers(db), selectAllRuns(db)]);
      return buildSimulationState(
        ready.user,
        ready.classroom,
        ready.run,
        allRuns.filter((item) => item.classroomId === ready.user.classroomId),
        allUsers.filter((item) => item.classroomId === ready.user.classroomId),
      );
    },
    () => store.getSimulationStateForUser(userId),
  );
}

export async function applyActionForUser(
  userId: string,
  input: Parameters<typeof store.applyActionForUser>[1],
) {
  return withDb(
    "applyActionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUser(tx, userId);
        if (!run) throw new Error("未找到对应的学生沙盘。");

        const updated = applySimulationAction(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(updated)).where(eq(scenarioRuns.id, updated.id));
        await syncGrowthReportForStudent(tx, userId);
        return updated;
      }),
    () => store.applyActionForUser(userId, input),
  );
}

export async function applyEventChoiceForUser(userId: string, choiceId: string) {
  return withDb(
    "applyEventChoiceForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUser(tx, userId);
        if (!run) throw new Error("未找到对应的学生沙盘。");

        const updated = applyEventChoice(run, choiceId);
        await tx.update(scenarioRuns).set(toRunUpdate(updated)).where(eq(scenarioRuns.id, updated.id));
        await syncGrowthReportForStudent(tx, userId);
        return updated;
      }),
    () => store.applyEventChoiceForUser(userId, choiceId),
  );
}

export async function findFamilyOwnerForStudent(studentUserId: string) {
  return withDb(
    "findFamilyOwnerForStudent",
    async (db) => {
      const [row] = await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.studentUserId, studentUserId))
        .limit(1);
      return row?.ownerUserId ?? null;
    },
    () => store.findFamilyOwnerForStudent(studentUserId),
  );
}

/** Upgrade a student to Premium while their family owner's subscription is active. */
export async function applyFamilyEntitlement(user: UserRecord): Promise<UserRecord> {
  if (user.role !== "student") return user;
  return withDb(
    "applyFamilyEntitlement",
    async (db) => {
      // Single join (1 query on the hot per-request student auth path) instead of
      // a familyMembers lookup + a separate owner fetch.
      const [row] = await db
        .select({
          tier: users.subscriptionTier,
          trialExpiresAt: users.trialExpiresAt,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
        })
        .from(familyMembers)
        .innerJoin(users, eq(users.id, familyMembers.ownerUserId))
        .where(eq(familyMembers.studentUserId, user.id))
        .limit(1);
      if (!row) return user;
      const tier = (["free", "standard", "premium"].includes(row.tier)
        ? row.tier
        : "free") as UserRecord["subscriptionTier"];
      const subscriptionExpiresAt = maybeIso(row.subscriptionExpiresAt);
      const state = resolveSubscriptionState(tier, maybeIso(row.trialExpiresAt), subscriptionExpiresAt);
      if (state.status === "active" && tier === "premium") {
        return { ...user, subscriptionTier: "premium", subscriptionExpiresAt };
      }
      return user;
    },
    () => store.applyFamilyEntitlement(user),
  );
}

export async function listFamilyMembers(ownerUserId: string) {
  return withDb(
    "listFamilyMembers",
    async (db) => {
      const rows = await db
        .select({ m: familyMembers, p: profiles, u: users })
        .from(familyMembers)
        .innerJoin(users, eq(users.id, familyMembers.studentUserId))
        .leftJoin(profiles, eq(profiles.userId, familyMembers.studentUserId))
        .where(eq(familyMembers.ownerUserId, ownerUserId));
      return rows.map(({ m, p, u }) => ({
        id: m.id,
        ownerUserId: m.ownerUserId,
        studentUserId: m.studentUserId,
        createdAt: m.createdAt.toISOString(),
        studentName: p?.name ?? u.email,
        studentEmail: u.email,
      }));
    },
    () => store.listFamilyMembers(ownerUserId),
  );
}

export async function addFamilyMember(ownerUserId: string, studentUserId: string) {
  return withDb(
    "addFamilyMember",
    async (db) =>
      db.transaction(async (tx) => {
        const owner = await selectUserById(tx, ownerUserId);
        const student = await selectUserById(tx, studentUserId);
        if (!owner || !student) throw new Error("用户不存在。");
        if (student.role !== "student") throw new Error("只能把学生加入家庭组。");

        const state = resolveSubscriptionState(
          owner.subscriptionTier,
          owner.trialExpiresAt,
          owner.subscriptionExpiresAt,
        );
        if (!(state.status === "active" && owner.subscriptionTier === "premium")) {
          throw new Error("只有高级版家长才能创建家庭组。");
        }

        const [link] = await tx
          .select()
          .from(studentParentLinks)
          .where(
            and(
              eq(studentParentLinks.parentUserId, ownerUserId),
              eq(studentParentLinks.studentUserId, studentUserId),
            ),
          )
          .limit(1);
        if (!link) throw new Error("你没有权限把该学生加入家庭组（需先与孩子绑定）。");

        const [existing] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.studentUserId, studentUserId))
          .limit(1);
        if (existing) throw new Error("该学生已在一个家庭组中。");

        // Lock this owner's existing family rows so concurrent adds serialize and
        // cannot both pass the seat-cap check (TOCTOU over-subscription).
        const current = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.ownerUserId, ownerUserId))
          .for("update");
        if (!canAddFamilyMember(current.length, state.features.maxStudents)) {
          throw new Error(`家庭名额已满（上限 ${state.features.maxStudents} 名）。`);
        }

        const id = createId("fam");
        await tx.insert(familyMembers).values({ id, ownerUserId, studentUserId });
        return { id, ownerUserId, studentUserId, createdAt: new Date().toISOString() };
      }),
    () => store.addFamilyMember(ownerUserId, studentUserId),
  );
}

export async function removeFamilyMember(ownerUserId: string, studentUserId: string) {
  return withDb(
    "removeFamilyMember",
    async (db) => {
      const deleted = await db
        .delete(familyMembers)
        .where(
          and(
            eq(familyMembers.ownerUserId, ownerUserId),
            eq(familyMembers.studentUserId, studentUserId),
          ),
        )
        .returning();
      return deleted.length > 0;
    },
    () => store.removeFamilyMember(ownerUserId, studentUserId),
  );
}

/** Global weekly season leaderboard across all runs that used this week's seed. */
export async function getSeasonLeaderboard() {
  return withDb(
    "getSeasonLeaderboard",
    async (db) => {
      // Filter to the current season's runs in SQL (indexed) instead of scanning
      // every historical run, then only load the users who own those runs.
      const seed = currentSeasonSeed();
      // Rank in SQL (composite index seed, net_worth) and take only the top N,
      // instead of loading every season run and sorting in the app.
      const runRows = await db
        .select()
        .from(scenarioRuns)
        .where(eq(scenarioRuns.seed, seed))
        .orderBy(sql`${scenarioRuns.netWorth} desc nulls last`)
        .limit(20);
      const runs = runRows.map(toRun);
      if (runs.length === 0) return [];

      const ownerIds = [...new Set(runs.map((run) => run.userId))];
      const userRows = await db
        .select({ user: users, profile: profiles })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(inArray(users.id, ownerIds));
      const userRecords = userRows.map((row) => toUserRecord(row.user, row.profile));
      return buildLeaderboard(runs, userRecords);
    },
    () => store.getSeasonLeaderboard(),
  );
}

/** Weekly digests for the Premium family report email cron. */
export async function listPremiumFamilyDigests(): Promise<FamilyDigest[]> {
  return withDb(
    "listPremiumFamilyDigests",
    async (db) => {
      const members = await db.select().from(familyMembers);
      const digests: FamilyDigest[] = [];
      for (const member of members) {
        const owner = await selectUserById(db, member.ownerUserId);
        if (!owner) continue;
        const state = resolveSubscriptionState(
          owner.subscriptionTier,
          owner.trialExpiresAt,
          owner.subscriptionExpiresAt,
        );
        if (!(state.status === "active" && owner.subscriptionTier === "premium")) continue;

        const student = await selectUserById(db, member.studentUserId);
        const [runRow] = await db
          .select()
          .from(scenarioRuns)
          .where(eq(scenarioRuns.userId, member.studentUserId))
          .limit(1);
        if (!student || !runRow) continue;
        const run = toRun(runRow);
        digests.push({
          ownerEmail: owner.email,
          ownerName: owner.name,
          studentName: student.name,
          netWorth: run.snapshots.at(-1)?.netWorth ?? 0,
          round: run.currentRound,
          persona: deriveInvestorPersona(run).label,
        });
      }
      return digests;
    },
    () => store.listPremiumFamilyDigests(),
  );
}

/** Premium season replay: reset the user's run to a fresh seed (same row id). */
export async function replayRunForUser(userId: string) {
  return withDb(
    "replayRunForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUser(tx, userId);
        if (!run) throw new Error("未找到对应的学生沙盘。");

        // Off-season practice seed (random) so a replay gives fresh variety and
        // does not collide with the fair weekly-season leaderboard.
        const fresh = createInitialRun(
          userId,
          run.classroomId,
          run.scenarioName,
          (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1,
        );
        fresh.id = run.id;
        await tx.update(scenarioRuns).set(toRunUpdate(fresh)).where(eq(scenarioRuns.id, run.id));
        await syncGrowthReportForStudent(tx, userId);
        return fresh;
      }),
    () => store.replayRunForUser(userId),
  );
}

export async function advanceRunForUser(userId: string) {
  return withDb(
    "advanceRunForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUser(tx, userId);
        if (!run) throw new Error("未找到对应的学生沙盘。");

        const updated = advanceSimulationRun(run);
        await tx.update(scenarioRuns).set(toRunUpdate(updated)).where(eq(scenarioRuns.id, updated.id));
        await syncGrowthReportForStudent(tx, userId);
        return updated;
      }),
    () => store.advanceRunForUser(userId),
  );
}

// ---------------------------------------------------------------------------
// Teacher / parent / admin overviews
// ---------------------------------------------------------------------------

export async function createAssignmentForTeacher(
  teacherId: string,
  input: Pick<Assignment, "title" | "brief" | "difficulty" | "dueLabel">,
) {
  return withDb(
    "createAssignmentForTeacher",
    async (db) => {
      const teacher = await selectUserById(db, teacherId);
      if (!teacher?.classroomId) {
        throw new Error("当前教师账号没有绑定班级。");
      }

      const assignment: Assignment = {
        id: createId("assignment"),
        classroomId: teacher.classroomId,
        title: input.title,
        brief: input.brief,
        difficulty: input.difficulty,
        dueLabel: input.dueLabel,
        createdBy: teacherId,
        createdAt: new Date().toISOString(),
      };

      await db.insert(assignments).values({
        ...assignment,
        createdAt: new Date(assignment.createdAt),
      });

      return assignment;
    },
    () => store.createAssignmentForTeacher(teacherId, input),
  );
}

export async function getTeacherOverview(userId: string) {
  return withDb(
    "getTeacherOverview",
    async (db) => {
      const teacher = await selectUserById(db, userId);
      if (!teacher?.classroomId) {
        throw new Error("当前账号没有教师权限或未绑定班级。");
      }

      const classroom = await selectClassroomById(db, teacher.classroomId);
      if (!classroom) throw new Error("班级不存在。");

      const [allUsers, allRuns, assignmentRows, inviteRows] = await Promise.all([
        selectAllUsers(db),
        selectAllRuns(db),
        db.select().from(assignments).where(eq(assignments.classroomId, classroom.id)),
        db.select().from(inviteCodes),
      ]);
      const studentUsers = allUsers.filter(
        (user) => user.role === "student" && user.classroomId === classroom.id,
      );
      const runs = allRuns.filter((run) => run.classroomId === classroom.id);
      const leaderboard = buildLeaderboard(runs, allUsers).filter((entry) => entry.classroomId === classroom.id);

      return {
        teacher,
        classroom,
        assignments: assignmentRows.map(toAssignment),
        invites: inviteRows
          .map(toInvite)
          .filter((invite) => invite.classroomId === classroom.id || invite.createdBy === teacher.id),
        leaderboard,
        students: studentUsers.map((student) => {
          const run = runs.find((item) => item.userId === student.id);
          const latestSnapshot = run?.snapshots.at(-1);
          return {
            ...student,
            latestSnapshot,
            signals: run ? buildBehaviorSignals(run) : [],
          };
        }),
      };
    },
    () => store.getTeacherOverview(userId),
  );
}

export async function getParentOverview(userId: string) {
  return withDb(
    "getParentOverview",
    async (db) => {
      const parent = await selectUserById(db, userId);
      const [linkRow] = await db
        .select()
        .from(studentParentLinks)
        .where(eq(studentParentLinks.parentUserId, userId))
        .limit(1);
      if (!parent || !linkRow) {
        throw new Error("当前账号还没有绑定学生。");
      }

      const student = await selectUserById(db, linkRow.studentUserId);
      const [reportRow] = await db
        .select()
        .from(growthReports)
        .where(eq(growthReports.parentUserId, userId))
        .limit(1);
      const run = await selectRunForUser(db, linkRow.studentUserId);
      if (!student || !reportRow || !run) {
        throw new Error("成长报告数据暂不可用。");
      }

      return {
        parent,
        student,
        report: toGrowthReport(reportRow),
        run,
      };
    },
    () => store.getParentOverview(userId),
  );
}

function isSuperAdminUser(user?: UserRecord | null) {
  return user?.id === "superadmin" || user?.email.toLowerCase() === "superadmin";
}

export async function canUserPayForTarget(payerId: string, targetUserId: string) {
  return withDb(
    "canUserPayForTarget",
    async (db) => {
      const [payer, target] = await Promise.all([
        selectUserById(db, payerId),
        selectUserById(db, targetUserId),
      ]);
      if (!payer || !target) return false;

      if (payer.id === target.id) {
        return payer.role !== "student";
      }

      if (isSuperAdminUser(payer)) return true;

      if (payer.role === "teacher") {
        return target.role === "student" && Boolean(payer.classroomId) && target.classroomId === payer.classroomId;
      }

      if (payer.role === "parent") {
        const [link] = await db
          .select()
          .from(studentParentLinks)
          .where(
            and(
              eq(studentParentLinks.parentUserId, payer.id),
              eq(studentParentLinks.studentUserId, target.id),
            ),
          )
          .limit(1);
        return Boolean(link);
      }

      return false;
    },
    () => store.canUserPayForTarget(payerId, targetUserId),
  );
}

export async function listSubscriptionTargetsForUser(userId: string) {
  return withDb(
    "listSubscriptionTargetsForUser",
    async (db) => {
      const payer = await selectUserById(db, userId);
      if (!payer) return [];

      let targets: UserRecord[] = [];
      if (isSuperAdminUser(payer)) {
        targets = (await selectAllUsers(db)).filter((user) => user.role === "student");
      } else if (payer.role === "teacher" && payer.classroomId) {
        targets = (await selectAllUsers(db)).filter(
          (user) => user.role === "student" && user.classroomId === payer.classroomId,
        );
      } else if (payer.role === "parent") {
        const links = await db
          .select()
          .from(studentParentLinks)
          .where(eq(studentParentLinks.parentUserId, payer.id));
        const studentIds = links.map((link) => link.studentUserId);
        if (studentIds.length > 0) {
          const rows = await db.select({ user: users, profile: profiles })
            .from(users)
            .leftJoin(profiles, eq(profiles.userId, users.id))
            .where(inArray(users.id, studentIds));
          targets = rows.map((row) => toUserRecord(row.user, row.profile));
        }
      }

      return targets.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        classroomId: user.classroomId,
        subscriptionTier: user.subscriptionTier,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      }));
    },
    () => store.listSubscriptionTargetsForUser(userId),
  );
}

export async function getAdminOverview() {
  try {
    return await withDb(
      "getAdminOverview",
      async (db) => {
        const [allUsers, allRuns, classroomRows, inviteRows, assignmentRows, orderRows] = await Promise.all([
          selectAllUsers(db),
          selectAllRuns(db),
          db.select().from(classrooms),
          db.select().from(inviteCodes),
          db.select().from(assignments).orderBy(desc(assignments.createdAt)),
          db.select().from(paymentOrders),
        ]);
        const leaderboard = buildLeaderboard(allRuns, allUsers);
        const now = Date.now();
        const standardUsers = allUsers.filter((user) => user.subscriptionTier === "standard" || user.subscriptionTier === "premium");
        const trialUsers = allUsers.filter(
          (user) =>
            user.subscriptionTier === "free" &&
            user.trialExpiresAt &&
            new Date(user.trialExpiresAt).getTime() > now,
        );
        const paidOrders = orderRows.filter((order) => order.status === "paid");

        return {
          metrics: [
            { label: "账号席位", value: `${allUsers.length}` },
            { label: "试用中", value: `${trialUsers.length}` },
            { label: "标准订阅", value: `${standardUsers.length}` },
            { label: "已支付订单", value: `${paidOrders.length}` },
          ],
          business: {
            seats: allUsers.length,
            trialUsers: trialUsers.length,
            standardUsers: standardUsers.length,
            schoolLicenses: classroomRows.length,
            paidOrders: paidOrders.length,
            pendingOrders: orderRows.filter((order) => order.status === "pending").length,
            revenueFen: paidOrders.reduce((sum, order) => sum + order.amountFen, 0),
            modules: learningModules.length,
          },
          invites: inviteRows.map(toInvite),
          classrooms: classroomRows.map(toClassroom),
          topUsers: leaderboard.slice(0, 5),
          assignments: assignmentRows.map(toAssignment).slice(0, 4),
          users: allUsers.map(toAdminUserSummary),
        };
      },
      () => store.getAdminOverview(),
    );
  } catch (error) {
    logFallback("getAdminOverview", "query_failed", error);
    return store.getAdminOverview();
  }
}

export async function getLeaderboardSnapshot(scope: "classroom" | "school" = "classroom") {
  return withDb(
    "getLeaderboardSnapshot",
    async (db) => {
      const [allRuns, allUsers] = await Promise.all([selectAllRuns(db), selectAllUsers(db)]);
      const leaderboard = buildLeaderboard(allRuns, allUsers);

      if (scope === "school") {
        return leaderboard;
      }

      return leaderboard.filter((item) => item.classroomId === "class-1");
    },
    () => store.getLeaderboardSnapshot(scope),
  );
}

// ---------------------------------------------------------------------------
// AI sessions
// ---------------------------------------------------------------------------

export async function createAiSession(input: {
  userId: string;
  mode: AiChatMode;
  title: string;
  guestKey?: string;
}) {
  return withDb(
    "createAiSession",
    async (db) => {
      const now = new Date();
      const session: AiChatSession = {
        id: createId("ai-session"),
        userId: input.userId,
        guestKey: input.guestKey,
        title: input.title,
        mode: input.mode,
        messages: [],
        updatedAt: now.toISOString(),
      };

      // H7: payload stores only session metadata; messages live in ai_messages.
      await db.insert(aiSessions).values({
        id: session.id,
        userId: input.userId,
        payload: { ...session, messages: [] },
        createdAt: now,
        updatedAt: now,
      });

      const sessions = await listAiSessionRows(db, input.userId);
      const expiredIds = sessions.slice(10).map((candidate) => candidate.id);
      if (expiredIds.length > 0) {
        await db.delete(aiSessions).where(inArray(aiSessions.id, expiredIds));
      }

      return session;
    },
    () => store.createAiSession(input),
  );
}

/**
 * H9: write multiple chat messages in one transaction so a partial AI failure
 * cannot leave an orphan user message without its assistant reply (or vice
 * versa). Single-message callers use appendAiMessage which delegates here.
 */
export async function appendAiMessages(sessionId: string, userId: string, messages: AiChatMessage[]) {
  if (messages.length === 0) {
    return getAiSessionById(sessionId, userId);
  }

  return withDb(
    "appendAiMessages",
    async (db) =>
      db.transaction(async (tx) => {
        const session = await getAiSessionByIdWithExecutor(tx, sessionId, userId);
        if (!session) {
          throw new Error("未找到对应的 AI 会话。");
        }

        const latestAt = messages[messages.length - 1]?.createdAt ?? new Date().toISOString();

        await tx.insert(aiMessages).values(
          messages.map((message) => ({
            id: message.id || createId("ai-msg"),
            sessionId,
            role: message.role,
            text: message.text,
            meta: message.meta ?? null,
            createdAt: new Date(message.createdAt),
          })),
        );

        await tx
          .update(aiSessions)
          .set({ updatedAt: new Date(latestAt) })
          .where(eq(aiSessions.id, sessionId));

        const reloaded = await loadSessionMessages(tx, sessionId);
        return { ...session, messages: reloaded, updatedAt: latestAt };
      }),
    async () => {
      let latest: AiChatSession | null = null;
      for (const message of messages) {
        latest = await store.appendAiMessage(sessionId, userId, message);
      }
      return latest ?? (await store.getAiSessionById(sessionId, userId));
    },
  );
}

export async function appendAiMessage(sessionId: string, userId: string, message: AiChatMessage) {
  return appendAiMessages(sessionId, userId, [message]);
}

export async function listAiSessionsForUser(userId: string) {
  return withDb("listAiSessionsForUser", (db) => listAiSessionRows(db, userId).then((items) => items.slice(0, 10)), () =>
    store.listAiSessionsForUser(userId),
  );
}

export async function getAiSessionById(sessionId: string, userId: string) {
  return withDb(
    "getAiSessionById",
    async (db) => {
      const session = await getAiSessionByIdWithExecutor(db, sessionId, userId);
      if (!session) return null;
      const messages = await loadSessionMessages(db, sessionId);
      return { ...session, messages };
    },
    () => store.getAiSessionById(sessionId, userId),
  );
}

async function getAiSessionByIdWithExecutor(executor: DbExecutor, sessionId: string, userId: string) {
  const [row] = await executor
    .select()
    .from(aiSessions)
    .where(and(eq(aiSessions.id, sessionId), eq(aiSessions.userId, userId)))
    .limit(1);

  return row ? { ...toAiSession(row), messages: [] as AiChatMessage[] } : null;
}

/**
 * H2: invalidate every outstanding JWT for this user by bumping tokenVersion.
 * Called from /api/auth/logout (and should be called on password change).
 */
export async function bumpTokenVersion(userId: string) {
  return withDb(
    "bumpTokenVersion",
    async (db) => {
      const [updated] = await db
        .update(users)
        .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
        .where(eq(users.id, userId))
        .returning({ tokenVersion: users.tokenVersion });
      return updated?.tokenVersion ?? 0;
    },
    () => store.bumpTokenVersion(userId),
  );
}

export async function updateUserPassword(userId: string, password: string) {
  return withDb(
    "updateUserPassword",
    async (db) => {
      const passwordHash = await hashPassword(password);
      const [updated] = await db
        .update(users)
        .set({
          passwordHash,
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updated) throw new Error("用户不存在。");
      const profile = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      return toUserRecord(updated, profile[0]);
    },
    () => store.updateUserPassword(userId, password),
  );
}

export async function updateUserEmail(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return withDb(
    "updateUserEmail",
    async (db) => {
      const existing = await selectUserByEmail(db, normalizedEmail);
      if (existing && existing.id !== userId) {
        throw new Error("这个邮箱已经被注册过了。");
      }

      const [updated] = await db
        .update(users)
        .set({
          email: normalizedEmail,
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updated) throw new Error("用户不存在。");
      const profile = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
      return toUserRecord(updated, profile[0]);
    },
    () => store.updateUserEmail(userId, normalizedEmail),
  );
}

export async function listAdminUsers(filters: {
  query?: string;
  role?: Role | "all";
  subscription?: SubscriptionTier | "trial" | "all";
} = {}) {
  return withDb(
    "listAdminUsers",
    async (db) => {
      const allUsers = await selectAllUsers(db);
      const query = filters.query?.trim().toLowerCase();
      const now = Date.now();
      return allUsers
        .filter((user) => {
          const matchesQuery =
            !query ||
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.title.toLowerCase().includes(query);
          const matchesRole = !filters.role || filters.role === "all" || user.role === filters.role;
          const tier = user.subscriptionTier ?? "free";
          const inTrial =
            Boolean(user.trialExpiresAt) &&
            new Date(user.trialExpiresAt as string).getTime() > now &&
            tier === "free";
          const matchesSubscription =
            !filters.subscription ||
            filters.subscription === "all" ||
            (filters.subscription === "trial" ? inTrial : tier === filters.subscription);
          return matchesQuery && matchesRole && matchesSubscription;
        })
        .map(toAdminUserSummary);
    },
    () => store.listAdminUsers(filters),
  );
}

export async function createAdminManagedUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  title?: string;
  subscriptionTier?: SubscriptionTier;
  trialDays?: number | null;
  subscriptionDays?: number | null;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  return withDb(
    "createAdminManagedUser",
    async (db) =>
      db.transaction(async (tx) => {
        const existing = await selectUserByEmail(tx, normalizedEmail);
        if (existing) throw new Error("这个邮箱已经注册过了。");

        const now = new Date();
        const trialExpiresAt =
          typeof input.trialDays === "number" && input.trialDays > 0
            ? new Date(now.getTime() + input.trialDays * 86_400_000)
            : null;
        const subscriptionTier = input.subscriptionTier ?? "free";
        const subscriptionExpiresAt =
          subscriptionTier !== "free" && typeof input.subscriptionDays === "number" && input.subscriptionDays > 0
            ? new Date(now.getTime() + input.subscriptionDays * 86_400_000)
            : null;
        const userId = createId("user");
        const classroomId =
          input.role === "student" || input.role === "teacher"
            ? await selectDefaultClassroomId(tx, userId)
            : null;
        const title =
          input.title?.trim() ||
          (input.role === "admin"
            ? "运营管理员"
            : input.role === "teacher"
              ? "教师账号"
              : input.role === "parent"
                ? "家长账号"
                : "沙盘体验用户");

        const [created] = await tx
          .insert(users)
          .values({
            id: userId,
            email: normalizedEmail,
            passwordHash: await hashPassword(input.password),
            role: input.role,
            classroomId,
            trialExpiresAt,
            subscriptionTier,
            subscriptionExpiresAt,
            onboardingCompleted: input.role === "student" ? 0 : 1,
          })
          .returning();

        await tx.insert(profiles).values({
          userId,
          name: input.name.trim(),
          title,
          headline: "由超级管理员创建的 Brown Zone 账号。",
          bio: "该账号可按角色进入对应工作台，权限与试用状态由后台统一管理。",
          metrics: [
            { label: "角色", value: input.role },
            { label: "创建方式", value: "超级管理员创建" },
          ],
        });

        if (input.role === "student" && classroomId) {
          await tx.insert(scenarioRuns).values(toRunInsert(createInitialRun(userId, classroomId)));
        }

        return toAdminUserSummary(
          toUserRecord(created, {
            userId,
            name: input.name.trim(),
            title,
            headline: "",
            bio: "",
            metrics: [],
          }),
        );
      }),
    () => store.createAdminManagedUser({ ...input, email: normalizedEmail }),
  );
}

export async function updateAdminManagedUser(
  userId: string,
  input: {
    name?: string;
    title?: string;
    role?: Role;
    subscriptionTier?: SubscriptionTier;
    trialDays?: number | null;
    subscriptionDays?: number | null;
    onboardingCompleted?: boolean;
  },
) {
  return withDb(
    "updateAdminManagedUser",
    async (db) =>
      db.transaction(async (tx) => {
        const current = await selectUserById(tx, userId);
        if (!current) throw new Error("用户不存在。");

        const nextRole = input.role ?? current.role;
        const classroomId =
          (nextRole === "student" || nextRole === "teacher") && !current.classroomId
            ? await selectDefaultClassroomId(tx, userId)
            : current.classroomId ?? null;
        const patch: Partial<typeof users.$inferInsert> = {
          role: nextRole,
          classroomId,
          tokenVersion: sql`${users.tokenVersion} + 1` as unknown as number,
        };

        if (input.trialDays !== undefined) {
          patch.trialExpiresAt =
            input.trialDays && input.trialDays > 0
              ? new Date(Date.now() + input.trialDays * 86_400_000)
              : null;
        }

        if (input.subscriptionTier !== undefined) {
          patch.subscriptionTier = input.subscriptionTier;
          if (input.subscriptionTier === "free") {
            patch.subscriptionExpiresAt = null;
          }
        }

        if (input.subscriptionDays !== undefined) {
          patch.subscriptionExpiresAt =
            input.subscriptionDays && input.subscriptionDays > 0
              ? new Date(Date.now() + input.subscriptionDays * 86_400_000)
              : null;
          if (input.subscriptionDays && input.subscriptionDays > 0 && (!input.subscriptionTier || input.subscriptionTier === "free")) {
            patch.subscriptionTier = "standard";
          }
        }

        if (input.onboardingCompleted !== undefined) {
          patch.onboardingCompleted = input.onboardingCompleted ? 1 : 0;
        }

        const [updated] = await tx.update(users).set(patch).where(eq(users.id, userId)).returning();
        if (!updated) throw new Error("用户不存在。");

        const profilePatch: Partial<typeof profiles.$inferInsert> = {};
        if (input.name !== undefined) profilePatch.name = input.name.trim();
        if (input.title !== undefined) profilePatch.title = input.title.trim();
        if (Object.keys(profilePatch).length > 0) {
          await tx.update(profiles).set(profilePatch).where(eq(profiles.userId, userId));
        }

        if (nextRole === "student" && classroomId) {
          const existingRun = await selectRunForUser(tx, userId);
          if (!existingRun) {
            await tx.insert(scenarioRuns).values(toRunInsert(createInitialRun(userId, classroomId)));
          }
        }

        const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        return toAdminUserSummary(toUserRecord(updated, profile));
      }),
    () => store.updateAdminManagedUser(userId, input),
  );
}

export async function createPaymentOrder(input: {
  userId: string;
  targetUserId: string;
  tier: Exclude<SubscriptionTier, "free">;
  channel: PaymentChannel;
  amountFen: number;
  description: string;
  outTradeNo: string;
  expiresAt: Date;
  codeUrl?: string;
  prepayId?: string;
}) {
  return withDb(
    "createPaymentOrder",
    async (db) => {
      const [order] = await db
        .insert(paymentOrders)
        .values({
          id: createId("pay"),
          outTradeNo: input.outTradeNo,
          userId: input.userId,
          targetUserId: input.targetUserId,
          tier: input.tier,
          channel: input.channel,
          amountFen: input.amountFen,
          description: input.description,
          status: "pending",
          codeUrl: input.codeUrl ?? null,
          prepayId: input.prepayId ?? null,
          expiresAt: input.expiresAt,
        })
        .returning();
      return toPaymentOrder(order);
    },
    () => store.createPaymentOrder(input),
  );
}

export async function updatePaymentOrderProviderFields(
  outTradeNo: string,
  fields: { codeUrl?: string; prepayId?: string },
) {
  return withDb(
    "updatePaymentOrderProviderFields",
    async (db) => {
      const [order] = await db
        .update(paymentOrders)
        .set({
          codeUrl: fields.codeUrl,
          prepayId: fields.prepayId,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.outTradeNo, outTradeNo))
        .returning();
      if (!order) throw new Error("支付订单不存在。");
      return toPaymentOrder(order);
    },
    () => store.updatePaymentOrderProviderFields(outTradeNo, fields),
  );
}

export async function getPaymentOrderByOutTradeNo(outTradeNo: string) {
  return withDb(
    "getPaymentOrderByOutTradeNo",
    async (db) => {
      const [order] = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.outTradeNo, outTradeNo))
        .limit(1);
      return order ? toPaymentOrder(order) : null;
    },
    () => store.getPaymentOrderByOutTradeNo(outTradeNo),
  );
}

export async function fulfillPaymentOrder(input: {
  outTradeNo: string;
  transactionId: string;
  paidAt?: string;
  rawNotify?: unknown;
  paidAmountFen?: number;
}) {
  return withDb(
    "fulfillPaymentOrder",
    async (db) =>
      db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(paymentOrders)
          .where(eq(paymentOrders.outTradeNo, input.outTradeNo))
          .limit(1);
        if (!order) throw new Error("支付订单不存在。");

        // Defense-in-depth: a SUCCESS callback must report the amount we charged.
        // Tier is server-set from order.tier (not the payload), so this only guards
        // against an under/over-paid amount fulfilling the full subscription.
        if (input.paidAmountFen != null && input.paidAmountFen !== order.amountFen) {
          throw new Error(
            `支付金额不一致（订单 ${order.amountFen} 分，回调 ${input.paidAmountFen} 分），已拒绝履约。`,
          );
        }

        const existingGrantRows = await tx
          .select()
          .from(subscriptionGrants)
          .where(eq(subscriptionGrants.orderId, order.id))
          .limit(1);
        // Idempotency: gate on status alone so a paid order never double-extends,
        // even if its grant row is missing.
        if (order.status === "paid") {
          return {
            order: toPaymentOrder(order),
            grant: existingGrantRows[0] ? toSubscriptionGrant(existingGrantRows[0]) : null,
            alreadyFulfilled: true,
          };
        }

        const [targetUser] = await tx.select().from(users).where(eq(users.id, order.targetUserId)).limit(1);
        if (!targetUser) throw new Error("订阅目标账号不存在。");

        const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
        const currentExpiry = targetUser.subscriptionExpiresAt ?? paidAt;
        const startsAt = currentExpiry.getTime() > paidAt.getTime() ? currentExpiry : paidAt;
        const expiresAt = new Date(startsAt);
        expiresAt.setDate(expiresAt.getDate() + 30);

        const [updatedOrder] = await tx
          .update(paymentOrders)
          .set({
            status: "paid",
            transactionId: input.transactionId,
            rawNotify: input.rawNotify ?? null,
            paidAt,
            updatedAt: paidAt,
          })
          .where(eq(paymentOrders.id, order.id))
          .returning();

        await tx
          .update(users)
          .set({
            subscriptionTier: order.tier,
            subscriptionExpiresAt: expiresAt,
            // NB: do NOT bump tokenVersion here. Tier is read fresh from the DB on
            // every request, so the new subscription takes effect immediately
            // without a session refresh — and bumping it would invalidate the
            // payer's own live session when they buy Premium for themselves
            // (family self-purchase), 401-ing the very next status fetch.
          })
          .where(eq(users.id, order.targetUserId));

        const [grant] = await tx
          .insert(subscriptionGrants)
          .values({
            id: createId("grant"),
            userId: order.targetUserId,
            orderId: order.id,
            tier: order.tier,
            startsAt,
            expiresAt,
          })
          .returning();

        return {
          order: toPaymentOrder(updatedOrder),
          grant: toSubscriptionGrant(grant),
          alreadyFulfilled: false,
        };
      }),
    () => store.fulfillPaymentOrder(input),
  );
}

export async function markPaymentOrderStatus(
  outTradeNo: string,
  status: Exclude<PaymentStatus, "pending" | "paid">,
) {
  return withDb(
    "markPaymentOrderStatus",
    async (db) => {
      const [order] = await db
        .update(paymentOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(paymentOrders.outTradeNo, outTradeNo))
        .returning();
      if (!order) throw new Error("支付订单不存在。");
      return toPaymentOrder(order);
    },
    () => store.markPaymentOrderStatus(outTradeNo, status),
  );
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB needed; re-export from store)
// ---------------------------------------------------------------------------

export const getQuickDemoCredentials: typeof store.getQuickDemoCredentials = store.getQuickDemoCredentials;
export const roleHomePath: (role: Role) => string = store.roleHomePath;
export const buildTeacherLeaderboardCards: typeof store.buildTeacherLeaderboardCards =
  store.buildTeacherLeaderboardCards;

// ---------------------------------------------------------------------------
// Financial Power leaderboard (V1)
// ---------------------------------------------------------------------------

function toSchool(row: DbSchool): School {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    provinceCode: row.provinceCode,
    cityCode: row.cityCode,
    status: row.status as School["status"],
    mergedInto: maybeUndefined(row.mergedInto),
    createdBy: maybeUndefined(row.createdBy),
    createdAt: maybeIso(row.createdAt) ?? new Date().toISOString(),
  };
}

function toRankProfile(row: DbRankProfile): RankProfile {
  return {
    userId: row.userId,
    provinceCode: row.provinceCode,
    cityCode: row.cityCode,
    schoolId: row.schoolId,
    alias: row.alias,
    visibility: row.visibility as RankVisibility,
    consent: row.consent,
    lastTier: row.lastTier,
    lastTierSeason: row.lastTierSeason,
    createdAt: maybeIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: maybeIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function toLeaderboardSnapshot(row: DbLeaderboardSnapshot): LeaderboardSnapshot {
  return {
    id: row.id,
    userId: row.userId,
    period: row.period as RankPeriod,
    periodKey: row.periodKey,
    power: row.power,
    tier: row.tier,
    netWorth: row.netWorth,
    components: row.components as PowerComponentsRecord,
    createdAt: maybeIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: maybeIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

/** Find the school for (city, normalized name) or create it. Idempotent. */
export async function findOrCreateSchool(input: {
  name: string;
  provinceCode: string;
  cityCode: string;
  createdBy?: string;
}): Promise<School> {
  return withDb(
    "findOrCreateSchool",
    async (db) => {
      const normalizedName = normalizeSchoolName(input.name);
      await db
        .insert(schools)
        .values({
          id: createId("sch"),
          name: input.name.trim(),
          normalizedName,
          provinceCode: input.provinceCode,
          cityCode: input.cityCode,
          status: "approved",
          createdBy: input.createdBy,
        })
        .onConflictDoNothing({ target: [schools.cityCode, schools.normalizedName] });
      const [row] = await db
        .select()
        .from(schools)
        .where(and(eq(schools.cityCode, input.cityCode), eq(schools.normalizedName, normalizedName)))
        .limit(1);
      // Defensive: the row was just inserted (or already existed); a miss means a
      // pathological race deleted it. Fail with a clean error rather than crash
      // in toSchool(undefined).
      if (!row) throw new Error("学校创建失败，请重试。");
      return toSchool(row);
    },
    () => store.findOrCreateSchool(input),
  );
}

export async function listSchoolsByCity(cityCode: string): Promise<School[]> {
  return withDb(
    "listSchoolsByCity",
    async (db) => {
      const rows = await db
        .select()
        .from(schools)
        .where(and(eq(schools.cityCode, cityCode), ne(schools.status, "merged")));
      return rows.map(toSchool).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    },
    () => store.listSchoolsByCity(cityCode),
  );
}

export async function getSchoolById(schoolId: string): Promise<School | null> {
  return withDb(
    "getSchoolById",
    async (db) => {
      const [row] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
      return row ? toSchool(row) : null;
    },
    () => store.getSchoolById(schoolId),
  );
}

export async function getRankProfile(userId: string): Promise<RankProfile | null> {
  return withScopedDb(
    "getRankProfile",
    async (db) => {
      const [row] = await db
        .select()
        .from(rankProfiles)
        .where(eq(rankProfiles.userId, userId))
        .limit(1);
      return row ? toRankProfile(row) : null;
    },
    () => store.getRankProfile(userId),
  );
}

export async function upsertRankProfile(input: {
  userId: string;
  provinceCode: string;
  cityCode: string;
  schoolId: string;
  alias: string;
  visibility?: RankVisibility;
  consent?: number;
}): Promise<RankProfile> {
  return withDb(
    "upsertRankProfile",
    async (db) => {
      const now = new Date();
      const [row] = await db
        .insert(rankProfiles)
        .values({
          userId: input.userId,
          provinceCode: input.provinceCode,
          cityCode: input.cityCode,
          schoolId: input.schoolId,
          alias: input.alias,
          visibility: input.visibility ?? "public",
          consent: input.consent ?? 0,
          lastTier: 0,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: rankProfiles.userId,
          // lastTier is intentionally NOT reset here — it's the season high-water.
          set: {
            provinceCode: input.provinceCode,
            cityCode: input.cityCode,
            schoolId: input.schoolId,
            alias: input.alias,
            ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
            ...(input.consent !== undefined ? { consent: input.consent } : {}),
            updatedAt: now,
          },
        })
        .returning();
      return toRankProfile(row);
    },
    () => store.upsertRankProfile(input),
  );
}

/**
 * Persist computed power for a period bucket. Applies the season soft floor
 * (decision 7) against the rank profile and bumps its high-water tier, atomic
 * with the snapshot write.
 */
export async function upsertLeaderboardSnapshot(input: {
  userId: string;
  period: RankPeriod;
  periodKey: string;
  power: number;
  netWorth: number;
  components: PowerComponentsRecord;
  /** Season (semester key) the soft floor is scoped to; resets across seasons. */
  seasonKey: string;
}): Promise<LeaderboardSnapshot> {
  return withDb(
    "upsertLeaderboardSnapshot",
    async (db) =>
      db.transaction(async (tx) => {
        const rawTier = tierFromPower(input.power);
        const [profile] = await tx
          .select()
          .from(rankProfiles)
          .where(eq(rankProfiles.userId, input.userId))
          .limit(1)
          .for("update");
        // Reset the floor when the season rolls over (decision 7: within-season).
        const baseline =
          profile && profile.lastTierSeason === input.seasonKey ? profile.lastTier : 0;
        const tier = profile ? applySoftFloor(baseline, rawTier) : rawTier;
        const now = new Date();
        if (profile) {
          await tx
            .update(rankProfiles)
            .set({ lastTier: tier, lastTierSeason: input.seasonKey, updatedAt: now })
            .where(eq(rankProfiles.userId, input.userId));
        }
        const [row] = await tx
          .insert(leaderboardSnapshots)
          .values({
            id: createId("lbs"),
            userId: input.userId,
            period: input.period,
            periodKey: input.periodKey,
            power: input.power,
            tier,
            netWorth: input.netWorth,
            components: input.components,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              leaderboardSnapshots.userId,
              leaderboardSnapshots.period,
              leaderboardSnapshots.periodKey,
            ],
            set: {
              power: input.power,
              tier,
              netWorth: input.netWorth,
              components: input.components,
              updatedAt: now,
            },
          })
          .returning();
        return toLeaderboardSnapshot(row);
      }),
    () => store.upsertLeaderboardSnapshot(input),
  );
}

/** Mark a learning module completed for a user. Idempotent. */
export async function markModuleComplete(
  userId: string,
  moduleKey: string,
): Promise<LearningProgressRow> {
  return withDb(
    "markModuleComplete",
    async (db) => {
      await db
        .insert(learningProgress)
        .values({ id: createId("lp"), userId, moduleKey })
        .onConflictDoNothing({ target: [learningProgress.userId, learningProgress.moduleKey] });
      return { userId, moduleKey, completedAt: new Date().toISOString() };
    },
    () => store.markModuleComplete(userId, moduleKey),
  );
}

export async function getLearningProgress(userId: string): Promise<LearningProgressSummary> {
  return withDb(
    "getLearningProgress",
    async (db) => {
      const rows = await db
        .select({ moduleKey: learningProgress.moduleKey })
        .from(learningProgress)
        .where(eq(learningProgress.userId, userId));
      const valid = new Set<string>(learningModules.map((m) => m.key));
      const completedKeys = rows.map((r) => r.moduleKey).filter((k) => valid.has(k));
      return { completed: completedKeys.length, total: valid.size, completedKeys };
    },
    () => store.getLearningProgress(userId),
  );
}

export async function listLeaderboardSnapshots(
  period: RankPeriod,
  periodKey: string,
): Promise<LeaderboardSnapshot[]> {
  return withDb(
    "listLeaderboardSnapshots",
    async (db) => {
      const rows = await db
        .select()
        .from(leaderboardSnapshots)
        .where(
          and(
            eq(leaderboardSnapshots.period, period),
            eq(leaderboardSnapshots.periodKey, periodKey),
          ),
        );
      return rows.map(toLeaderboardSnapshot);
    },
    () => store.listLeaderboardSnapshots(period, periodKey),
  );
}

/**
 * Snapshots joined to rank profiles + schools for a period — the rows the pure
 * ranker (ranking.ts) consumes. Only consented users (decision 3) are eligible;
 * visibility filtering happens in ranking.ts at read time.
 */
export async function listRankSnapshots(
  period: RankPeriod,
  periodKey: string,
): Promise<RankSnapshot[]> {
  return withScopedDb(
    "listRankSnapshots",
    async (db) => {
      const rows = await db
        .select({
          userId: leaderboardSnapshots.userId,
          power: leaderboardSnapshots.power,
          tier: leaderboardSnapshots.tier,
          alias: rankProfiles.alias,
          visibility: rankProfiles.visibility,
          schoolId: rankProfiles.schoolId,
          cityCode: rankProfiles.cityCode,
          provinceCode: rankProfiles.provinceCode,
          schoolName: schools.name,
        })
        .from(leaderboardSnapshots)
        .innerJoin(rankProfiles, eq(rankProfiles.userId, leaderboardSnapshots.userId))
        .leftJoin(schools, eq(schools.id, rankProfiles.schoolId))
        .where(
          and(
            eq(leaderboardSnapshots.period, period),
            eq(leaderboardSnapshots.periodKey, periodKey),
            eq(rankProfiles.consent, 1),
          ),
        );
      return rows.map((r) => ({
        userId: r.userId,
        alias: r.alias,
        power: r.power,
        tier: r.tier,
        schoolId: r.schoolId,
        schoolName: r.schoolName ?? "未知学校",
        cityCode: r.cityCode,
        provinceCode: r.provinceCode,
        visibility: r.visibility as RankVisibility,
      }));
    },
    () => store.listRankSnapshots(period, periodKey),
  );
}

/** All users who have onboarded onto the leaderboard (for the recompute cron). */
export async function listRankedUserIds(): Promise<string[]> {
  return withDb(
    "listRankedUserIds",
    async (db) => {
      const rows = await db.select({ userId: rankProfiles.userId }).from(rankProfiles);
      return rows.map((r) => r.userId);
    },
    () => store.listRankedUserIds(),
  );
}

/** A single user's own power snapshot for a period (with components). */
export async function getPowerSnapshot(
  userId: string,
  period: RankPeriod,
  periodKey: string,
): Promise<LeaderboardSnapshot | null> {
  return withScopedDb(
    "getPowerSnapshot",
    async (db) => {
      const [row] = await db
        .select()
        .from(leaderboardSnapshots)
        .where(
          and(
            eq(leaderboardSnapshots.userId, userId),
            eq(leaderboardSnapshots.period, period),
            eq(leaderboardSnapshots.periodKey, periodKey),
          ),
        )
        .limit(1);
      return row ? toLeaderboardSnapshot(row) : null;
    },
    () => store.getPowerSnapshot(userId, period, periodKey),
  );
}
