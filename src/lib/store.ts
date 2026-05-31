import bcrypt from "bcryptjs";

import { hashPassword, verifyPassword } from "@/lib/password";

import { learningModules } from "@/lib/content";
import {
  advanceSimulationRun,
  applyEventChoice,
  applySimulationAction,
  buildBehaviorSignals,
  buildGrowthReport,
  buildLeaderboard,
  buildSeasonLeaderboard,
  buildSimulationState,
  createInitialRun,
  deriveInvestorPersona,
} from "@/lib/simulation";
import {
  canAddFamilyMember,
  resolveSubscriptionState,
} from "@/lib/billing/subscription";
import type {
  AiChatMessage,
  AiChatMode,
  AiChatSession,
  Assignment,
  Classroom,
  FamilyDigest,
  FamilyMember,
  GrowthReport,
  InviteCode,
  LeaderboardEntry,
  PaymentChannel,
  PaymentOrder,
  PaymentStatus,
  ProfileRecord,
  Role,
  ScenarioRun,
  StudentParentLink,
  SubscriptionGrant,
  SubscriptionTier,
  UserRecord,
} from "@/lib/types";
import { createId } from "@/lib/utils";

type Store = {
  users: UserRecord[];
  profiles: ProfileRecord[];
  classrooms: Classroom[];
  invites: InviteCode[];
  assignments: Assignment[];
  runs: ScenarioRun[];
  parentLinks: StudentParentLink[];
  growthReports: GrowthReport[];
  aiSessions: AiChatSession[];
  paymentOrders: PaymentOrder[];
  subscriptionGrants: SubscriptionGrant[];
  familyMembers: FamilyMember[];
};

declare global {
  var __brownZoneStore__: Store | undefined;
}

function createSeedUsers() {
  const basePassword = bcrypt.hashSync("BrownZone2026!", 10);
  const guestPassword = bcrypt.hashSync("Guest001!!!", 10);
  const superPassword = bcrypt.hashSync("Super001!!!", 10);
  const guestTrialEnd = new Date();
  guestTrialEnd.setDate(guestTrialEnd.getDate() + 3);
  const users = [
    {
      id: "guest-student",
      email: "guest@brownzone.ai",
      passwordHash: guestPassword,
      role: "student" as Role,
      name: "游客体验",
      title: "限时试玩学生",
      classroomId: "class-1",
    },
    {
      id: "teacher-1",
      email: "teacher@brownzone.ai",
      passwordHash: basePassword,
      role: "teacher" as Role,
      name: "秦老师",
      title: "AP 经济学指导老师",
      classroomId: "class-1",
    },
    {
      id: "student-1",
      email: "student@brownzone.ai",
      passwordHash: basePassword,
      role: "student" as Role,
      name: "林知夏",
      title: "高一 · 树德实验试点生",
      classroomId: "class-1",
    },
    {
      id: "student-2",
      email: "student2@brownzone.ai",
      passwordHash: basePassword,
      role: "student" as Role,
      name: "周明远",
      title: "高一 · 模拟联赛成员",
      classroomId: "class-1",
    },
    {
      id: "student-3",
      email: "student3@brownzone.ai",
      passwordHash: basePassword,
      role: "student" as Role,
      name: "沈若岚",
      title: "高一 · 家校共育试点生",
      classroomId: "class-1",
    },
    {
      id: "parent-1",
      email: "parent@brownzone.ai",
      passwordHash: basePassword,
      role: "parent" as Role,
      name: "林女士",
      title: "家长观察端",
      studentLinkId: "bond-1",
    },
    {
      id: "admin-1",
      email: "admin@brownzone.ai",
      passwordHash: basePassword,
      role: "admin" as Role,
      name: "幕后之手运营台",
      title: "Demo 管理员",
    },
    {
      id: "superadmin",
      email: "superadmin",
      passwordHash: superPassword,
      role: "admin" as Role,
      name: "超级管理员",
      title: "账号与权限总控",
    },
  ] satisfies UserRecord[];

  return users.map((user) => {
    if (user.id === "guest-student") {
      return {
        ...user,
        trialExpiresAt: guestTrialEnd.toISOString(),
        subscriptionTier: "free" as const,
        onboardingCompleted: 0,
      };
    }

    return {
      ...user,
      subscriptionTier: "standard" as const,
      onboardingCompleted: 1,
    };
  }) satisfies UserRecord[];
}

function createSeedProfiles() {
  return [
    {
      userId: "guest-student",
      headline: "游客试玩账号，仅用于快速体验学生端流程。",
      bio: "完成限定次数体验后，引导使用者注册或登录正式账号，避免多人长期共用同一进度。",
      metrics: [
        { label: "体验模式", value: "限时试玩" },
        { label: "建议下一步", value: "注册/登录" },
      ],
    },
    {
      userId: "teacher-1",
      headline: "把课堂作业变成带反馈的模拟挑战赛。",
      bio: "负责试点班级任务脚本、课堂节奏与学生复盘组织。",
      metrics: [
        { label: "班级规模", value: "36 人" },
        { label: "当前主题", value: "宏观冲击周" },
      ],
    },
    {
      userId: "student-1",
      headline: "偏成长风格，最近在练仓位管理和现金缓冲。",
      bio: "对科技和创业模块兴趣较高，正在修正过度追热点的习惯。",
      metrics: [
        { label: "当前排名", value: "班级第 2" },
        { label: "完成回合", value: "6 / 12" },
      ],
    },
    {
      userId: "student-2",
      headline: "更偏防守型，擅长 ETF 与债券组合。",
      bio: "在榜单上稳定靠前，近期需要补足创业与经营视角。",
      metrics: [
        { label: "当前排名", value: "班级第 1" },
        { label: "完成回合", value: "7 / 12" },
      ],
    },
    {
      userId: "student-3",
      headline: "风险偏好较高，但愿意复盘和记录策略假设。",
      bio: "家长端已绑定，正在观察情绪交易与计划执行之间的关系。",
      metrics: [
        { label: "当前排名", value: "班级第 3" },
        { label: "完成回合", value: "5 / 12" },
      ],
    },
    {
      userId: "parent-1",
      headline: "重点关注孩子的复盘习惯与风险控制。",
      bio: "通过成长报告理解孩子面对不确定性时的决策方式，而不是只看分数。",
      metrics: [
        { label: "绑定学生", value: "林知夏" },
        { label: "最近更新", value: "今天" },
      ],
    },
    {
      userId: "admin-1",
      headline: "统一查看邀请码、模块内容与示范班级活跃度。",
      bio: "用于预览演示环境中的整体运营情况与 AI 使用频率。",
      metrics: [
        { label: "活跃班级", value: "1 个" },
        { label: "内容模块", value: `${learningModules.length} 个` },
      ],
    },
    {
      userId: "superadmin",
      headline: "拥有后台账号管理与密码重置权限。",
      bio: "用于教师电脑或线上演示环境的最高权限维护，不参与学生沙盘排名。",
      metrics: [
        { label: "权限级别", value: "超级管理员" },
        { label: "账号", value: "superadmin" },
      ],
    },
  ] satisfies ProfileRecord[];
}

function seedRuns() {
  const guest = createInitialRun("guest-student", "class-1");
  const first = createInitialRun("student-1", "class-1");
  const second = createInitialRun("student-2", "class-1");
  const third = createInitialRun("student-3", "class-1");

  let studentOne = applySimulationAction(first, {
    type: "trade",
    assetId: "asset-etf",
    side: "buy",
    quantity: 120,
    orderMode: "market",
  });
  studentOne = applySimulationAction(studentOne, {
    type: "bank",
    action: "deposit",
    amount: 12_000,
  });
  studentOne = advanceSimulationRun(studentOne);
  studentOne = applySimulationAction(studentOne, {
    type: "trade",
    assetId: "asset-bond",
    side: "buy",
    quantity: 80,
    orderMode: "limit",
  });
  studentOne = advanceSimulationRun(studentOne);
  studentOne = applySimulationAction(studentOne, {
    type: "venture",
    action: "invest",
    amount: 8_000,
  });
  studentOne = advanceSimulationRun(studentOne);
  studentOne = applySimulationAction(studentOne, {
    type: "property",
    action: "buy",
  });
  studentOne = advanceSimulationRun(studentOne);
  studentOne = advanceSimulationRun(studentOne);

  let studentTwo = applySimulationAction(second, {
    type: "trade",
    assetId: "asset-etf",
    side: "buy",
    quantity: 160,
    orderMode: "market",
  });
  studentTwo = applySimulationAction(studentTwo, {
    type: "trade",
    assetId: "asset-bond",
    side: "buy",
    quantity: 100,
    orderMode: "market",
  });
  studentTwo = advanceSimulationRun(studentTwo);
  studentTwo = applySimulationAction(studentTwo, {
    type: "bank",
    action: "deposit",
    amount: 18_000,
  });
  studentTwo = advanceSimulationRun(studentTwo);
  studentTwo = applySimulationAction(studentTwo, {
    type: "trade",
    assetId: "asset-fx",
    side: "buy",
    quantity: 70,
    orderMode: "limit",
  });
  studentTwo = advanceSimulationRun(studentTwo);
  studentTwo = advanceSimulationRun(studentTwo);
  studentTwo = advanceSimulationRun(studentTwo);
  studentTwo = advanceSimulationRun(studentTwo);

  let studentThree = applySimulationAction(third, {
    type: "trade",
    assetId: "asset-stock",
    side: "buy",
    quantity: 140,
    orderMode: "market",
  });
  studentThree = advanceSimulationRun(studentThree);
  studentThree = applySimulationAction(studentThree, {
    type: "bank",
    action: "loan",
    amount: 20_000,
  });
  studentThree = applySimulationAction(studentThree, {
    type: "venture",
    action: "invest",
    amount: 10_000,
  });
  studentThree = advanceSimulationRun(studentThree);
  studentThree = applySimulationAction(studentThree, {
    type: "trade",
    assetId: "asset-stock",
    side: "sell",
    quantity: 20,
    orderMode: "market",
  });
  studentThree = advanceSimulationRun(studentThree);
  studentThree = advanceSimulationRun(studentThree);

  return [guest, studentOne, studentTwo, studentThree];
}

export function createSeedStore(): Store {
  const users = createSeedUsers();
  const runs = seedRuns();

  return {
    users,
    profiles: createSeedProfiles(),
    classrooms: [
      {
        id: "class-1",
        name: "树德实验 · AP经济沙盘试点班",
        region: "成都",
        teacherId: "teacher-1",
        challengeTheme: "黑天鹅事件与资产再平衡",
        schoolRank: 3,
      },
    ],
    invites: [
      {
        id: "invite-1",
        code: "MRB-STUDENT-2026",
        role: "student",
        classroomId: "class-1",
        label: "试点学生邀请码",
        createdBy: "teacher-1",
        usesRemaining: 18,
        expiresAt: "2026-06-30T23:59:59.000Z",
      },
      {
        id: "invite-2",
        code: "MRB-PARENT-2026",
        role: "parent",
        studentLinkId: "bond-1",
        label: "家长绑定邀请码",
        createdBy: "teacher-1",
        usesRemaining: 3,
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
    ],
    assignments: [
      {
        id: "assignment-1",
        classroomId: "class-1",
        title: "第 6 周策略作业：面对流动性回暖如何再平衡",
        brief: "在保持 20% 以上现金缓冲的前提下，把组合做成“防守 + 进攻”双轴结构，并写下复盘结论。",
        difficulty: "策略",
        dueLabel: "本周五 18:00",
        createdBy: "teacher-1",
        createdAt: "2026-04-14T08:00:00.000Z",
      },
      {
        id: "assignment-2",
        classroomId: "class-1",
        title: "挑战赛热身：黑天鹅事件卡应对",
        brief: "假设舆情急转直下，请在 2 个操作内稳定组合回撤，并说明为什么这么做。",
        difficulty: "联赛",
        dueLabel: "下周一 12:00",
        createdBy: "teacher-1",
        createdAt: "2026-04-13T08:00:00.000Z",
      },
    ],
    runs,
    parentLinks: [
      {
        id: "bond-1",
        studentUserId: "student-1",
        parentUserId: "parent-1",
        bondCode: "BOND-LIN-2026",
      },
    ],
    growthReports: [buildGrowthReport(runs[0], "student-1", "parent-1")],
    aiSessions: [],
    paymentOrders: [],
    subscriptionGrants: [],
    familyMembers: [],
  };
}

export function getStore() {
  if (!globalThis.__brownZoneStore__) {
    globalThis.__brownZoneStore__ = createSeedStore();
  }

  if (!globalThis.__brownZoneStore__.aiSessions) {
    globalThis.__brownZoneStore__.aiSessions = [];
  }
  if (!globalThis.__brownZoneStore__.paymentOrders) {
    globalThis.__brownZoneStore__.paymentOrders = [];
  }
  if (!globalThis.__brownZoneStore__.subscriptionGrants) {
    globalThis.__brownZoneStore__.subscriptionGrants = [];
  }

  return globalThis.__brownZoneStore__;
}

export function resetStoreForTests() {
  globalThis.__brownZoneStore__ = createSeedStore();
  return globalThis.__brownZoneStore__;
}

export function findUserByEmail(email: string) {
  return getStore().users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function findUserById(id: string) {
  return getStore().users.find((user) => user.id === id) ?? null;
}

export function bumpTokenVersion(userId: string) {
  const user = getStore().users.find((candidate) => candidate.id === userId);
  if (!user) return 0;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  return user.tokenVersion;
}

export function markEmailVerified(userId: string) {
  const user = getStore().users.find((candidate) => candidate.id === userId);
  if (!user) return false;
  user.emailVerifiedAt = new Date().toISOString();
  return true;
}

function isOwnerPremiumActive(owner: UserRecord) {
  const state = resolveSubscriptionState(
    owner.subscriptionTier,
    owner.trialExpiresAt,
    owner.subscriptionExpiresAt,
  );
  return state.status === "active" && owner.subscriptionTier === "premium"
    ? state
    : null;
}

export function findFamilyOwnerForStudent(studentUserId: string): string | null {
  return getStore().familyMembers.find((m) => m.studentUserId === studentUserId)?.ownerUserId ?? null;
}

export function listFamilyMembers(ownerUserId: string) {
  return getStore()
    .familyMembers.filter((m) => m.ownerUserId === ownerUserId)
    .map((m) => {
      const student = findUserById(m.studentUserId);
      return { ...m, studentName: student?.name ?? "", studentEmail: student?.email ?? "" };
    });
}

export function addFamilyMember(ownerUserId: string, studentUserId: string): FamilyMember {
  const store = getStore();
  const owner = findUserById(ownerUserId);
  const student = findUserById(studentUserId);
  if (!owner || !student) throw new Error("用户不存在。");
  if (student.role !== "student") throw new Error("只能把学生加入家庭组。");

  const ownerState = isOwnerPremiumActive(owner);
  if (!ownerState) throw new Error("只有高级版家长才能创建家庭组。");
  if (!canUserPayForTarget(ownerUserId, studentUserId)) {
    throw new Error("你没有权限把该学生加入家庭组（需先与孩子绑定）。");
  }
  if (store.familyMembers.some((m) => m.studentUserId === studentUserId)) {
    throw new Error("该学生已在一个家庭组中。");
  }
  const currentCount = store.familyMembers.filter((m) => m.ownerUserId === ownerUserId).length;
  if (!canAddFamilyMember(currentCount, ownerState.features.maxStudents)) {
    throw new Error(`家庭名额已满（上限 ${ownerState.features.maxStudents} 名）。`);
  }

  const member: FamilyMember = {
    id: createId("fam"),
    ownerUserId,
    studentUserId,
    createdAt: new Date().toISOString(),
  };
  store.familyMembers.push(member);
  return member;
}

export function removeFamilyMember(ownerUserId: string, studentUserId: string): boolean {
  const store = getStore();
  const before = store.familyMembers.length;
  store.familyMembers = store.familyMembers.filter(
    (m) => !(m.ownerUserId === ownerUserId && m.studentUserId === studentUserId),
  );
  return store.familyMembers.length < before;
}

/** Upgrade a student to Premium while their family owner's subscription is active. */
export function applyFamilyEntitlement(user: UserRecord): UserRecord {
  if (user.role !== "student") return user;
  const ownerId = findFamilyOwnerForStudent(user.id);
  if (!ownerId) return user;
  const owner = findUserById(ownerId);
  if (!owner || !isOwnerPremiumActive(owner)) return user;
  return {
    ...user,
    subscriptionTier: "premium",
    subscriptionExpiresAt: owner.subscriptionExpiresAt,
  };
}

/** Global weekly season leaderboard across all runs that used this week's seed. */
export function getSeasonLeaderboard() {
  const store = getStore();
  return buildSeasonLeaderboard(store.runs, store.users);
}

/** Weekly digests for the Premium family report email cron. */
export function listPremiumFamilyDigests(): FamilyDigest[] {
  const store = getStore();
  const digests: FamilyDigest[] = [];
  for (const member of store.familyMembers) {
    const owner = findUserById(member.ownerUserId);
    if (!owner || !isOwnerPremiumActive(owner)) continue;
    const student = findUserById(member.studentUserId);
    const run = store.runs.find((item) => item.userId === member.studentUserId);
    if (!student || !run) continue;
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
}

export async function updateUserPassword(userId: string, password: string) {
  const user = getStore().users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("用户不存在。");
  user.passwordHash = await hashPassword(password);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  return user;
}

export async function updateUserEmail(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = getStore().users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("用户不存在。");

  const duplicate = getStore().users.find(
    (candidate) =>
      candidate.id !== userId && candidate.email.toLowerCase() === normalizedEmail,
  );
  if (duplicate) throw new Error("这个邮箱已经被注册过了。");

  user.email = normalizedEmail;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  return user;
}

function getDefaultClassroomId() {
  const store = getStore();
  return store.classrooms[0]?.id ?? "class-1";
}

function ensureScenarioRunForUser(user: UserRecord) {
  const store = getStore();
  if (user.role !== "student") return;
  const classroomId = user.classroomId ?? getDefaultClassroomId();
  user.classroomId = classroomId;
  const hasRun = store.runs.some((run) => run.userId === user.id);
  if (!hasRun) {
    store.runs.push(createInitialRun(user.id, classroomId));
  }
}

function adminUserSummary(user: UserRecord) {
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

export async function listAdminUsers(filters: {
  query?: string;
  role?: Role | "all";
  subscription?: SubscriptionTier | "trial" | "all";
} = {}) {
  const query = filters.query?.trim().toLowerCase();
  const now = Date.now();
  return getStore()
    .users.filter((user) => {
      const matchesQuery =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.title.toLowerCase().includes(query);
      const matchesRole = !filters.role || filters.role === "all" || user.role === filters.role;
      const tier = user.subscriptionTier ?? "free";
      const inTrial =
        user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() > now && tier === "free";
      const matchesSubscription =
        !filters.subscription ||
        filters.subscription === "all" ||
        (filters.subscription === "trial" ? inTrial : tier === filters.subscription);
      return matchesQuery && matchesRole && matchesSubscription;
    })
    .map(adminUserSummary);
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
  const store = getStore();
  const normalizedEmail = input.email.trim().toLowerCase();
  if (findUserByEmail(normalizedEmail)) {
    throw new Error("这个邮箱已经注册过了。");
  }

  const now = new Date();
  const trialExpiresAt =
    typeof input.trialDays === "number" && input.trialDays > 0
      ? new Date(now.getTime() + input.trialDays * 86_400_000).toISOString()
      : undefined;
  const subscriptionTier = input.subscriptionTier ?? "free";
  const subscriptionExpiresAt =
    subscriptionTier !== "free" && typeof input.subscriptionDays === "number" && input.subscriptionDays > 0
      ? new Date(now.getTime() + input.subscriptionDays * 86_400_000).toISOString()
      : undefined;

  const user: UserRecord = {
    id: createId("user"),
    email: normalizedEmail,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    name: input.name.trim(),
    title: input.title?.trim() || (input.role === "admin" ? "运营管理员" : input.role === "teacher" ? "教师账号" : input.role === "parent" ? "家长账号" : "沙盘体验用户"),
    classroomId: input.role === "student" || input.role === "teacher" ? getDefaultClassroomId() : undefined,
    tokenVersion: 0,
    trialExpiresAt,
    subscriptionTier,
    subscriptionExpiresAt,
    onboardingCompleted: input.role === "student" ? 0 : 1,
  };

  store.users.push(user);
  store.profiles.push({
    userId: user.id,
    headline: "由超级管理员创建的 Brown Zone 账号。",
    bio: "该账号可按角色进入对应工作台，权限与试用状态由后台统一管理。",
    metrics: [
      { label: "角色", value: user.role },
      { label: "创建方式", value: "超级管理员创建" },
    ],
  });
  ensureScenarioRunForUser(user);
  return adminUserSummary(user);
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
  const store = getStore();
  const user = store.users.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("用户不存在。");

  if (input.name !== undefined) user.name = input.name.trim();
  if (input.title !== undefined) user.title = input.title.trim();
  if (input.role !== undefined) {
    user.role = input.role;
    if ((input.role === "student" || input.role === "teacher") && !user.classroomId) {
      user.classroomId = getDefaultClassroomId();
    }
  }

  if (input.trialDays !== undefined) {
    user.trialExpiresAt =
      input.trialDays && input.trialDays > 0
        ? new Date(Date.now() + input.trialDays * 86_400_000).toISOString()
        : undefined;
  }

  if (input.subscriptionTier !== undefined) {
    user.subscriptionTier = input.subscriptionTier;
    if (input.subscriptionTier === "free") {
      user.subscriptionExpiresAt = undefined;
    }
  }

  if (input.subscriptionDays !== undefined) {
    user.subscriptionExpiresAt =
      input.subscriptionDays && input.subscriptionDays > 0
        ? new Date(Date.now() + input.subscriptionDays * 86_400_000).toISOString()
        : undefined;
    if (input.subscriptionDays && input.subscriptionDays > 0 && (!user.subscriptionTier || user.subscriptionTier === "free")) {
      user.subscriptionTier = "standard";
    }
  }

  if (input.onboardingCompleted !== undefined) {
    user.onboardingCompleted = input.onboardingCompleted ? 1 : 0;
  }

  const profile = store.profiles.find((candidate) => candidate.userId === userId);
  if (profile) {
    profile.headline = `${user.name} 的 Brown Zone 账号`;
  }
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  ensureScenarioRunForUser(user);
  return adminUserSummary(user);
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
  const now = new Date().toISOString();
  const order: PaymentOrder = {
    id: createId("pay"),
    outTradeNo: input.outTradeNo,
    userId: input.userId,
    targetUserId: input.targetUserId,
    tier: input.tier,
    channel: input.channel,
    amountFen: input.amountFen,
    description: input.description,
    status: "pending",
    codeUrl: input.codeUrl,
    prepayId: input.prepayId,
    expiresAt: input.expiresAt.toISOString(),
    createdAt: now,
    updatedAt: now,
  };
  getStore().paymentOrders.push(order);
  return order;
}

export async function updatePaymentOrderProviderFields(
  outTradeNo: string,
  fields: { codeUrl?: string; prepayId?: string },
) {
  const order = getStore().paymentOrders.find((candidate) => candidate.outTradeNo === outTradeNo);
  if (!order) throw new Error("支付订单不存在。");
  order.codeUrl = fields.codeUrl ?? order.codeUrl;
  order.prepayId = fields.prepayId ?? order.prepayId;
  order.updatedAt = new Date().toISOString();
  return order;
}

export async function getPaymentOrderByOutTradeNo(outTradeNo: string) {
  return getStore().paymentOrders.find((order) => order.outTradeNo === outTradeNo) ?? null;
}

export async function fulfillPaymentOrder(input: {
  outTradeNo: string;
  transactionId: string;
  paidAt?: string;
  rawNotify?: unknown;
}) {
  const store = getStore();
  const order = store.paymentOrders.find((candidate) => candidate.outTradeNo === input.outTradeNo);
  if (!order) throw new Error("支付订单不存在。");

  if (order.status === "paid") {
    return {
      order,
      grant:
        store.subscriptionGrants.find((grant) => grant.orderId === order.id) ??
        null,
      alreadyFulfilled: true,
    };
  }

  const user = store.users.find((candidate) => candidate.id === order.targetUserId);
  if (!user) throw new Error("订阅目标账号不存在。");

  const now = input.paidAt ? new Date(input.paidAt) : new Date();
  const currentExpiry = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt)
    : now;
  const startsAt = currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const expiresAt = new Date(startsAt);
  expiresAt.setDate(expiresAt.getDate() + 30);

  order.status = "paid";
  order.transactionId = input.transactionId;
  order.paidAt = now.toISOString();
  order.updatedAt = now.toISOString();

  user.subscriptionTier = order.tier;
  user.subscriptionExpiresAt = expiresAt.toISOString();
  // Do NOT bump tokenVersion on fulfillment — see repo.ts: tier is read fresh per
  // request, and bumping kills the payer's own session on family self-purchase.

  const grant: SubscriptionGrant = {
    id: createId("grant"),
    userId: user.id,
    orderId: order.id,
    tier: order.tier,
    startsAt: startsAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };
  store.subscriptionGrants.push(grant);

  return { order, grant, alreadyFulfilled: false };
}

export async function markPaymentOrderStatus(
  outTradeNo: string,
  status: Exclude<PaymentStatus, "pending" | "paid">,
) {
  const order = getStore().paymentOrders.find((candidate) => candidate.outTradeNo === outTradeNo);
  if (!order) throw new Error("支付订单不存在。");
  order.status = status;
  order.updatedAt = new Date().toISOString();
  return order;
}

export function findProfileByUserId(userId: string) {
  return getStore().profiles.find((profile) => profile.userId === userId) ?? null;
}

export function findInviteByCode(code: string) {
  return getStore().invites.find((invite) => invite.code.toUpperCase() === code.toUpperCase()) ?? null;
}

export function validateInviteCode(code: string) {
  const invite = findInviteByCode(code);
  if (!invite) return { valid: false, reason: "邀请码不存在。" };
  if (invite.usesRemaining <= 0) return { valid: false, reason: "邀请码已达到使用上限。" };
  if (new Date(invite.expiresAt).getTime() < Date.now()) return { valid: false, reason: "邀请码已过期。" };
  return { valid: true, invite };
}

export async function authenticateUser(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const matched = await verifyPassword(password, user.passwordHash);
  return matched ? user : null;
}

export async function registerUserByInvite(input: {
  inviteCode: string;
  name: string;
  email: string;
  password: string;
}) {
  const store = getStore();
  const inviteStatus = validateInviteCode(input.inviteCode);

  if (!inviteStatus.valid || !inviteStatus.invite) {
    throw new Error(inviteStatus.reason ?? "邀请码无效。");
  }

  const normalizedEmail = input.email.trim().toLowerCase();

  if (findUserByEmail(normalizedEmail)) {
    throw new Error("这个邮箱已经被注册过了。");
  }

  const newUser: UserRecord = {
    id: createId("user"),
    email: normalizedEmail,
    passwordHash: await hashPassword(input.password),
    role: inviteStatus.invite.role,
    name: input.name,
    title:
      inviteStatus.invite.role === "student"
        ? "新加入的试点学生"
        : inviteStatus.invite.role === "teacher"
          ? "新加入的教师账号"
          : inviteStatus.invite.role === "parent"
            ? "新绑定的家长账号"
            : "新加入的管理员",
    classroomId: inviteStatus.invite.classroomId,
    studentLinkId: inviteStatus.invite.studentLinkId,
  };

  store.users.push(newUser);
  store.profiles.push({
    userId: newUser.id,
    headline: "刚刚加入 Brown Zone 试点环境。",
    bio: "欢迎来到示范环境，建议先从 Demo 入口体验完整路径。",
    metrics: [
      { label: "角色", value: newUser.role },
      { label: "加入方式", value: "邀请码" },
    ],
  });

  if (newUser.role === "student" && newUser.classroomId) {
    store.runs.push(createInitialRun(newUser.id, newUser.classroomId));
  }

  if (newUser.role === "parent" && inviteStatus.invite.studentLinkId) {
    const studentLink = store.parentLinks.find((item) => item.id === inviteStatus.invite.studentLinkId);
    if (studentLink) {
      studentLink.parentUserId = newUser.id;
      store.growthReports = store.growthReports.filter((report) => report.parentUserId !== newUser.id);
      const linkedRun = store.runs.find((run) => run.userId === studentLink.studentUserId);
      if (linkedRun) {
        store.growthReports.push(buildGrowthReport(linkedRun, studentLink.studentUserId, newUser.id));
      }
    }
  }

  inviteStatus.invite.usesRemaining -= 1;
  return newUser;
}

export async function registerUserByEmail(input: {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
}) {
  const store = getStore();

  const normalizedEmail = input.email.trim().toLowerCase();

  if (findUserByEmail(normalizedEmail)) {
    throw new Error("这个邮箱已经被注册过了。");
  }

  let role: UserRecord["role"] = "student";
  let classroomId: string | undefined;

  if (input.inviteCode) {
    const inviteStatus = validateInviteCode(input.inviteCode);
    if (inviteStatus.valid && inviteStatus.invite) {
      role = inviteStatus.invite.role;
      classroomId = inviteStatus.invite.classroomId;
      inviteStatus.invite.usesRemaining -= 1;
    } else {
      throw new Error("邀请码无效、已过期或已用完。如不需要邀请码，请留空后重试。");
    }
  }

  if (!classroomId && store.classrooms.length > 0) {
    classroomId = store.classrooms[0].id;
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 3);

  const newUser: UserRecord = {
    id: createId("user"),
    email: normalizedEmail,
    passwordHash: await hashPassword(input.password),
    role,
    name: input.name,
    title: "沙盘新玩家",
    classroomId,
    trialExpiresAt: trialEnd.toISOString(),
    subscriptionTier: "free",
    subscriptionExpiresAt: undefined,
    onboardingCompleted: 0,
  };

  store.users.push(newUser);
  store.profiles.push({
    userId: newUser.id,
    headline: "刚刚注册，准备开始 Mr.Brown 经济沙盘之旅。",
    bio: "新用户，享受试用期。",
    metrics: [
      { label: "角色", value: newUser.role },
      { label: "加入方式", value: "邮箱注册" },
    ],
  });

  if (newUser.role === "student" && newUser.classroomId) {
    store.runs.push(createInitialRun(newUser.id, newUser.classroomId));
  }

  return newUser;
}

export function getClassroomById(classroomId?: string) {
  return getStore().classrooms.find((classroom) => classroom.id === classroomId) ?? null;
}

export function getRunForUser(userId: string) {
  return getStore().runs.find((run) => run.userId === userId) ?? null;
}

export function getSimulationStateForUser(userId: string) {
  const store = getStore();
  const user = findUserById(userId);
  if (!user || user.role !== "student" || !user.classroomId) {
    throw new Error("当前账号没有可用的学生沙盘。");
  }

  const classroom = getClassroomById(user.classroomId);
  const run = getRunForUser(userId);
  if (!classroom || !run) {
    throw new Error("未找到对应的班级或沙盘进度。");
  }

  const relatedRuns = store.runs.filter((item) => item.classroomId === user.classroomId);
  const relatedUsers = store.users.filter((item) => item.classroomId === user.classroomId);
  return buildSimulationState(user, classroom, run, relatedRuns, relatedUsers);
}

export function applyActionForUser(userId: string, input: Parameters<typeof applySimulationAction>[1]) {
  const store = getStore();
  const run = getRunForUser(userId);
  if (!run) {
    throw new Error("未找到对应的学生沙盘。");
  }

  const updated = applySimulationAction(run, input);
  const index = store.runs.findIndex((item) => item.id === updated.id);
  store.runs[index] = updated;
  syncGrowthReports(userId);
  return updated;
}

export function applyEventChoiceForUser(userId: string, choiceId: string) {
  const store = getStore();
  const run = getRunForUser(userId);
  if (!run) {
    throw new Error("未找到对应的学生沙盘。");
  }

  const updated = applyEventChoice(run, choiceId);
  const index = store.runs.findIndex((item) => item.id === updated.id);
  store.runs[index] = updated;
  syncGrowthReports(userId);
  return updated;
}

export function replayRunForUser(userId: string) {
  const store = getStore();
  const run = getRunForUser(userId);
  if (!run) {
    throw new Error("未找到对应的学生沙盘。");
  }

  const fresh = createInitialRun(
    userId,
    run.classroomId,
    run.scenarioName,
    (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1,
  );
  fresh.id = run.id;
  const index = store.runs.findIndex((item) => item.id === run.id);
  store.runs[index] = fresh;
  syncGrowthReports(userId);
  return fresh;
}

export function advanceRunForUser(userId: string) {
  const store = getStore();
  const run = getRunForUser(userId);
  if (!run) {
    throw new Error("未找到对应的学生沙盘。");
  }

  const updated = advanceSimulationRun(run);
  const index = store.runs.findIndex((item) => item.id === updated.id);
  store.runs[index] = updated;
  syncGrowthReports(userId);
  return updated;
}

function syncGrowthReports(studentUserId: string) {
  const store = getStore();
  const link = store.parentLinks.find((item) => item.studentUserId === studentUserId);
  const run = getRunForUser(studentUserId);
  if (!link || !run) return;
  store.growthReports = store.growthReports.filter((item) => item.studentUserId !== studentUserId);
  store.growthReports.push(buildGrowthReport(run, studentUserId, link.parentUserId));
}

export function createAssignmentForTeacher(
  teacherId: string,
  input: Pick<Assignment, "title" | "brief" | "difficulty" | "dueLabel">,
) {
  const store = getStore();
  const teacher = findUserById(teacherId);
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

  store.assignments.unshift(assignment);
  return assignment;
}

export function getTeacherOverview(userId: string) {
  const store = getStore();
  const teacher = findUserById(userId);
  if (!teacher?.classroomId) {
    throw new Error("当前账号没有教师权限或未绑定班级。");
  }

  const classroom = getClassroomById(teacher.classroomId);
  if (!classroom) throw new Error("班级不存在。");

  const studentUsers = store.users.filter((user) => user.role === "student" && user.classroomId === classroom.id);
  const runs = store.runs.filter((run) => run.classroomId === classroom.id);
  const leaderboard = buildLeaderboard(runs, store.users).filter((entry) => entry.classroomId === classroom.id);

  return {
    teacher,
    classroom,
    assignments: store.assignments.filter((assignment) => assignment.classroomId === classroom.id),
    invites: store.invites.filter(
      (invite) => invite.classroomId === classroom.id || invite.createdBy === teacher.id,
    ),
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
}

export function getParentOverview(userId: string) {
  const store = getStore();
  const parent = findUserById(userId);
  const link = store.parentLinks.find((item) => item.parentUserId === parent?.id);
  if (!parent || !link) {
    throw new Error("当前账号还没有绑定学生。");
  }

  const student = findUserById(link.studentUserId);
  const report = store.growthReports.find((item) => item.parentUserId === userId);
  const run = getRunForUser(link.studentUserId);
  if (!student || !report || !run) {
    throw new Error("成长报告数据暂不可用。");
  }

  return {
    parent,
    student,
    report,
    run,
  };
}

function isSuperAdminUser(user?: UserRecord | null) {
  return user?.id === "superadmin" || user?.email.toLowerCase() === "superadmin";
}

export function canUserPayForTarget(payerId: string, targetUserId: string) {
  const store = getStore();
  const payer = findUserById(payerId);
  const target = findUserById(targetUserId);
  if (!payer || !target) return false;

  if (payer.id === target.id) {
    return payer.role !== "student";
  }

  if (isSuperAdminUser(payer)) return true;

  if (payer.role === "teacher") {
    return target.role === "student" && Boolean(payer.classroomId) && target.classroomId === payer.classroomId;
  }

  if (payer.role === "parent") {
    return store.parentLinks.some(
      (link) => link.parentUserId === payer.id && link.studentUserId === target.id,
    );
  }

  return false;
}

export function listSubscriptionTargetsForUser(userId: string) {
  const store = getStore();
  const payer = findUserById(userId);
  if (!payer) return [];

  let targets: UserRecord[] = [];
  if (isSuperAdminUser(payer)) {
    targets = store.users.filter((user) => user.role === "student");
  } else if (payer.role === "teacher" && payer.classroomId) {
    targets = store.users.filter(
      (user) => user.role === "student" && user.classroomId === payer.classroomId,
    );
  } else if (payer.role === "parent") {
    const studentIds = new Set(
      store.parentLinks
        .filter((link) => link.parentUserId === payer.id)
        .map((link) => link.studentUserId),
    );
    targets = store.users.filter((user) => studentIds.has(user.id));
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
}

export function getAdminOverview() {
  const store = getStore();
  const leaderboard = buildLeaderboard(store.runs, store.users);
  const now = Date.now();
  const standardUsers = store.users.filter((user) => user.subscriptionTier === "standard" || user.subscriptionTier === "premium");
  const trialUsers = store.users.filter(
    (user) => user.subscriptionTier === "free" && user.trialExpiresAt && new Date(user.trialExpiresAt).getTime() > now,
  );
  const paidOrders = store.paymentOrders.filter((order) => order.status === "paid");
  return {
    metrics: [
      { label: "账号席位", value: `${store.users.length}` },
      { label: "试用中", value: `${trialUsers.length}` },
      { label: "标准订阅", value: `${standardUsers.length}` },
      { label: "已支付订单", value: `${paidOrders.length}` },
    ],
    business: {
      seats: store.users.length,
      trialUsers: trialUsers.length,
      standardUsers: standardUsers.length,
      schoolLicenses: store.classrooms.length,
      paidOrders: paidOrders.length,
      pendingOrders: store.paymentOrders.filter((order) => order.status === "pending").length,
      revenueFen: paidOrders.reduce((sum, order) => sum + order.amountFen, 0),
      modules: learningModules.length,
    },
    invites: store.invites,
    classrooms: store.classrooms,
    topUsers: leaderboard.slice(0, 5),
    assignments: store.assignments.slice(0, 4),
    users: store.users.map(adminUserSummary),
  };
}

export function getLeaderboardSnapshot(scope: "classroom" | "school" = "classroom") {
  const store = getStore();
  const leaderboard = buildLeaderboard(store.runs, store.users);

  if (scope === "school") {
    return leaderboard;
  }

  return leaderboard.filter((item) => item.classroomId === "class-1");
}

export function createAiSession(input: {
  userId: string;
  mode: AiChatMode;
  title: string;
  guestKey?: string;
}) {
  const store = getStore();
  const session: AiChatSession = {
    id: createId("ai-session"),
    userId: input.userId,
    guestKey: input.guestKey,
    title: input.title,
    mode: input.mode,
    messages: [],
    updatedAt: new Date().toISOString(),
  };

  store.aiSessions.unshift(session);
  const perUserCount = new Map<string, number>();
  store.aiSessions = store.aiSessions
    .sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt))
    .filter((candidate) => {
      if (!candidate.userId) return true;
      const nextCount = (perUserCount.get(candidate.userId) ?? 0) + 1;
      perUserCount.set(candidate.userId, nextCount);
      return nextCount <= 10;
    });

  return session;
}

export function appendAiMessage(sessionId: string, userId: string, message: AiChatMessage) {
  const store = getStore();
  const session = store.aiSessions.find((candidate) => candidate.id === sessionId && candidate.userId === userId);
  if (!session) {
    throw new Error("未找到对应的 AI 会话。");
  }

  session.messages = [...session.messages, message].slice(-20);
  session.updatedAt = message.createdAt;
  store.aiSessions = store.aiSessions.sort(
    (left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt),
  );

  return session;
}

export function listAiSessionsForUser(userId: string) {
  return getStore()
    .aiSessions.filter((session) => session.userId === userId)
    .sort((left, right) => +new Date(right.updatedAt) - +new Date(left.updatedAt))
    .slice(0, 10);
}

export function getAiSessionById(sessionId: string, userId: string) {
  return getStore().aiSessions.find((session) => session.id === sessionId && session.userId === userId) ?? null;
}

export function getQuickDemoCredentials() {
  return [
    { label: "游客试玩", email: "guest@brownzone.ai", password: "Guest001!!!", trial: true },
    { label: "学生端", email: "student@brownzone.ai", password: "BrownZone2026!" },
    { label: "教师端", email: "teacher@brownzone.ai", password: "BrownZone2026!" },
    { label: "家长端", email: "parent@brownzone.ai", password: "BrownZone2026!" },
    { label: "管理端", email: "admin@brownzone.ai", password: "BrownZone2026!" },
  ];
}

export function roleHomePath(role: Role) {
  switch (role) {
    case "student":
      return "/student";
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "admin":
      return "/admin";
  }
}

export function buildTeacherLeaderboardCards(entries: LeaderboardEntry[]) {
  return entries.slice(0, 3).map((entry) => ({
    ...entry,
    headline:
      entry.rank === 1 ? "本周策略最稳" : entry.rank === 2 ? "成长速度最快" : "最值得复盘",
  }));
}
