import bcrypt from "bcryptjs";

import { learningModules } from "@/lib/content";
import {
  advanceSimulationRun,
  applySimulationAction,
  buildBehaviorSignals,
  buildGrowthReport,
  buildLeaderboard,
  buildSimulationState,
  createInitialRun,
} from "@/lib/simulation";
import type {
  AiChatMessage,
  AiChatMode,
  AiChatSession,
  Assignment,
  Classroom,
  GrowthReport,
  InviteCode,
  LeaderboardEntry,
  ProfileRecord,
  Role,
  ScenarioRun,
  StudentParentLink,
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
};

declare global {
  var __brownZoneStore__: Store | undefined;
}

function createSeedUsers() {
  const basePassword = bcrypt.hashSync("BrownZone2026!", 10);
  return [
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
  ] satisfies UserRecord[];
}

function createSeedProfiles() {
  return [
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
  ] satisfies ProfileRecord[];
}

function seedRuns() {
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

  return [studentOne, studentTwo, studentThree];
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
  };
}

export function getStore() {
  if (!globalThis.__brownZoneStore__) {
    globalThis.__brownZoneStore__ = createSeedStore();
  }

  if (!globalThis.__brownZoneStore__.aiSessions) {
    globalThis.__brownZoneStore__.aiSessions = [];
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
  const matched = await bcrypt.compare(password, user.passwordHash);
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

  if (findUserByEmail(input.email)) {
    throw new Error("这个邮箱已经被注册过了。");
  }

  const newUser: UserRecord = {
    id: createId("user"),
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
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

export function getAdminOverview() {
  const store = getStore();
  const leaderboard = buildLeaderboard(store.runs, store.users);
  return {
    metrics: [
      { label: "演示班级", value: `${store.classrooms.length}` },
      { label: "模块总数", value: `${learningModules.length}` },
      { label: "邀请码池", value: `${store.invites.length}` },
      { label: "活跃学生", value: `${store.users.filter((item) => item.role === "student").length}` },
    ],
    invites: store.invites,
    classrooms: store.classrooms,
    topUsers: leaderboard.slice(0, 5),
    assignments: store.assignments.slice(0, 4),
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
