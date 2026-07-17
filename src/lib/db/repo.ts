/**
 * Brown Zone DB Adapter Layer
 * ============================================
 * This module is the single bridge between API routes and persistence.
 *
 * When DATABASE_URL is missing or a DB query fails, every function delegates to
 * the legacy in-memory store. That keeps the offline teacher-computer demo
 * working while allowing the hosted app to use Supabase Postgres.
 */

import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";

import { z } from "zod";

import {
  ActionLogSchema,
  HoldingSchema,
  PortfolioSnapshotSchema,
} from "@/lib/db/payload-schemas";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DomainError } from "@/lib/domain-error";

import { learningModules } from "@/lib/content";
import {
  getDb,
  getDirectFallbackDb,
  getSupabaseDirectFallbackUrl,
  isDatabaseConfigured,
} from "@/lib/db/client";
import { getRequestExecutor } from "@/lib/db/rls-context";
import {
  aiMessages,
  aiSessions,
  appSettings,
  assignments,
  cardCollection,
  classrooms,
  familyMembers,
  growthReports,
  inviteCodes,
  leaderboardSnapshots,
  learningProgress,
  paymentOrders,
  profiles,
  rankProfiles,
  riskProfiles,
  roundPredictions,
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
  getRoundQuotesForRun,
} from "@/lib/simulation";
import {
  applyLifeCashflowChallenge,
  type LifeCashflowApplyInput,
} from "@/lib/life-cashflow";
import {
  applyCreditLabAction,
  type CreditLabActionInput,
} from "@/lib/credit-lab";
import {
  cancelAutoInvestPlan,
  createAutoInvestPlan,
  executeAutoInvestForRound,
  type AutoInvestInput,
} from "@/lib/auto-invest";
import { claimQuestReward } from "@/lib/quests";
import { claimSeasonChallengeReward } from "@/lib/season-challenges";
import {
  createFundLabAction,
  type FundLabActionInput,
} from "@/lib/fund-lab";
import {
  createOpportunityNote,
  type OpportunityNoteInput,
} from "@/lib/opportunity";
import {
  createGoalAccountAction,
  type GoalAccountActionInput,
} from "@/lib/goal-accounts";
import {
  createProtectionUmbrellaAction,
  type ProtectionUmbrellaActionInput,
} from "@/lib/protection-umbrella";
import {
  createStudentWatchlistAction,
  type StudentWatchlistActionInput,
} from "@/lib/student-watchlist";
import {
  createWealthReview,
  type WealthReviewInput,
} from "@/lib/wealth-review";
import { buildPeerHeatPayload } from "@/lib/peer-heat";
import * as store from "@/lib/store";
import type {
  AiChatMessage,
  AiChatMode,
  AiChatSession,
  AppSetting,
  Assignment,
  BehaviorPersona,
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
  RoundPrediction,
  RoundPredictionGuess,
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
type DbAppSetting = typeof appSettings.$inferSelect;
type DbPaymentOrder = typeof paymentOrders.$inferSelect;
type DbSubscriptionGrant = typeof subscriptionGrants.$inferSelect;
type DbSchool = typeof schools.$inferSelect;
type DbRankProfile = typeof rankProfiles.$inferSelect;
type DbRiskProfile = typeof riskProfiles.$inferSelect;
type DbRoundPrediction = typeof roundPredictions.$inferSelect;
type DbCardCollection = typeof cardCollection.$inferSelect;
type DbLeaderboardSnapshot = typeof leaderboardSnapshots.$inferSelect;
type FallbackReason = "no_database_url" | "connection_failed" | "query_failed";

export type CardCollectionSource = "quest_claim" | "streak" | "achievement";

export type CardCollectionItem = {
  id: string;
  userId: string;
  cardId: string;
  source: CardCollectionSource;
  drawnAt: string;
  meta?: Record<string, unknown> | null;
};

export type RiskProfileRecord = {
  userId: string;
  riskLabel: string;
  answers: Record<string, unknown>;
  updatedAt: string;
  behaviorPersona?: BehaviorPersona | null;
  personaProvider?: string | null;
  analyzedAt?: string | null;
  inputDigest?: string | null;
};

const DB_QUERY_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT_MS ?? 5000);

// In production, default to NO memory fallback so DB outages surface as 5xx
// rather than silently returning seed data. Set ALLOW_MEMORY_FALLBACK=true to
// keep the offline teacher-laptop demo behaviour.
const ALLOW_MEMORY_FALLBACK =
  process.env.ALLOW_MEMORY_FALLBACK === "true" || process.env.NODE_ENV !== "production";

const fallbackRiskProfiles = new Map<string, RiskProfileRecord>();
const fallbackRoundPredictions = new Map<string, RoundPrediction>();
const fallbackCardCollection = new Map<string, CardCollectionItem>();

// P5/P6: fallback observability. The stable "[repo.fallback]" prefix is the
// greppable SLI (wire a Vercel log-drain / Sentry alert to it). Transient failures
// are rate-limited (5s) so a sustained DB outage can't flood logs; the error text
// is scrubbed of emails/tokens; and "no DATABASE_URL" is logged once so a
// misconfigured prod silently running on ephemeral memory is detectable.
let fallbackCount = 0;
let loggedNoDb = false;
let lastFallbackLogAt = 0;

function describeDatabaseTarget(raw = process.env.DATABASE_URL) {
  if (!raw) return "DATABASE_URL=missing";

  try {
    const parsed = new URL(raw);
    return [
      `protocol=${parsed.protocol.replace(/:$/, "")}`,
      `host=${parsed.hostname || "unknown"}`,
      `port=${parsed.port || "default"}`,
      `db=${parsed.pathname.replace(/^\//, "") || "unknown"}`,
      `sslmode=${parsed.searchParams.get("sslmode") ?? "none"}`,
    ].join(" ");
  } catch {
    return "DATABASE_URL=invalid_url";
  }
}

/** Redact emails / long hex secrets from an error message before logging (P6). */
export function scrubError(err: unknown): string {
  if (err === undefined || err === null) return "";
  const details: string[] = [];

  if (err instanceof Error) {
    details.push(`name=${err.name}`);
    const maybeDbError = err as Error & {
      code?: string;
      cause?: unknown;
      errors?: Array<{ code?: string; address?: string; port?: number }>;
    };
    if (maybeDbError.code) details.push(`code=${maybeDbError.code}`);
    if (err.message) {
      details.push(err.message.startsWith("Failed query:") ? "message=Failed query" : `message=${err.message}`);
    }

    const cause = maybeDbError.cause as
      | (Error & {
          code?: string;
          severity?: string;
          routine?: string;
          errors?: Array<{ code?: string; address?: string; port?: number }>;
        })
      | undefined;
    if (cause) {
      if (cause.name) details.push(`causeName=${cause.name}`);
      if (cause.code) details.push(`causeCode=${cause.code}`);
      if (cause.severity) details.push(`causeSeverity=${cause.severity}`);
      if (cause.routine) details.push(`causeRoutine=${cause.routine}`);
      if (cause.message) details.push(`causeMessage=${cause.message || "(empty)"}`);
      const nested = cause.errors
        ?.map((item) => [item.code, item.address, item.port].filter(Boolean).join("@"))
        .filter(Boolean)
        .join(",");
      if (nested) details.push(`causeErrors=${nested}`);
    }
  }

  const msg = details.length ? details.join(" ") : String(err);
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
  const directRetry = fn.includes(":direct_supabase");
  if (!directRetry && now - lastFallbackLogAt < 5000) return;
  lastFallbackLogAt = now;
  const target = directRetry ? (getSupabaseDirectFallbackUrl() ?? process.env.DATABASE_URL) : process.env.DATABASE_URL;
  console.warn(
    `[repo.fallback] fn=${fn} reason=${reason} count=${fallbackCount} ${describeDatabaseTarget(target)} ${scrubError(err)}`.trim(),
  );
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
  "createRoundPredictionForUser", "settleRoundPredictionsForRun",
  "drawCardForUser",
  "upsertLeaderboardSnapshot", "upsertRankProfile", "findOrCreateSchool", "markModuleComplete",
  "markModuleQuizPassed",
  "upsertRiskProfile",
  // AI history persists via appendAiMessages (plural); appendAiMessage is a thin
  // wrapper that never enters withDb itself, so the DB-write key is the plural.
  "markOnboardingCompleted", "markEmailVerified", "createAiSession", "appendAiMessages",
  "registerUserByInvite", "registerUserByEmail", "addFamilyMember", "removeFamilyMember",
  "createAssignmentForTeacher", "bumpTokenVersion", "updateUserPassword", "updateUserEmail",
  "createAdminManagedUser", "updateAdminManagedUser", "createPaymentOrder",
  "updatePaymentOrderProviderFields", "attachManualPaymentProof", "markPaymentOrderStatus", "fulfillPaymentOrder",
  "upsertAppSetting", "createAutoInvestPlanForUser", "cancelAutoInvestPlanForUser", "applyLifeCashflowChallengeForUser",
  "claimQuestRewardForUser", "claimSeasonRewardForUser", "applyCreditLabActionForUser",
  // 理财 2.0 写库函数（每个都 tx.update(scenarioRuns)）：DB 故障必须冒泡，不得静默落内存
  // （itest4 R3 P1：这 6 个此前漏登记，ALLOW_MEMORY_FALLBACK 开启时会假成功+丢数据）。
  "createOpportunityNoteForUser", "createFundLabActionForUser", "createGoalAccountActionForUser",
  "createProtectionUmbrellaActionForUser", "createStudentWatchlistActionForUser", "createWealthReviewForUser",
]);

// 从零依赖模块 @/lib/domain-error 引入并【再导出】DomainError：既供本文件 catch 守卫使用，
// 也让历史 `import { DomainError } from "@/lib/db/repo"`（路由/测试）继续可用。领域拒绝的抛出点
// 分布在 repo.ts 与被其事务调用的纯教学模块两侧，故类型定义须放在共享模块以免循环依赖。
export { DomainError };

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
    // 领域校验错误（业务规则拒绝）不是 DB 故障：直接冒泡，不记 query_failed、不发
    // [repo.fallback] SLI、不走内存兜底（itest6 R3 P3：消除虚假 DB 故障告警）。
    if (err instanceof DomainError) {
      throw err;
    }
    logFallback(fn, "query_failed", err);
    // Writes never silently fall back (P2): a failed persist must surface as an
    // error, not pretend success in memory. Reads fall back only when allowed.
    if (WRITE_FNS.has(fn.replace(/:direct_supabase$/, "")) || !ALLOW_MEMORY_FALLBACK) {
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
  const primaryDb = getDb();
  const executor = dbFn as unknown as (db: DbExecutor) => Promise<T>;
  try {
    return await withDbExecutor(fn, primaryDb, executor, fallback);
  } catch (error) {
    // 与内层 withDbExecutor 守卫对称（itest7 P2）：领域拒绝不是 DB 故障，绝不参与
    // direct_supabase 二次重试、绝不打印 [repo.fallback] SLI。生产(Supabase pooler)下
    // getDirectFallbackDb() 非空，若不在此拦截，领域错误会误发 fallback SLI 且把整事务
    // 对着跨洋 direct 连接白跑一遍（本地非 pooler 观察不到）。
    if (error instanceof DomainError) {
      throw error;
    }
    const directDb = getDirectFallbackDb();
    if (!primaryDb || !directDb || directDb === primaryDb) {
      throw error;
    }

    const fallbackUrl = getSupabaseDirectFallbackUrl();
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[repo.fallback] fn=${fn} retry=direct_supabase ${describeDatabaseTarget(fallbackUrl ?? undefined)}`,
      );
    }
    return await withDbExecutor(`${fn}:direct_supabase`, directDb, executor, fallback);
  }
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

/**
 * Strip the bcrypt `passwordHash` from any user-shaped object before it can be
 * serialized to a client. Teacher/parent overviews embed full user rows (their
 * own + students'); without this they would ship offline-crackable credential
 * material to the browser. Keeps all other fields so consuming UIs are unaffected.
 */
function withoutPasswordHash<T extends { passwordHash?: unknown }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _omit, ...safe } = user;
  void _omit;
  return safe;
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
    rawNotify: row.rawNotify ?? undefined,
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

function toAppSetting<TValue = unknown>(row: DbAppSetting): AppSetting<TValue> {
  return {
    key: row.key,
    value: row.value as TValue,
    updatedBy: maybeUndefined(row.updatedBy),
    createdAt: maybeIso(row.createdAt) ?? new Date().toISOString(),
    updatedAt: maybeIso(row.updatedAt) ?? new Date().toISOString(),
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

function toRiskProfileRecord(row: DbRiskProfile): RiskProfileRecord {
  return {
    userId: row.userId,
    riskLabel: row.riskLabel,
    answers: row.answers as Record<string, unknown>,
    updatedAt: maybeIso(row.updatedAt) ?? new Date().toISOString(),
    behaviorPersona: (row.behaviorPersona as BehaviorPersona | null) ?? null,
    personaProvider: row.personaProvider ?? null,
    analyzedAt: maybeIso(row.analyzedAt) ?? null,
    inputDigest: row.inputDigest ?? null,
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

function toRoundPrediction(row: DbRoundPrediction): RoundPrediction {
  return {
    id: row.id,
    userId: row.userId,
    runId: row.runId,
    round: row.round,
    guess: row.guess === "down" ? "down" : "up",
    resolved: row.resolved,
    correct: row.correct,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: maybeIso(row.resolvedAt),
  };
}

function toCardCollectionItem(row: DbCardCollection): CardCollectionItem {
  const source = ["quest_claim", "streak", "achievement"].includes(row.source)
    ? (row.source as CardCollectionSource)
    : "quest_claim";

  return {
    id: row.id,
    userId: row.userId,
    cardId: row.cardId,
    source,
    drawnAt: row.drawnAt.toISOString(),
    meta: (row.meta ?? null) as CardCollectionItem["meta"],
  };
}

function cardCollectionKey(userId: string, cardId: string) {
  return `${userId}::${cardId}`;
}

function listFallbackCardCollectionForUser(userId: string) {
  return [...fallbackCardCollection.values()]
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.drawnAt.localeCompare(left.drawnAt));
}

function predictionTargetPrice(run: ScenarioRun, roundNumber: number) {
  const quotes = getRoundQuotesForRun(run, roundNumber);
  return quotes.find((quote) => quote.id === "asset-index")
    ?? quotes.find((quote) => quote.id === "asset-stock")
    ?? quotes[0];
}

function resolvePredictionCorrect(before: ScenarioRun, after: ScenarioRun, guess: RoundPredictionGuess) {
  const beforePrice = predictionTargetPrice(before, before.currentRound)?.currentPrice ?? 0;
  const afterPrice = predictionTargetPrice(after, after.currentRound)?.currentPrice ?? beforePrice;
  if (afterPrice === beforePrice) return false;
  return guess === (afterPrice > beforePrice ? "up" : "down");
}

async function settleRoundPredictionsForRun(
  executor: DbExecutor,
  before: ScenarioRun,
  after: ScenarioRun,
) {
  const pending = await executor
    .select()
    .from(roundPredictions)
    .where(
      and(
        eq(roundPredictions.runId, before.id),
        eq(roundPredictions.round, before.currentRound),
        eq(roundPredictions.resolved, false),
      ),
    );

  const resolvedAt = new Date();
  for (const prediction of pending) {
    const guess: RoundPredictionGuess = prediction.guess === "down" ? "down" : "up";
    await executor
      .update(roundPredictions)
      .set({
        resolved: true,
        correct: resolvePredictionCorrect(before, after, guess),
        resolvedAt,
      })
      .where(and(eq(roundPredictions.id, prediction.id), eq(roundPredictions.resolved, false)));
  }
}

function listFallbackRoundPredictionsForRun(runId: string) {
  return [...fallbackRoundPredictions.values()]
    .filter((prediction) => prediction.runId === runId)
    .sort((left, right) => left.round - right.round || left.createdAt.localeCompare(right.createdAt));
}

function settleFallbackRoundPredictions(before: ScenarioRun, after: ScenarioRun) {
  const resolvedAt = new Date().toISOString();
  for (const prediction of listFallbackRoundPredictionsForRun(before.id)) {
    if (prediction.round !== before.currentRound || prediction.resolved) continue;
    fallbackRoundPredictions.set(prediction.id, {
      ...prediction,
      resolved: true,
      correct: resolvePredictionCorrect(before, after, prediction.guess),
      resolvedAt,
    });
  }
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
  const normalizedEmail = email.trim().toLowerCase();
  const [row] = await executor
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  return row ? toUserRecord(row.user, row.profile) : null;
}

async function selectRunForUser(executor: DbExecutor, userId: string) {
  const [row] = await executor.select().from(scenarioRuns).where(eq(scenarioRuns.userId, userId)).limit(1);
  return row ? toRun(row) : null;
}

// 行锁变体（内测 rank7）：写事务内读 run 必须 FOR UPDATE 锁行，否则两个并发写
// （如快速连点交易 + 领奖）读到同一旧行、后写覆盖前写（丢失更新 TOCTOU）。
// 镜像 familyMembers 名额检查 / 支付履约已有的 .for("update") 模式。
async function selectRunForUserForUpdate(tx: DbExecutor, userId: string) {
  const [row] = await tx
    .select()
    .from(scenarioRuns)
    .where(eq(scenarioRuns.userId, userId))
    .limit(1)
    .for("update");
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
    throw new DomainError("当前账号不是学生账号。");
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
    // itest8 P1：并发首屏(Promise.all[getSimulationStateForUser, getPeerHeatForStudent])会让两个独立
    // 事务都读到 null 再各自 insert。冲突目标必须是 user_id 唯一约束——空目标的 onConflictDoNothing
    // 只对主键(随机 id)生效、两条永不冲突=建出重复 run。指定 target=userId 后并发方 DoNothing，再 re-select
    // 拿到胜出者的唯一 run。
    const initialRun = createInitialRun(user.id, classroomId);
    await executor
      .insert(scenarioRuns)
      .values(toRunInsert(initialRun))
      .onConflictDoNothing({ target: scenarioRuns.userId });
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

async function selectUsersByClassroom(executor: DbExecutor, classroomId: string) {
  const rows = await executor
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.classroomId, classroomId));

  return rows.map((row) => toUserRecord(row.user, row.profile));
}

async function selectRunsByClassroom(executor: DbExecutor, classroomId: string) {
  const rows = await executor
    .select()
    .from(scenarioRuns)
    .where(eq(scenarioRuns.classroomId, classroomId));
  return rows.map(toRun);
}

async function selectUsersByIds(executor: DbExecutor, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await executor
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.id, ids));
  return rows.map((row) => toUserRecord(row.user, row.profile));
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

async function listAiSessionRows(executor: DbExecutor, userId: string, limit?: number) {
  // DB-6: bound the (frequent) list path to `limit` rows in SQL so only that many
  // JSONB payloads leave the DB, instead of fetching every row then slicing in JS.
  // Callers that need the full set (e.g. the prune in createAiSession) omit `limit`.
  const query = executor
    .select()
    .from(aiSessions)
    .where(eq(aiSessions.userId, userId))
    .orderBy(desc(aiSessions.updatedAt));
  const rows = await (limit === undefined ? query : query.limit(limit));

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
  fallbackRiskProfiles.clear();
  fallbackRoundPredictions.clear();
  fallbackCardCollection.clear();
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

export async function getRiskProfile(userId: string): Promise<RiskProfileRecord | null> {
  return withScopedDb(
    "getRiskProfile",
    async (db) => {
      const [row] = await db
        .select()
        .from(riskProfiles)
        .where(eq(riskProfiles.userId, userId))
        .limit(1);
      return row ? toRiskProfileRecord(row) : null;
    },
    () => fallbackRiskProfiles.get(userId) ?? null,
  );
}

export async function upsertRiskProfile(
  userId: string,
  input: {
    riskLabel: string;
    answers: Record<string, unknown>;
    behaviorPersona?: BehaviorPersona | null;
    personaProvider?: string | null;
    analyzedAt?: string | Date | null;
    inputDigest?: string | null;
  },
): Promise<RiskProfileRecord> {
  const hasPersona = "behaviorPersona" in input;
  const hasProvider = "personaProvider" in input;
  const hasAnalyzedAt = "analyzedAt" in input;
  const hasDigest = "inputDigest" in input;
  const analyzedAtValue =
    input.analyzedAt === null || input.analyzedAt === undefined
      ? null
      : input.analyzedAt instanceof Date
        ? input.analyzedAt
        : new Date(input.analyzedAt);
  return withDb(
    "upsertRiskProfile",
    async (db) => {
      const now = new Date();
      const [row] = await db
        .insert(riskProfiles)
        .values({
          userId,
          riskLabel: input.riskLabel,
          answers: input.answers,
          updatedAt: now,
          // new row has no prior persona to preserve; omit-when-absent keeps INSERT/UPDATE policy symmetric
          behaviorPersona: hasPersona ? (input.behaviorPersona ?? null) : undefined,
          personaProvider: hasProvider ? (input.personaProvider ?? null) : undefined,
          analyzedAt: hasAnalyzedAt ? analyzedAtValue : undefined,
          inputDigest: hasDigest ? (input.inputDigest ?? null) : undefined,
        })
        .onConflictDoUpdate({
          target: riskProfiles.userId,
          set: {
            riskLabel: input.riskLabel,
            answers: input.answers,
            updatedAt: now,
            // Only overwrite persona fields when the caller supplied them, so a
            // plain questionnaire re-save does not wipe an existing AI persona.
            ...(hasPersona ? { behaviorPersona: input.behaviorPersona ?? null } : {}),
            ...(hasProvider ? { personaProvider: input.personaProvider ?? null } : {}),
            ...(hasAnalyzedAt ? { analyzedAt: analyzedAtValue } : {}),
            ...(hasDigest ? { inputDigest: input.inputDigest ?? null } : {}),
          },
        })
        .returning();
      return toRiskProfileRecord(row);
    },
    () => {
      const existing = fallbackRiskProfiles.get(userId);
      const record: RiskProfileRecord = {
        userId,
        riskLabel: input.riskLabel,
        answers: input.answers,
        updatedAt: new Date().toISOString(),
        behaviorPersona: hasPersona
          ? input.behaviorPersona ?? null
          : existing?.behaviorPersona ?? null,
        personaProvider: hasProvider
          ? input.personaProvider ?? null
          : existing?.personaProvider ?? null,
        analyzedAt: hasAnalyzedAt
          ? maybeIso(analyzedAtValue) ?? null
          : existing?.analyzedAt ?? null,
        inputDigest: hasDigest ? input.inputDigest ?? null : existing?.inputDigest ?? null,
      };
      fallbackRiskProfiles.set(userId, record);
      return record;
    },
  );
}

// ---------------------------------------------------------------------------
// Auth & invite
// ---------------------------------------------------------------------------

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

export async function findInviteByCode(code: string) {
  const normalizedCode = normalizeInviteCode(code);
  return withDb(
    "findInviteByCode",
    async (db) => {
      const [row] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, normalizedCode)).limit(1);
      return row ? toInvite(row) : null;
    },
    () => store.findInviteByCode(normalizedCode),
  );
}

export async function validateInviteCode(code: string) {
  const normalizedCode = normalizeInviteCode(code);
  return withDb(
    "validateInviteCode",
    async (db) => {
      const invite = await findInviteByCodeWithExecutor(db, normalizedCode);
      if (!invite) return { valid: false, reason: "邀请码不存在。" };
      if (invite.usesRemaining <= 0) return { valid: false, reason: "邀请码已达到使用上限。" };
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return { valid: false, reason: "邀请码已过期。" };
      }
      return { valid: true, invite };
    },
    () => store.validateInviteCode(normalizedCode),
  );
}

async function findInviteByCodeWithExecutor(executor: DbExecutor, code: string) {
  const [row] = await executor.select().from(inviteCodes).where(eq(inviteCodes.code, normalizeInviteCode(code))).limit(1);
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
  const normalizedInviteCode = normalizeInviteCode(input.inviteCode);
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
              eq(inviteCodes.code, normalizedInviteCode),
              sql`${inviteCodes.usesRemaining} > 0`,
              sql`${inviteCodes.expiresAt} > now()`,
            ),
          )
          .returning();

        if (reservedRows.length === 0) {
          const probe = await findInviteByCodeWithExecutor(tx, normalizedInviteCode);
          if (!probe) throw new DomainError("邀请码不存在。");
          if (new Date(probe.expiresAt).getTime() < Date.now()) {
            throw new DomainError("邀请码已过期。");
          }
          throw new DomainError("邀请码已达到使用上限。");
        }

        const invite = toInvite(reservedRows[0]);

        const existingUser = await selectUserByEmail(tx, normalizedEmail);
        if (existingUser) throw new DomainError("这个邮箱已经被注册过了。");

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
          const linkedRun = link ? await selectRunForUserForUpdate(tx, link.studentUserId) : null;

          if (link && linkedRun) {
            const report = buildGrowthReport(linkedRun, link.studentUserId, newUser.id);
            // H8: a student has exactly one current growth report (unique index on
            // student_user_id). A returning/seeded student already has one, so a plain
            // insert here threw a unique violation and rolled back the whole parent
            // registration. Upsert, mirroring syncGrowthReportForStudent.
            await tx
              .insert(growthReports)
              .values({
                id: createId("growth-report"),
                studentUserId: link.studentUserId,
                parentUserId: newUser.id,
                payload: report,
              })
              .onConflictDoUpdate({
                target: growthReports.studentUserId,
                set: {
                  parentUserId: newUser.id,
                  payload: report,
                },
              });
          }
        }

        // usesRemaining already decremented above via atomic reservation.

        return newUser;
      }),
    () => store.registerUserByInvite({ ...input, email: normalizedEmail, inviteCode: normalizedInviteCode }),
  );
}

export async function registerUserByEmail(input: {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedInviteCode = input.inviteCode ? normalizeInviteCode(input.inviteCode) : undefined;
  return withDb(
    "registerUserByEmail",
    async (db) =>
      db.transaction(async (tx) => {
        const existingUser = await selectUserByEmail(tx, normalizedEmail);
        if (existingUser) throw new DomainError("这个邮箱已经被注册过了。");

        let role: UserRecord["role"] = "student";
        let classroomId: string | undefined;
        let studentLinkId: string | undefined;

        if (normalizedInviteCode) {
          const reservedRows = await tx
            .update(inviteCodes)
            .set({ usesRemaining: sql`${inviteCodes.usesRemaining} - 1` })
            .where(
              and(
                eq(inviteCodes.code, normalizedInviteCode),
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
            throw new DomainError("邀请码无效、已过期或已用完。如不需要邀请码，请留空后重试。");
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
    () => store.registerUserByEmail({ ...input, email: normalizedEmail, inviteCode: normalizedInviteCode }),
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

export async function listRoundPredictionsForRun(runId: string) {
  return withDb(
    "listRoundPredictionsForRun",
    async (db) => {
      const rows = await db
        .select()
        .from(roundPredictions)
        .where(eq(roundPredictions.runId, runId))
        .orderBy(roundPredictions.round, roundPredictions.createdAt);
      return rows.map(toRoundPrediction);
    },
    () => listFallbackRoundPredictionsForRun(runId),
  );
}

export async function createRoundPredictionForUser(
  userId: string,
  input: { guess: RoundPredictionGuess },
): Promise<RoundPrediction> {
  return withDb(
    "createRoundPredictionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");
        if (run.currentRound >= run.totalRounds) {
          throw new DomainError("本局已经结束，不能继续提交涨跌预测。");
        }

        const [existing] = await tx
          .select()
          .from(roundPredictions)
          .where(
            and(
              eq(roundPredictions.userId, userId),
              eq(roundPredictions.runId, run.id),
              eq(roundPredictions.round, run.currentRound),
            ),
          )
          .limit(1);
        if (existing) {
          throw new DomainError("本回合已经提交过预测。");
        }

        const [row] = await tx
          .insert(roundPredictions)
          .values({
            id: createId("pred"),
            userId,
            runId: run.id,
            round: run.currentRound,
            guess: input.guess,
          })
          .returning();
        return toRoundPrediction(row);
      }),
    () => {
      const run = store.getRunForUser(userId);
      if (!run) throw new DomainError("未找到对应的学生沙盘。");
      if (run.currentRound >= run.totalRounds) {
        throw new DomainError("本局已经结束，不能继续提交涨跌预测。");
      }

      const existing = listFallbackRoundPredictionsForRun(run.id).find(
        (prediction) => prediction.userId === userId && prediction.round === run.currentRound,
      );
      if (existing) {
        throw new DomainError("本回合已经提交过预测。");
      }

      const record: RoundPrediction = {
        id: createId("pred"),
        userId,
        runId: run.id,
        round: run.currentRound,
        guess: input.guess,
        resolved: false,
        correct: false,
        createdAt: new Date().toISOString(),
      };
      fallbackRoundPredictions.set(record.id, record);
      return record;
    },
  );
}

export async function listCardCollectionForUser(userId: string): Promise<CardCollectionItem[]> {
  return withDb(
    "listCardCollectionForUser",
    async (db) => {
      const rows = await db
        .select()
        .from(cardCollection)
        .where(eq(cardCollection.userId, userId))
        .orderBy(desc(cardCollection.drawnAt));
      return rows.map(toCardCollectionItem);
    },
    () => listFallbackCardCollectionForUser(userId),
  );
}

export async function drawCardForUser(
  userId: string,
  input: { cardId: string; source: CardCollectionSource; meta?: Record<string, unknown> | null },
): Promise<CardCollectionItem> {
  return withDb(
    "drawCardForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(cardCollection)
          .where(and(eq(cardCollection.userId, userId), eq(cardCollection.cardId, input.cardId)))
          .limit(1);
        if (existing) return toCardCollectionItem(existing);

        await tx
          .insert(cardCollection)
          .values({
            id: createId("card"),
            userId,
            cardId: input.cardId,
            source: input.source,
            meta: input.meta ?? null,
          })
          .onConflictDoNothing();

        const [row] = await tx
          .select()
          .from(cardCollection)
          .where(and(eq(cardCollection.userId, userId), eq(cardCollection.cardId, input.cardId)))
          .limit(1);
        if (!row) throw new Error("卡牌收藏写入失败，请稍后再试。");
        return toCardCollectionItem(row);
      }),
    () => {
      const key = cardCollectionKey(userId, input.cardId);
      const existing = fallbackCardCollection.get(key);
      if (existing) return existing;

      const record: CardCollectionItem = {
        id: createId("card"),
        userId,
        cardId: input.cardId,
        source: input.source,
        drawnAt: new Date().toISOString(),
        meta: input.meta ?? null,
      };
      fallbackCardCollection.set(key, record);
      return record;
    },
  );
}

export async function getSimulationStateForUser(userId: string) {
  return withDb(
    "getSimulationStateForUser",
    async (db) => {
      const user = await selectUserById(db, userId);
      if (!user || user.role !== "student") {
        throw new DomainError("当前账号没有可用的学生沙盘。");
      }

      const ready = await db.transaction((tx) => ensureStudentSandbox(tx, user));

      // DB-1: scope to the student's classroom in SQL instead of loading every
      // run/user and filtering in app code. ready.run.classroomId is the same
      // classroom the old app-filter used and is guaranteed non-null (matches the
      // proven getPeerHeatForStudent pattern below).
      const [classroomUsers, classroomRuns] = await Promise.all([
        selectUsersByClassroom(db, ready.run.classroomId),
        selectRunsByClassroom(db, ready.run.classroomId),
      ]);
      return buildSimulationState(
        ready.user,
        ready.classroom,
        ready.run,
        classroomRuns,
        classroomUsers,
      );
    },
    () => store.getSimulationStateForUser(userId),
  );
}

export async function getPeerHeatForStudent(userId: string) {
  return withDb(
    "getPeerHeatForStudent",
    async (db) => {
      const user = await selectUserById(db, userId);
      if (!user || user.role !== "student") {
        throw new DomainError("当前账号没有可用的学生沙盘。");
      }

      const ready = await db.transaction((tx) => ensureStudentSandbox(tx, user));
      const rows = await db
        .select()
        .from(scenarioRuns)
        .where(eq(scenarioRuns.classroomId, ready.run.classroomId));

      return buildPeerHeatPayload(rows.map(toRun), ready.run, ready.classroom.name);
    },
    () => store.getPeerHeatForStudent(userId),
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
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

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
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

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
        if (!owner || !student) throw new DomainError("用户不存在。");
        if (student.role !== "student") throw new DomainError("只能把学生加入家庭组。");

        const state = resolveSubscriptionState(
          owner.subscriptionTier,
          owner.trialExpiresAt,
          owner.subscriptionExpiresAt,
        );
        if (!(state.status === "active" && owner.subscriptionTier === "premium")) {
          throw new DomainError("只有高级版家长才能创建家庭组。");
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
        if (!link) throw new DomainError("你没有权限把该学生加入家庭组（需先与孩子绑定）。");

        const [existing] = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.studentUserId, studentUserId))
          .limit(1);
        if (existing) throw new DomainError("该学生已在一个家庭组中。");

        // Lock this owner's existing family rows so concurrent adds serialize and
        // cannot both pass the seat-cap check (TOCTOU over-subscription).
        const current = await tx
          .select()
          .from(familyMembers)
          .where(eq(familyMembers.ownerUserId, ownerUserId))
          .for("update");
        if (!canAddFamilyMember(current.length, state.features.maxStudents)) {
          throw new DomainError(`家庭名额已满（上限 ${state.features.maxStudents} 名）。`);
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
export async function getSeasonLeaderboard(classroomId: string) {
  // itest7 P1：赛季榜必须限定在 viewer 的班级内，避免把跨班/跨校陌生未成年人的真名与内部
  // userId/classroomId 全局暴露。无班级则无榜（学生正常都有 classroomId）。
  if (!classroomId) return [];
  return withDb(
    "getSeasonLeaderboard",
    async (db) => {
      // Filter to the current season's runs in SQL (indexed) instead of scanning
      // every historical run, then only load the users who own those runs.
      const seed = currentSeasonSeed();
      // Rank in SQL (composite index seed, net_worth) and take only the top N，
      // 按班级作用域过滤（itest7 P1）：直接用 scenario_runs.classroom_id（notNull + 索引
      // scenario_runs_classroom_id_idx），无需 join users——且与 store 兜底路径(run.classroomId)
      // 语义一致（itest7 自审：此前 join users.classroomId 与兜底不一致且未走该列索引）。
      const runRows = await db
        .select()
        .from(scenarioRuns)
        .where(and(eq(scenarioRuns.seed, seed), eq(scenarioRuns.classroomId, classroomId)))
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
    // itest7 自审：兜底也必须传 classroomId，否则读兜底路径会退回【全局】赛季榜，重新泄露跨班真名。
    () => store.getSeasonLeaderboard(classroomId),
  );
}

/** Weekly digests for the Premium family report email cron. */
export async function listPremiumFamilyDigests(): Promise<FamilyDigest[]> {
  return withDb(
    "listPremiumFamilyDigests",
    async (db) => {
      // DB-3: batch the per-member lookups (was 1 + 3*M serial round-trips) into
      // set-based queries — owners, students, and one run per student via inArray.
      const members = await db.select().from(familyMembers);
      if (members.length === 0) return [];

      const owners = await selectUsersByIds(db, [...new Set(members.map((m) => m.ownerUserId))]);
      const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
      const eligible = members.filter((member) => {
        const owner = ownerById.get(member.ownerUserId);
        if (!owner) return false;
        const state = resolveSubscriptionState(
          owner.subscriptionTier,
          owner.trialExpiresAt,
          owner.subscriptionExpiresAt,
        );
        return state.status === "active" && owner.subscriptionTier === "premium";
      });
      if (eligible.length === 0) return [];

      const studentIds = [...new Set(eligible.map((member) => member.studentUserId))];
      const students = await selectUsersByIds(db, studentIds);
      const studentById = new Map(students.map((student) => [student.id, student]));
      const runRows = await db
        .select()
        .from(scenarioRuns)
        .where(inArray(scenarioRuns.userId, studentIds));
      const runByUserId = new Map<string, (typeof runRows)[number]>();
      for (const row of runRows) {
        if (!runByUserId.has(row.userId)) runByUserId.set(row.userId, row);
      }

      const digests: FamilyDigest[] = [];
      for (const member of eligible) {
        const owner = ownerById.get(member.ownerUserId);
        const student = studentById.get(member.studentUserId);
        const runRow = runByUserId.get(member.studentUserId);
        if (!owner || !student || !runRow) continue;
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
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

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
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const updated = executeAutoInvestForRound(advanceSimulationRun(run));
        await settleRoundPredictionsForRun(tx, run, updated);
        await tx.update(scenarioRuns).set(toRunUpdate(updated)).where(eq(scenarioRuns.id, updated.id));
        await syncGrowthReportForStudent(tx, userId);
        return updated;
      }),
    () => {
      const before = store.getRunForUser(userId);
      const updated = store.advanceRunForUser(userId);
      if (before) settleFallbackRoundPredictions(before, updated);
      return updated;
    },
  );
}

export async function createAutoInvestPlanForUser(userId: string, input: Partial<AutoInvestInput>) {
  return withDb(
    "createAutoInvestPlanForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const updated = createAutoInvestPlan(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(updated)).where(eq(scenarioRuns.id, updated.id));
        await syncGrowthReportForStudent(tx, userId);
        return updated;
      }),
    () => store.createAutoInvestPlanForUser(userId, input),
  );
}

export async function cancelAutoInvestPlanForUser(userId: string) {
  return withDb(
    "cancelAutoInvestPlanForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const updated = cancelAutoInvestPlan(run);
        await tx.update(scenarioRuns).set(toRunUpdate(updated)).where(eq(scenarioRuns.id, updated.id));
        await syncGrowthReportForStudent(tx, userId);
        return updated;
      }),
    () => store.cancelAutoInvestPlanForUser(userId),
  );
}

export async function applyLifeCashflowChallengeForUser(userId: string, input: LifeCashflowApplyInput = {}) {
  return withDb(
    "applyLifeCashflowChallengeForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = applyLifeCashflowChallenge(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.applyLifeCashflowChallengeForUser(userId, input),
  );
}

export async function applyCreditLabActionForUser(userId: string, input: CreditLabActionInput = {}) {
  return withDb(
    "applyCreditLabActionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = applyCreditLabAction(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.applyCreditLabActionForUser(userId, input),
  );
}

export async function claimQuestRewardForUser(userId: string, questId: string) {
  return withDb(
    "claimQuestRewardForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const rows = await tx
          .select({ moduleKey: learningProgress.moduleKey })
          .from(learningProgress)
          .where(and(eq(learningProgress.userId, userId), eq(learningProgress.quizPassed, true)));
        const valid = new Set<string>(learningModules.map((module) => module.key));
        const completedKeys = rows.map((row) => row.moduleKey).filter((key) => valid.has(key));
        const learning = { completed: completedKeys.length, total: valid.size, completedKeys };

        const outcome = claimQuestReward(run, learning, questId);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.claimQuestRewardForUser(userId, questId),
  );
}

export async function claimSeasonRewardForUser(userId: string, challengeId: string) {
  return withDb(
    "claimSeasonRewardForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = claimSeasonChallengeReward(run, challengeId);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.claimSeasonRewardForUser(userId, challengeId),
  );
}

export async function createOpportunityNoteForUser(userId: string, input: OpportunityNoteInput) {
  return withDb(
    "createOpportunityNoteForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = createOpportunityNote(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.createOpportunityNoteForUser(userId, input),
  );
}

export async function createFundLabActionForUser(userId: string, input: FundLabActionInput) {
  return withDb(
    "createFundLabActionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = createFundLabAction(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.createFundLabActionForUser(userId, input),
  );
}

export async function createGoalAccountActionForUser(userId: string, input: GoalAccountActionInput) {
  return withDb(
    "createGoalAccountActionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = createGoalAccountAction(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.createGoalAccountActionForUser(userId, input),
  );
}

export async function createProtectionUmbrellaActionForUser(userId: string, input: ProtectionUmbrellaActionInput) {
  return withDb(
    "createProtectionUmbrellaActionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = createProtectionUmbrellaAction(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.createProtectionUmbrellaActionForUser(userId, input),
  );
}

export async function createStudentWatchlistActionForUser(userId: string, input: StudentWatchlistActionInput) {
  return withDb(
    "createStudentWatchlistActionForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = createStudentWatchlistAction(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.createStudentWatchlistActionForUser(userId, input),
  );
}

export async function createWealthReviewForUser(userId: string, input: WealthReviewInput) {
  return withDb(
    "createWealthReviewForUser",
    async (db) =>
      db.transaction(async (tx) => {
        const run = await selectRunForUserForUpdate(tx, userId);
        if (!run) throw new DomainError("未找到对应的学生沙盘。");

        const outcome = createWealthReview(run, input);
        await tx.update(scenarioRuns).set(toRunUpdate(outcome.run)).where(eq(scenarioRuns.id, outcome.run.id));
        await syncGrowthReportForStudent(tx, userId);
        return outcome;
      }),
    () => store.createWealthReviewForUser(userId, input),
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
        throw new DomainError("当前教师账号没有绑定班级。");
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
  const overview = await withDb(
    "getTeacherOverview",
    async (db) => {
      const teacher = await selectUserById(db, userId);
      if (!teacher?.classroomId) {
        throw new DomainError("当前账号没有教师权限或未绑定班级。");
      }

      const classroom = await selectClassroomById(db, teacher.classroomId);
      // 保持普通 Error（非 DomainError）：教师 classroomId 有值却查不到班级 = 潜在 FK 漂移/
      // 数据不一致，应继续记 [repo.fallback] 告警可见（itest6 R3 P3-5 监工复核结论）。
      if (!classroom) throw new Error("班级不存在。");

      // DB-2: scope every query to this classroom in SQL (the assignments query
      // already did). buildLeaderboard only looks users up by run.userId, and all
      // scoped runs belong to this classroom, so classroom-scoped users suffice.
      const [classroomUsers, runs, assignmentRows, inviteRows] = await Promise.all([
        selectUsersByClassroom(db, classroom.id),
        selectRunsByClassroom(db, classroom.id),
        db.select().from(assignments).where(eq(assignments.classroomId, classroom.id)),
        db
          .select()
          .from(inviteCodes)
          .where(or(eq(inviteCodes.classroomId, classroom.id), eq(inviteCodes.createdBy, teacher.id))),
      ]);
      const studentUsers = classroomUsers.filter((user) => user.role === "student");
      const leaderboard = buildLeaderboard(runs, classroomUsers).filter(
        (entry) => entry.classroomId === classroom.id,
      );

      return {
        teacher,
        classroom,
        assignments: assignmentRows.map(toAssignment),
        invites: inviteRows.map(toInvite),
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
  // Defence-in-depth: never serialize passwordHash to the client, regardless of
  // whether the data came from the DB or the in-memory fallback.
  return {
    ...overview,
    teacher: withoutPasswordHash(overview.teacher),
    students: overview.students.map(withoutPasswordHash),
  };
}

export async function getParentOverview(userId: string) {
  const overview = await withDb(
    "getParentOverview",
    async (db) => {
      const parent = await selectUserById(db, userId);
      const [linkRow] = await db
        .select()
        .from(studentParentLinks)
        .where(eq(studentParentLinks.parentUserId, userId))
        .limit(1);
      if (!parent || !linkRow) {
        throw new DomainError("当前账号还没有绑定学生。");
      }

      const student = await selectUserById(db, linkRow.studentUserId);
      const [reportRow] = await db
        .select()
        .from(growthReports)
        .where(eq(growthReports.parentUserId, userId))
        .limit(1);
      const run = await selectRunForUser(db, linkRow.studentUserId);
      if (!student || !reportRow || !run) {
        throw new DomainError("成长报告数据暂不可用。");
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
  // Defence-in-depth: strip passwordHash from the parent's own row and the
  // linked student's row before this reaches the browser.
  return {
    ...overview,
    parent: withoutPasswordHash(overview.parent),
    student: withoutPasswordHash(overview.student),
  };
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
        // DB-5: the admin board only needs the top few runs by net worth. Rank by
        // the materialized scenario_runs.netWorth column (kept == the latest
        // snapshot's netWorth via run.netWorth/toRunUpdate, which is buildLeaderboard's
        // sort key) and fetch just those, instead of every run's full JSONB. No
        // migration needed — netWorth is already materialized; disciplineScore for the
        // few comes from their snapshots. NULLS LAST so an unset netWorth can't rank top.
        const [allUsers, topRuns, classroomRows, inviteRows, assignmentRows, orderRows] = await Promise.all([
          selectAllUsers(db),
          db
            .select()
            .from(scenarioRuns)
            .orderBy(sql`${scenarioRuns.netWorth} desc nulls last`)
            .limit(5),
          db.select().from(classrooms),
          db.select().from(inviteCodes),
          db.select().from(assignments).orderBy(desc(assignments.createdAt)),
          db.select().from(paymentOrders),
        ]);
        const leaderboard = buildLeaderboard(topRuns.map(toRun), allUsers);
        const now = Date.now();
        const standardUsers = allUsers.filter((user) => user.subscriptionTier === "standard" || user.subscriptionTier === "premium");
        const trialUsers = allUsers.filter(
          (user) =>
            user.subscriptionTier === "free" &&
            user.trialExpiresAt &&
            new Date(user.trialExpiresAt).getTime() > now,
        );
        const paidOrders = orderRows.filter((order) => order.status === "paid");
        const userById = new Map(allUsers.map((user) => [user.id, user]));
        const manualOrders = orderRows
          .filter((order) => order.channel === "manual" && order.status === "pending")
          .map((order) => {
            const payer = userById.get(order.userId);
            const target = userById.get(order.targetUserId);
            if (!payer || !target) return null;
            return {
              order: toPaymentOrder(order),
              payer: toAdminUserSummary(payer),
              target: toAdminUserSummary(target),
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .sort((a, b) => Date.parse(b.order.createdAt) - Date.parse(a.order.createdAt));

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
          manualOrders,
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
      // DB-7: scope the classroom view in SQL; only the "school" view needs every
      // run. (This helper is currently orphaned — kept consistent with the rest.)
      if (scope === "classroom") {
        const [classroomRuns, classroomUsers] = await Promise.all([
          selectRunsByClassroom(db, "class-1"),
          selectUsersByClassroom(db, "class-1"),
        ]);
        return buildLeaderboard(classroomRuns, classroomUsers).filter(
          (item) => item.classroomId === "class-1",
        );
      }

      const [allRuns, allUsers] = await Promise.all([selectAllRuns(db), selectAllUsers(db)]);
      return buildLeaderboard(allRuns, allUsers);
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
          throw new DomainError("未找到对应的 AI 会话。");
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
  return withScopedDb(
    "listAiSessionsForUser",
    (db) => listAiSessionRows(db, userId, 10),
    () => store.listAiSessionsForUser(userId),
  );
}

export async function getAiSessionById(sessionId: string, userId: string) {
  return withScopedDb(
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

      if (!updated) throw new DomainError("用户不存在。");
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
        throw new DomainError("这个邮箱已经被注册过了。");
      }

      const [updated] = await db
        .update(users)
        .set({
          email: normalizedEmail,
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updated) throw new DomainError("用户不存在。");
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
        if (existing) throw new DomainError("这个邮箱已经注册过了。");

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
        if (!current) throw new DomainError("用户不存在。");

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
        if (!updated) throw new DomainError("用户不存在。");

        const profilePatch: Partial<typeof profiles.$inferInsert> = {};
        if (input.name !== undefined) profilePatch.name = input.name.trim();
        if (input.title !== undefined) profilePatch.title = input.title.trim();
        if (Object.keys(profilePatch).length > 0) {
          await tx.update(profiles).set(profilePatch).where(eq(profiles.userId, userId));
        }

        if (nextRole === "student" && classroomId) {
          const existingRun = await selectRunForUserForUpdate(tx, userId);
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

export async function getAppSetting<TValue = unknown>(key: string) {
  return withDb(
    "getAppSetting",
    async (db) => {
      const [setting] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key))
        .limit(1);
      return setting ? toAppSetting<TValue>(setting) : null;
    },
    () => store.getAppSetting<TValue>(key),
  );
}

export async function upsertAppSetting<TValue = unknown>(
  key: string,
  value: TValue,
  updatedBy?: string,
) {
  return withDb(
    "upsertAppSetting",
    async (db) => {
      const now = new Date();
      const [setting] = await db
        .insert(appSettings)
        .values({
          key,
          value,
          updatedBy: updatedBy ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: {
            value,
            updatedBy: updatedBy ?? null,
            updatedAt: now,
          },
        })
        .returning();
      return toAppSetting<TValue>(setting);
    },
    () => store.upsertAppSetting<TValue>(key, value, updatedBy),
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
      if (!order) throw new DomainError("支付订单不存在。");
      return toPaymentOrder(order);
    },
    () => store.updatePaymentOrderProviderFields(outTradeNo, fields),
  );
}

export async function attachManualPaymentProof(
  outTradeNo: string,
  input: { note: string; submittedBy: string; proofImageDataUrl?: string },
) {
  return withDb(
    "attachManualPaymentProof",
    async (db) => {
      const [existing] = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.outTradeNo, outTradeNo))
        .limit(1);
      if (!existing) throw new DomainError("支付订单不存在。");
      if (existing.channel !== "manual") throw new DomainError("该订单不是人工核验订单。");
      if (existing.status !== "pending") throw new DomainError("该订单已处理，不能重复提交凭证。");

      const [order] = await db
        .update(paymentOrders)
        .set({
          rawNotify: {
            ...(existing.rawNotify && typeof existing.rawNotify === "object" ? existing.rawNotify : {}),
            manualProof: {
              note: input.note,
              submittedBy: input.submittedBy,
              proofImageDataUrl: input.proofImageDataUrl,
              submittedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.outTradeNo, outTradeNo))
        .returning();
      return toPaymentOrder(order);
    },
    () => store.attachManualPaymentProof(outTradeNo, input),
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
        // Row-lock the order so a concurrent SUCCESS callback / manual-confirm blocks
        // here, then re-reads status="paid" and no-ops via the idempotency gate below,
        // instead of both passing the gate under READ COMMITTED and double-granting (#3).
        const [order] = await tx
          .select()
          .from(paymentOrders)
          .where(eq(paymentOrders.outTradeNo, input.outTradeNo))
          .limit(1)
          .for("update");
        if (!order) throw new DomainError("支付订单不存在。");

        // Defense-in-depth: a SUCCESS callback must report the amount we charged.
        // Tier is server-set from order.tier (not the payload), so this only guards
        // against an under/over-paid amount fulfilling the full subscription.
        if (input.paidAmountFen != null && input.paidAmountFen !== order.amountFen) {
          // 保持普通 Error（非 DomainError）：支付金额与订单不符=反欺诈信号，必须保持
          // [repo.fallback] 可见/可告警，不能因静音领域错误而丢失（itest6 R3 P3-5 监工复核结论）。
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
        if (!targetUser) throw new DomainError("订阅目标账号不存在。");

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
      if (!order) throw new DomainError("支付订单不存在。");
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
      // Single round-trip insert-or-return. Previously this was INSERT … ON
      // CONFLICT DO NOTHING followed by a separate SELECT — two sequential
      // round-trips, which on a high-latency / cold link (the DB is cross-region
      // for CN users; a cold connection measured ~1.7s) could blow past the 5s
      // query budget and surface as "findOrCreateSchool timed out". A no-op
      // self-assignment of the conflict-target column makes ON CONFLICT DO UPDATE
      // RETURN the existing row WITHOUT overwriting its first-created canonical
      // name, so we always get the row back in one trip.
      const [row] = await db
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
        .onConflictDoUpdate({
          target: [schools.cityCode, schools.normalizedName],
          set: { cityCode: input.cityCode },
        })
        .returning();
      // Defensive: RETURNING always yields a row for insert-or-update; a miss would
      // mean a pathological race. Fail clean rather than crash in toSchool(undefined).
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
        .values({ id: createId("lp"), userId, moduleKey, quizPassed: true })
        .onConflictDoUpdate({
          target: [learningProgress.userId, learningProgress.moduleKey],
          set: { quizPassed: true, completedAt: sql`now()` },
        });
      return { userId, moduleKey, quizPassed: true, completedAt: new Date().toISOString() };
    },
    () => store.markModuleComplete(userId, moduleKey),
  );
}

export async function markModuleQuizPassed(
  userId: string,
  moduleKey: string,
): Promise<LearningProgressRow> {
  return withDb(
    "markModuleQuizPassed",
    async (db) => {
      await db
        .insert(learningProgress)
        .values({ id: createId("lp"), userId, moduleKey, quizPassed: true })
        .onConflictDoUpdate({
          target: [learningProgress.userId, learningProgress.moduleKey],
          set: { quizPassed: true },
        });
      return { userId, moduleKey, quizPassed: true, completedAt: new Date().toISOString() };
    },
    () => store.markModuleQuizPassed(userId, moduleKey),
  );
}

export async function hasModuleQuizPassed(userId: string, moduleKey: string): Promise<boolean> {
  return withDb(
    "hasModuleQuizPassed",
    async (db) => {
      const rows = await db
        .select({ quizPassed: learningProgress.quizPassed })
        .from(learningProgress)
        .where(and(eq(learningProgress.userId, userId), eq(learningProgress.moduleKey, moduleKey)))
        .limit(1);
      return rows[0]?.quizPassed === true;
    },
    () => store.hasModuleQuizPassed(userId, moduleKey),
  );
}

export async function getLearningProgress(userId: string): Promise<LearningProgressSummary> {
  return withDb(
    "getLearningProgress",
    async (db) => {
      const rows = await db
        .select({ moduleKey: learningProgress.moduleKey })
        .from(learningProgress)
        .where(and(eq(learningProgress.userId, userId), eq(learningProgress.quizPassed, true)));
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
