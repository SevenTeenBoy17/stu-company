import { resolveAiChatMode, getStarterPrompts } from "@/lib/assistant-config";
import { findProfileByUserId, getSimulationStateForUser } from "@/lib/db/repo";
import type {
  ActionLog,
  AiChatMode,
  AiChatPageContext,
  Role,
  SimulationState,
  UserRecord,
} from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface AssistantContextBundle {
  mode: AiChatMode;
  starterPrompts: string[];
  contextBlock: string;
}

function buildGuestContext(route: string) {
  return [
    "当前模式：游客通用问答。",
    `当前页面：${route}`,
    "产品定位：面向中学生的 AI 财商教育网页应用。",
    "可介绍内容：官网亮点、课程模块、试玩入口、教师端、家长端、学生经济沙盘。",
    "回答边界：只做产品讲解、财商教育解释和试玩引导，不给真实个股建议。",
  ].join("\n");
}

async function buildGenericRoleContext(route: string, user: UserRecord) {
  const profile = await findProfileByUserId(user.id);
  const roleFocus: Record<Role, string> = {
    student: "可以回答学生学习路径、课程模块和模拟交易方法，但当前不使用强股票上下文。",
    teacher: "可以回答班级运营、挑战任务、课堂复盘与教师端功能。",
    parent: "可以回答成长报告、风险提示和家庭沟通建议。",
    admin: "可以回答演示路径、邀请码管理、运营展示与平台功能。",
  };

  return [
    "当前模式：登录后通用问答。",
    `当前页面：${route}`,
    `当前角色：${user.role}`,
    `当前用户：${user.name} / ${user.title}`,
    profile ? `个人简介：${profile.headline}` : "",
    roleFocus[user.role],
    "回答边界：强调教育模拟、风险意识和产品引导，不给真实交易指令。",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAssetContextBlock(input: {
  selectedAsset?: SimulationState["market"]["assets"][number];
  actionLog?: ActionLog;
  holdingQuantity?: number;
  holdingCost?: number;
}) {
  const lines: string[] = [];

  if (input.selectedAsset) {
    const currentValue =
      input.holdingQuantity && input.holdingCost
        ? (input.selectedAsset.currentPrice - input.holdingCost) * input.holdingQuantity
        : null;

    lines.push(
      `聚焦资产：${input.selectedAsset.name} (${input.selectedAsset.symbol})`,
      `资产类别：${input.selectedAsset.category}`,
      `当前价格：${formatCurrency(input.selectedAsset.currentPrice)}，当回合涨跌：${formatPercent(input.selectedAsset.dayChange)}`,
      `教学描述：${input.selectedAsset.description}`,
      input.holdingQuantity
        ? `当前持仓：${input.holdingQuantity}，持仓成本：${formatCurrency(input.holdingCost ?? 0)}，浮动盈亏：${formatCurrency(currentValue ?? 0)}`
        : "当前未持有这只资产。",
    );
  }

  if (input.actionLog) {
    lines.push(
      `聚焦交易：${input.actionLog.label}`,
      `交易回合：第 ${input.actionLog.round} 回合`,
      `涉及金额：${formatCurrency(input.actionLog.amount)}`,
    );
  }

  return lines.join("\n");
}

async function buildStudentContext(route: string, user: UserRecord, pageContext: AiChatPageContext) {
  const simulation = await getSimulationStateForUser(user.id);
  const selectedAsset = pageContext.assetId
    ? simulation.market.assets.find((asset) => asset.id === pageContext.assetId)
    : undefined;
  const actionLog = pageContext.actionLogId
    ? simulation.run.actionLog.find((entry) => entry.id === pageContext.actionLogId)
    : undefined;
  const holding = selectedAsset
    ? simulation.run.holdings.find((item) => item.assetId === selectedAsset.id)
    : undefined;
  const rank = simulation.leaderboard.find((entry) => entry.userId === user.id)?.rank;
  const holdingsSummary = simulation.run.holdings
    .map((item) => {
      const asset = simulation.market.assets.find((candidate) => candidate.id === item.assetId);
      if (!asset) return null;
      return `${asset.name} ${item.quantity}份 / 成本 ${formatCurrency(item.averageCost)}`;
    })
    .filter(Boolean)
    .join("；");
  const recentActions = simulation.run.actionLog
    .slice(0, 3)
    .map((entry) => `${entry.label}（第 ${entry.round} 回合）`)
    .join("；");

  return [
    "当前模式：学生强上下文问答。",
    `当前页面：${route}`,
    `当前用户：${simulation.user.name} / ${simulation.user.title}`,
    `当前回合：${simulation.run.currentRound}/${simulation.run.totalRounds}`,
    `回合主题：${simulation.market.round.theme} - ${simulation.market.round.headline}`,
    `当前事件：${simulation.market.event.title} - ${simulation.market.event.description}`,
    `账户状态：现金 ${formatCurrency(simulation.run.cash)}，储蓄 ${formatCurrency(simulation.run.savings)}，债务 ${formatCurrency(simulation.run.debt)}`,
    `班级排名：${rank ? `第 ${rank} 名` : "暂无"}`,
    `持仓摘要：${holdingsSummary || "当前没有持仓。"}`,
    `最近动作：${recentActions || "当前没有动作记录。"}`,
    buildAssetContextBlock({
      selectedAsset,
      actionLog,
      holdingQuantity: holding?.quantity,
      holdingCost: holding?.averageCost,
    }),
    "回答边界：这是教育模拟盘，请强调风险、观察点、仓位节奏与复盘动作，不给保证式买卖结论。",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function buildAssistantContextBundle(input: {
  route: string;
  user?: UserRecord | null;
  pageContext: AiChatPageContext;
}): Promise<AssistantContextBundle> {
  const mode = resolveAiChatMode(input.route, input.user?.role);
  const starterPrompts = getStarterPrompts(mode, input.user?.role);

  if (!input.user) {
    return {
      mode,
      starterPrompts,
      contextBlock: buildGuestContext(input.route),
    };
  }

  if (mode === "student-context" && input.user.role === "student") {
    return {
      mode,
      starterPrompts,
      contextBlock: await buildStudentContext(input.route, input.user, input.pageContext),
    };
  }

  return {
    mode,
    starterPrompts,
    contextBlock: await buildGenericRoleContext(input.route, input.user),
  };
}
