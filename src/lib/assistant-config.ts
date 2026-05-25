import type { AiChatMode, Role } from "@/lib/types";

export const AI_ASSISTANT_OPEN_EVENT = "brown-zone:assistant-open";

export interface AiAssistantLaunchDetail {
  prompt?: string;
  assetId?: string;
  actionLogId?: string;
  autoSend?: boolean;
}

export function resolveAiChatMode(route: string, role?: Role | null): AiChatMode {
  if (route.startsWith("/student")) {
    return "student-context";
  }

  if (role) {
    return "platform-generic";
  }

  return "guest";
}

export function getStarterPrompts(mode: AiChatMode, role?: Role | null) {
  if (mode === "student-context") {
    return [
      "当前这只股票现在风险大吗？",
      "这笔交易值不值得做？",
      "下一回合我该怎么调仓？",
    ];
  }

  if (role === "teacher") {
    return [
      "我该怎么给这个班布置下一次挑战任务？",
      "班级排行榜里谁最值得重点辅导？",
      "如何设计一节 20 分钟的沙盘复盘课？",
    ];
  }

  if (role === "parent") {
    return [
      "我该怎么读懂孩子的成长报告？",
      "如何和孩子聊风险，而不只是聊收益？",
      "这一阶段最值得鼓励孩子哪种习惯？",
    ];
  }

  if (role === "admin") {
    return [
      "当前演示环境最适合展示哪些功能？",
      "怎样安排邀请码和角色演示顺序？",
      "平台下一阶段的增长重点应该放在哪？",
    ];
  }

  return [
    "Brown Zone 是什么？",
    "学生能在这里学到什么？",
    "如何开始试玩？",
  ];
}

export function buildAiSessionTitle(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "新对话";
  return normalized.length > 20 ? `${normalized.slice(0, 20)}…` : normalized;
}

export function dispatchAssistantOpen(detail: AiAssistantLaunchDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_ASSISTANT_OPEN_EVENT, { detail }));
}
