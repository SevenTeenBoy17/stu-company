import type { StudentQuestPayload } from "@/lib/quests";

import { questCategoryLabel, questIdFromCard, type QuestCardCollectionView } from "./shared";

export type QuestItem = StudentQuestPayload["quests"][number];

export type QuestBoxTheme = {
  id: string;
  creature: string;
  world: string;
  badge: string;
  asset: string;
  from: string;
  via: string;
  to: string;
  accent: string;
  accent2: string;
  ink: string;
  glow: string;
};

export const questBoxThemes: QuestBoxTheme[] = [
  {
    id: "fox-sunrise",
    creature: "狐队长",
    world: "晨光市场星",
    badge: "行情侦察",
    asset: "fox-market-scout",
    from: "#fff1d8",
    via: "#f97316",
    to: "#7c2d12",
    accent: "#ffb86b",
    accent2: "#fef3c7",
    ink: "#1f1308",
    glow: "rgba(249,115,22,0.42)",
  },
  {
    id: "turtle-shield",
    creature: "龟护卫",
    world: "安全垫岛",
    badge: "风险缓冲",
    asset: "turtle-safety-guard",
    from: "#e0fff3",
    via: "#10b981",
    to: "#064e3b",
    accent: "#8ee6c0",
    accent2: "#ecfdf5",
    ink: "#06261d",
    glow: "rgba(16,185,129,0.34)",
  },
  {
    id: "rabbit-bank",
    creature: "兔管家",
    world: "储蓄月球",
    badge: "现金纪律",
    asset: "rabbit-savings-banker",
    from: "#fff7ed",
    via: "#fb7185",
    to: "#881337",
    accent: "#fda4af",
    accent2: "#ffe4e6",
    ink: "#2a0f15",
    glow: "rgba(251,113,133,0.36)",
  },
  {
    id: "owl-lab",
    creature: "猫头鹰",
    world: "复盘书塔",
    badge: "证据链",
    asset: "owl-evidence-analyst",
    from: "#eef2ff",
    via: "#6366f1",
    to: "#312e81",
    accent: "#a5b4fc",
    accent2: "#e0e7ff",
    ink: "#111338",
    glow: "rgba(99,102,241,0.34)",
  },
  {
    id: "robot-radar",
    creature: "小机器人",
    world: "雷达港",
    badge: "信号识别",
    asset: "robot-radar-helper",
    from: "#ecfeff",
    via: "#06b6d4",
    to: "#164e63",
    accent: "#67e8f9",
    accent2: "#cffafe",
    ink: "#052e36",
    glow: "rgba(6,182,212,0.34)",
  },
  {
    id: "whale-harbor",
    creature: "鲸艇长",
    world: "现金海湾",
    badge: "流动性",
    asset: "whale-cash-captain",
    from: "#eff6ff",
    via: "#3b82f6",
    to: "#1e3a8a",
    accent: "#93c5fd",
    accent2: "#dbeafe",
    ink: "#0b1e3d",
    glow: "rgba(59,130,246,0.34)",
  },
  {
    id: "cat-scout",
    creature: "猫侦探",
    world: "机会街区",
    badge: "市场观察",
    asset: "cat-opportunity-detective",
    from: "#f7fee7",
    via: "#84cc16",
    to: "#365314",
    accent: "#bef264",
    accent2: "#ecfccb",
    ink: "#18230d",
    glow: "rgba(132,204,22,0.32)",
  },
  {
    id: "deer-bond",
    creature: "鹿信使",
    world: "债券林地",
    badge: "稳健配置",
    asset: "deer-bond-messenger",
    from: "#fffbeb",
    via: "#f59e0b",
    to: "#78350f",
    accent: "#fcd34d",
    accent2: "#fef3c7",
    ink: "#241506",
    glow: "rgba(245,158,11,0.36)",
  },
  {
    id: "panda-etf",
    creature: "熊猫研究员",
    world: "ETF 实验室",
    badge: "分散实验",
    asset: "panda-etf-researcher",
    from: "#f0fdfa",
    via: "#14b8a6",
    to: "#134e4a",
    accent: "#5eead4",
    accent2: "#ccfbf1",
    ink: "#082f2c",
    glow: "rgba(20,184,166,0.34)",
  },
  {
    id: "squirrel-budget",
    creature: "松鼠会计",
    world: "生活账本谷",
    badge: "预算节奏",
    asset: "squirrel-budget-accountant",
    from: "#fff7ed",
    via: "#ea580c",
    to: "#7c2d12",
    accent: "#fdba74",
    accent2: "#fed7aa",
    ink: "#261203",
    glow: "rgba(234,88,12,0.36)",
  },
  {
    id: "lion-rank",
    creature: "狮子向导",
    world: "目标灯塔",
    badge: "目标拆解",
    asset: "lion-leaderboard-referee",
    from: "#faf5ff",
    via: "#a855f7",
    to: "#581c87",
    accent: "#d8b4fe",
    accent2: "#f3e8ff",
    ink: "#26063d",
    glow: "rgba(168,85,247,0.34)",
  },
  {
    id: "penguin-review",
    creature: "企鹅档案员",
    world: "历史冰川",
    badge: "复盘归档",
    asset: "penguin-history-archivist",
    from: "#f0f9ff",
    via: "#0ea5e9",
    to: "#075985",
    accent: "#7dd3fc",
    accent2: "#e0f2fe",
    ink: "#082f49",
    glow: "rgba(14,165,233,0.34)",
  },
];

export function stableQuestThemeIndex(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash % questBoxThemes.length;
}

export function questBoxThemeFor(quest: QuestItem, index = 0) {
  // 按稳定位置/哈希分配主题，保证 12 个伙伴在图鉴里都可点亮（概念匹配只有 7 个 profile，
  // 会让另外 5 个孤儿动物无法解锁，故角色名已统一即可，不强制卡面=概念动物）。
  const preferredIndex = Number.isFinite(index) ? index : stableQuestThemeIndex(quest.id);
  return questBoxThemes[preferredIndex % questBoxThemes.length] ?? questBoxThemes[stableQuestThemeIndex(quest.id)];
}

export type QuestVisualProfile = {
  visualTitle: string;
  shortAction: string;
  conceptTag: string;
  creatureName: string;
  creatureAsset: string;
  plantLabel: string;
  accent: string;
  softBg: string;
};

export const questVisualProfiles: Array<{ match: (id: string, category: string) => boolean; profile: QuestVisualProfile }> = [
  {
    match: (id) => id.includes("market"),
    profile: {
      visualTitle: "市场观察",
      shortAction: "去观察",
      conceptTag: "证据链",
      creatureName: "狐队长",
      creatureAsset: "fox-market-scout",
      plantLabel: "雷达叶片",
      accent: "#f08a38",
      softBg: "linear-gradient(135deg,#fff7ed,#ecfeff)",
    },
  },
  {
    match: (id) => id.includes("opportunity") || id.includes("evidence") || id.includes("note"),
    profile: {
      visualTitle: "机会证据",
      shortAction: "写证据",
      conceptTag: "机会观察单",
      creatureName: "猫头鹰",
      creatureAsset: "owl-evidence-analyst",
      plantLabel: "放大镜花",
      accent: "#7aa7ff",
      softBg: "linear-gradient(135deg,#eff6ff,#fff7ed)",
    },
  },
  {
    match: (id) => id.includes("fund") || id.includes("portfolio") || id.includes("diversification"),
    profile: {
      visualTitle: "组合实验",
      shortAction: "做实验",
      conceptTag: "分散配置",
      creatureName: "熊猫研究员",
      creatureAsset: "panda-etf-researcher",
      plantLabel: "竹叶饼图",
      accent: "#14b8a6",
      softBg: "linear-gradient(135deg,#f0fdfa,#fff7ed)",
    },
  },
  {
    match: (id) => id.includes("risk") || id.includes("protection") || id.includes("safety") || id.includes("goal"),
    profile: {
      visualTitle: "安全底座",
      shortAction: "建底座",
      conceptTag: "风险缓冲",
      creatureName: "龟护卫",
      creatureAsset: "turtle-safety-guard",
      plantLabel: "盾牌蘑菇",
      accent: "#78d8ad",
      softBg: "linear-gradient(135deg,#ecfdf5,#fffaf2)",
    },
  },
  {
    match: (id) => id.includes("review") || id.includes("wealth") || id.includes("cooldown"),
    profile: {
      visualTitle: "持有复盘",
      shortAction: "去复盘",
      conceptTag: "回环藤蔓",
      creatureName: "企鹅档案员",
      creatureAsset: "penguin-history-archivist",
      plantLabel: "复盘藤蔓",
      accent: "#7aa7ff",
      softBg: "linear-gradient(135deg,#eff6ff,#f8fafc)",
    },
  },
  {
    match: (id) => id.includes("cash") || id.includes("bank") || id.includes("buffer"),
    profile: {
      visualTitle: "现金管理",
      shortAction: "管现金",
      conceptTag: "现金流",
      creatureName: "鲸艇长",
      creatureAsset: "whale-cash-captain",
      plantLabel: "水滴钱袋",
      accent: "#3b82f6",
      softBg: "linear-gradient(135deg,#eff6ff,#fff7ed)",
    },
  },
  {
    match: (id) => id.includes("learn"),
    profile: {
      visualTitle: "知识火花",
      shortAction: "去学习",
      conceptTag: "课程转化",
      creatureName: "小机器人",
      creatureAsset: "robot-radar-helper",
      plantLabel: "学习火苗",
      accent: "#06b6d4",
      softBg: "linear-gradient(135deg,#ecfeff,#f8fafc)",
    },
  },
];

export function questVisualProfileFor(quest: QuestItem, index = 0): QuestVisualProfile {
  const matched = questVisualProfiles.find((item) => item.match(quest.id, quest.category));
  if (matched) return matched.profile;
  const theme = questBoxThemeFor(quest, index);
  return {
    visualTitle: questCategoryLabel(quest.category),
    shortAction: quest.status === "done" ? "领奖励" : quest.status === "locked" ? "看条件" : "继续任务",
    conceptTag: theme.badge,
    creatureName: theme.creature,
    creatureAsset: theme.asset,
    plantLabel: theme.world,
    accent: theme.accent,
    softBg: `linear-gradient(135deg,${theme.from},#ffffff)`,
  };
}

// 把一张收藏卡映射到它来源任务的视觉主题（角色 + 渐变）；找不到来源任务时按卡 id 稳定哈希。
export function themeForCollectionItem(item: QuestCardCollectionView, quests: QuestItem[]): QuestBoxTheme {
  const questId = questIdFromCard(item);
  const idx = questId ? quests.findIndex((quest) => quest.id === questId) : -1;
  if (idx >= 0) return questBoxThemeFor(quests[idx], idx);
  return questBoxThemes[stableQuestThemeIndex(item.card.id)];
}
