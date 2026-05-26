/**
 * Brown Zone DB Adapter Layer
 * ============================================
 * This module is the single bridge between API routes and persistence.
 *
 * When DATABASE_URL is missing or a DB query fails, every function delegates to
 * the legacy in-memory store. That keeps the offline teacher-computer demo
 * working while allowing the hosted app to use Supabase Postgres.
 */

import bcrypt from "bcryptjs";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { learningModules } from "@/lib/content";
import { getDb, isDatabaseConfigured } from "@/lib/db/client";
import {
  aiSessions,
  assignments,
  classrooms,
  growthReports,
  inviteCodes,
  profiles,
  scenarioRuns,
  studentParentLinks,
  users,
} from "@/lib/db/schema";
import {
  advanceSimulationRun,
  applySimulationAction,
  buildBehaviorSignals,
  buildGrowthReport,
  buildLeaderboard,
  buildSimulationState,
  createInitialRun,
} from "@/lib/simulation";
import * as store from "@/lib/store";
import type {
  AiChatMessage,
  AiChatMode,
  AiChatSession,
  Assignment,
  Classroom,
  GrowthReport,
  InviteCode,
  ProfileRecord,
  Role,
  ScenarioRun,
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
type FallbackReason = "no_database_url" | "connection_failed" | "query_failed";

const DB_QUERY_TIMEOUT_MS = 12000;

// In production, default to NO memory fallback so DB outages surface as 5xx
// rather than silently returning seed data. Set ALLOW_MEMORY_FALLBACK=true to
// keep the offline teacher-laptop demo behaviour.
const ALLOW_MEMORY_FALLBACK =
  process.env.ALLOW_MEMORY_FALLBACK === "true" || process.env.NODE_ENV !== "production";

function logFallback(fn: string, reason: FallbackReason, err?: unknown) {
  if (reason !== "no_database_url" && process.env.NODE_ENV !== "test") {
    console.warn(`[repo] ${fn} -> fallback (${reason})`, err ?? "");
  }
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

async function withDb<T>(
  fn: string,
  dbFn: (db: Db) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isDatabaseConfigured()) {
    if (!ALLOW_MEMORY_FALLBACK) {
      throw new Error(`[repo] ${fn}: DATABASE_URL not configured`);
    }
    logFallback(fn, "no_database_url");
    return await fallback();
  }

  const db = getDb();
  if (!db) {
    if (!ALLOW_MEMORY_FALLBACK) {
      throw new Error(`[repo] ${fn}: DB client unavailable`);
    }
    logFallback(fn, "connection_failed");
    return await fallback();
  }

  try {
    return await withQueryTimeout(fn, dbFn(db));
  } catch (err) {
    logFallback(fn, "query_failed", err);
    if (!ALLOW_MEMORY_FALLBACK) {
      throw err;
    }
    return await fallback();
  }
}

function maybeUndefined<T>(value: T | null | undefined) {
  return value === null ? undefined : value;
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

function toRun(row: DbRun): ScenarioRun {
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
    holdings: row.holdings as ScenarioRun["holdings"],
    eventHistory: row.eventHistory as ScenarioRun["eventHistory"],
    actionLog: row.actionLog as ScenarioRun["actionLog"],
    snapshots: row.snapshots as ScenarioRun["snapshots"],
    lastInsight: maybeUndefined(row.lastInsight),
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
  const [existing] = await executor
    .select()
    .from(growthReports)
    .where(eq(growthReports.studentUserId, studentUserId))
    .limit(1);

  if (existing) {
    await executor
      .update(growthReports)
      .set({
        parentUserId: linkRow.parentUserId,
        payload: report,
      })
      .where(eq(growthReports.id, existing.id));
    return;
  }

  await executor.insert(growthReports).values({
    id: createId("growth-report"),
    studentUserId: linkRow.studentUserId,
    parentUserId: linkRow.parentUserId,
    payload: report,
  });
}

async function listAiSessionRows(executor: DbExecutor, userId: string) {
  const rows = await executor
    .select()
    .from(aiSessions)
    .where(eq(aiSessions.userId, userId))
    .orderBy(desc(aiSessions.createdAt));

  return rows
    .map(toAiSession)
    .sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt));
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

export async function authenticateUser(email: string, password: string) {
  return withDb(
    "authenticateUser",
    async (db) => {
      const user = await selectUserByEmail(db, email);
      if (!user) return null;
      return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
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

        const existingUser = await selectUserByEmail(tx, input.email);
        if (existingUser) throw new Error("这个邮箱已经被注册过了。");

        const newUser: UserRecord = {
          id: createId("user"),
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, 10),
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
    () => store.registerUserByInvite(input),
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
      if (!user || user.role !== "student" || !user.classroomId) {
        throw new Error("当前账号没有可用的学生沙盘。");
      }

      const classroom = await selectClassroomById(db, user.classroomId);
      const run = await selectRunForUser(db, userId);
      if (!classroom || !run) {
        throw new Error("未找到对应的班级或沙盘进度。");
      }

      const [allUsers, allRuns] = await Promise.all([selectAllUsers(db), selectAllRuns(db)]);
      return buildSimulationState(
        user,
        classroom,
        run,
        allRuns.filter((item) => item.classroomId === user.classroomId),
        allUsers.filter((item) => item.classroomId === user.classroomId),
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

export async function getAdminOverview() {
  return withDb(
    "getAdminOverview",
    async (db) => {
      const [allUsers, allRuns, classroomRows, inviteRows, assignmentRows] = await Promise.all([
        selectAllUsers(db),
        selectAllRuns(db),
        db.select().from(classrooms),
        db.select().from(inviteCodes),
        db.select().from(assignments).orderBy(desc(assignments.createdAt)),
      ]);
      const leaderboard = buildLeaderboard(allRuns, allUsers);

      return {
        metrics: [
          { label: "演示班级", value: `${classroomRows.length}` },
          { label: "模块总数", value: `${learningModules.length}` },
          { label: "邀请码池", value: `${inviteRows.length}` },
          { label: "活跃学生", value: `${allUsers.filter((item) => item.role === "student").length}` },
        ],
        invites: inviteRows.map(toInvite),
        classrooms: classroomRows.map(toClassroom),
        topUsers: leaderboard.slice(0, 5),
        assignments: assignmentRows.map(toAssignment).slice(0, 4),
      };
    },
    () => store.getAdminOverview(),
  );
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
      const session: AiChatSession = {
        id: createId("ai-session"),
        userId: input.userId,
        guestKey: input.guestKey,
        title: input.title,
        mode: input.mode,
        messages: [],
        updatedAt: new Date().toISOString(),
      };

      await db.insert(aiSessions).values({
        id: session.id,
        userId: input.userId,
        payload: session,
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

export async function appendAiMessage(sessionId: string, userId: string, message: AiChatMessage) {
  return withDb(
    "appendAiMessage",
    async (db) => {
      const session = await getAiSessionByIdWithExecutor(db, sessionId, userId);
      if (!session) {
        throw new Error("未找到对应的 AI 会话。");
      }

      const updated: AiChatSession = {
        ...session,
        messages: [...session.messages, message].slice(-20),
        updatedAt: message.createdAt,
      };

      await db.update(aiSessions).set({ payload: updated }).where(eq(aiSessions.id, sessionId));
      return updated;
    },
    () => store.appendAiMessage(sessionId, userId, message),
  );
}

export async function listAiSessionsForUser(userId: string) {
  return withDb("listAiSessionsForUser", (db) => listAiSessionRows(db, userId).then((items) => items.slice(0, 10)), () =>
    store.listAiSessionsForUser(userId),
  );
}

export async function getAiSessionById(sessionId: string, userId: string) {
  return withDb(
    "getAiSessionById",
    (db) => getAiSessionByIdWithExecutor(db, sessionId, userId),
    () => store.getAiSessionById(sessionId, userId),
  );
}

async function getAiSessionByIdWithExecutor(executor: DbExecutor, sessionId: string, userId: string) {
  const [row] = await executor
    .select()
    .from(aiSessions)
    .where(and(eq(aiSessions.id, sessionId), eq(aiSessions.userId, userId)))
    .limit(1);

  return row ? toAiSession(row) : null;
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB needed; re-export from store)
// ---------------------------------------------------------------------------

export const getQuickDemoCredentials: typeof store.getQuickDemoCredentials = store.getQuickDemoCredentials;
export const roleHomePath: (role: Role) => string = store.roleHomePath;
export const buildTeacherLeaderboardCards: typeof store.buildTeacherLeaderboardCards =
  store.buildTeacherLeaderboardCards;
