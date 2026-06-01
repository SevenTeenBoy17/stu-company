import type {
  AiChatMessage,
  AiChatMode,
  HistoryReviewInsight,
  Role,
  SimulationState,
  TutorRadarPayload,
} from "@/lib/types";
import {
  buildTutorRadarContext,
  buildTutorRadarPayload,
  getTutorRadarPromptTemplate,
} from "@/lib/tutor-radar";

export interface TutorInsightRequest {
  mode: "welcome" | "action-review" | "round-review" | "parent-summary";
  prompt?: string;
  state: Pick<SimulationState, "user" | "market" | "run">;
}

export interface TutorInsightResponse {
  text: string;
  provider: "remote" | "fallback";
  baseUrl?: string;
}

export interface ChatReplyRequest {
  mode: AiChatMode;
  prompt: string;
  contextBlock: string;
  history: AiChatMessage[];
  role?: Role;
}

export interface AllocationInsightRequest {
  state: SimulationState;
  contextBlock: string;
  fallbackText: string;
}

export interface HistoryReviewInsightRequest {
  state: SimulationState;
  contextBlock: string;
  fallbackReview: HistoryReviewInsight;
}

export interface TutorRadarRequest {
  state: SimulationState;
}

export interface OnboardingNarrativeRequest {
  userName: string;
  stepId: string;
  stepTitle: string;
  concept: string;
  fallbackText: string;
  progressLabel: string;
}

function endpointForBase(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, "");
  return normalized.endsWith("/v1") ? `${normalized}/messages` : `${normalized}/v1/messages`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * C6: AI gateway configuration. Returns null when the operator has not opted
 * into a specific endpoint. We never silently fall back to a hardcoded
 * third-party domain — PII would leave the boundary without consent.
 *
 * Reads from process.env (not env.ts snapshot) so test fixtures and
 * Edge-runtime late binding still work. env.ts only validates these vars'
 * shapes; all are .optional() so it adds no protection here.
 */
function getAiConfig() {
  const apiKey = process.env.AI_API_KEY ?? process.env.BROWN_AGENT_API_KEY;
  const primary = process.env.AI_BASE_URL_PRIMARY ?? process.env.BROWN_AGENT_BASE_URL;
  const secondary =
    process.env.AI_BASE_URL_SECONDARY ?? process.env.BROWN_AGENT_FALLBACK_BASE_URL;
  if (!apiKey || !primary) return null;
  return {
    apiKey,
    model: process.env.AI_MODEL ?? "claude-sonnet-4-6",
    baseUrls: [primary, secondary].filter((url): url is string => Boolean(url)),
  };
}

function buildOnboardingSystemPrompt() {
  return [
    "你是 Brown Zone 的 Mr.Brown，一位面向青少年的财商启蒙导师。",
    "请始终使用简体中文，语气像游戏新手村导师：清晰、温和、有一点故事感，但不夸张。",
    "每次只解释一个核心概念，避免认知负荷过高。",
    "所有内容必须声明这是教育模拟，不涉及真实交易建议。",
  ].join("\n");
}

function buildOnboardingPrompt(input: OnboardingNarrativeRequest) {
  return [
    `学生：${input.userName}`,
    `当前教学进度：${input.progressLabel}`,
    `步骤：${input.stepTitle}`,
    `本步唯一核心概念：${input.concept}`,
    `页面已有默认文案：${input.fallbackText}`,
    "请改写成 70-110 字的新手引导文案。",
    "要求：第一句承接游戏叙事，第二句解释概念，第三句给出一个低压力行动提示。",
    "不要输出标题、编号、Markdown 或真实投资建议。",
  ].join("\n");
}

function buildLocalOnboardingNarrative(input: OnboardingNarrativeRequest) {
  return input.fallbackText.replace("新同学", input.userName);
}

function buildTutorSystemPrompt() {
  return [
    "你是 Mr.Brown，一位面向中学生的理性财商教练。",
    "请始终使用简体中文，语气专业、友好、清晰。",
    "强调教育用途、模拟盘、风险意识、复盘习惯与资金纪律。",
    "不要给出现实世界中的保证式投资建议，也不要鼓励激进投机。",
  ].join("\n");
}

function buildTutorPrompt(input: TutorInsightRequest) {
  return [
    `模式：${input.mode}`,
    `用户：${input.state.user.name} / ${input.state.user.title}`,
    `当前回合：${input.state.run.currentRound}/${input.state.run.totalRounds}`,
    `回合主题：${input.state.market.round.theme}`,
    `回合事件：${input.state.market.event.title} - ${input.state.market.event.description}`,
    `现金：${input.state.run.cash}，储蓄：${input.state.run.savings}，债务：${input.state.run.debt}`,
    `最近复盘：${input.state.run.lastInsight ?? "暂无"}`,
    input.prompt ? `补充问题：${input.prompt}` : "",
    "请给出 1 段总结 + 3 条可执行建议，每条建议都要具体、克制、可落地。",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildChatSystemPrompt(mode: AiChatMode, role?: Role) {
  const modeInstruction =
    mode === "guest"
      ? "当前是游客通用问答，只做产品介绍、财商教育解释和试玩引导，不提供真实个股建议。"
      : mode === "student-context"
        ? "当前是学生强上下文模式，要结合回合、持仓、交易与事件给出教育性的分析和下一步观察点。"
        : `当前是登录用户通用问答，可结合角色 ${role ?? "unknown"} 解释平台功能、学习路径和运营建议。`;

  return [
    "你是 KeyAI / Mr.Brown，Brown Zone 里的 AI 财商导师。",
    "请始终使用简体中文，短句优先，信息密度高但不要堆砌术语。",
    modeInstruction,
    "如果用户询问股票、交易或调仓，请给出风险、观察点、仓位节奏和验证动作，不给保证式买卖结论。",
    "如果用户问题超出当前模式可回答边界，要明确说明边界，再给出最有帮助的教育性建议。",
    "输出可以自然分段，但不要出现夸张承诺或现实荐股口吻。",
  ].join("\n");
}

function buildLocalTutorNarrative(input: TutorInsightRequest) {
  const snapshot = input.state.run.snapshots.at(-1);
  const riskCue =
    snapshot && snapshot.riskScore > 70
      ? "你最近的仓位波动偏大，先把现金缓冲拉回安全线，再考虑冲击榜单。"
      : "你当前的节奏比较稳，继续保持先判断、后出手的习惯会更有复利价值。";
  const disciplineCue =
    snapshot && snapshot.disciplineScore > 78
      ? "你已经开始展现策略纪律，可以把复盘结论写成下一回合的行动规则。"
      : "别急着追求一次性翻倍，先给自己设定仓位上限和止损原则。";

  return [
    `Mr.Brown 观察：当前处于「${input.state.market.round.theme}」阶段，市场主线是 ${input.state.market.round.summary}`,
    `1. ${riskCue}`,
    `2. ${disciplineCue}`,
    `3. 本回合事件「${input.state.market.event.title}」提醒你：${input.state.market.event.coachingCue}`,
  ].join("\n");
}

function buildLocalChatNarrative(input: ChatReplyRequest) {
  if (input.mode === "guest") {
    return [
      "KeyAI 当前已切换到本地教学兜底模式。",
      "Brown Zone 是一个面向中学生的 AI 财商教育网页应用，核心是用 12 回合经济沙盘把股票、储蓄、房地产、创业和复盘训练放进一个可互动的学习场景里。",
      "你现在可以先从试玩入口体验学生端，再到课程页查看模块内容；如果你想，我也可以直接告诉你最适合从哪一页开始看。",
    ].join("\n");
  }

  if (input.mode === "student-context") {
    return [
      "KeyAI 当前已切换到本地教学兜底模式。",
      "我会继续按教育模拟盘的方式回答你：先看风险，再看仓位，再看验证动作。",
      "结合你当前页面上下文，建议你优先核对现金缓冲、持仓集中度，以及这笔动作是否真的服务于下一回合目标。",
      "如果你是在问某只资产，先确认它在你总仓位里的占比；如果你是在问一笔交易，先判断它是计划内执行，还是被情绪带着走。",
    ].join("\n");
  }

  return [
    "KeyAI 当前已切换到本地教学兜底模式。",
    "我仍然可以帮助你理解 Brown Zone 的功能、学习路径和演示逻辑。",
    "你可以继续追问页面功能、角色任务、课堂使用方式，或让我把当前模块用更易懂的方式解释给你。",
  ].join("\n");
}

function buildAllocationPrompt(input: AllocationInsightRequest) {
  return [
    "任务：请作为学生策略台里的 AI 资产配置教练，基于以下上下文生成可直接展示给学生的配置建议。",
    `学生：${input.state.user.name} / ${input.state.user.title}`,
    `当前回合：${input.state.run.currentRound}/${input.state.run.totalRounds}`,
    `当前净值：${input.state.run.snapshots.at(-1)?.netWorth ?? "未知"}`,
    `风险分：${input.state.run.snapshots.at(-1)?.riskScore ?? "未知"}`,
    "以下是市场脉冲、当前持有与建议配置：",
    input.contextBlock,
    "请输出一段简洁判断，再给 3 条行动建议。",
    "建议必须围绕仓位、节奏、观察点和风险控制，不要给现实世界中的保证式荐股结论。",
  ].join("\n");
}

function buildHistoryReviewPrompt(input: HistoryReviewInsightRequest) {
  return [
    "任务：请作为 Brown Zone 学生历史复盘看板里的 AI 教练，基于以下学生历史操作与净值路径，生成一份适合直接展示在页面右侧的复盘内容。",
    `学生：${input.state.user.name} / ${input.state.user.title}`,
    `当前回合：${input.state.run.currentRound}/${input.state.run.totalRounds}`,
    "以下是聚合后的复盘上下文：",
    input.contextBlock,
    "请严格按下面格式输出，且全部使用简体中文：",
    "【总结】",
    "用一段 2-3 句的文字总结当前阶段的整体表现。",
    "【诊断】",
    "- 给出 3 条问题诊断或关键观察点，每条一行。",
    "【建议】",
    "1. 给出 3 条下一步参考建议，每条一行，强调风险控制、现金节奏、验证动作，不要给保证式买卖结论。",
  ].join("\n");
}

function buildTutorRadarPrompt(input: TutorRadarRequest) {
  return [
    getTutorRadarPromptTemplate(),
    "以下是学生当前沙盘信息：",
    buildTutorRadarContext(input.state),
  ].join("\n\n");
}

function mapConversationMessages(history: AiChatMessage[]) {
  return history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: [{ type: "text" as const, text: message.text }],
    }));
}

function parseBulletLines(block: string | undefined, minimum: string[]) {
  if (!block) return minimum;

  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•\d.\s、]+/, "").trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : minimum;
}

function parseHistoryReviewText(
  text: string,
  fallbackReview: HistoryReviewInsight,
): Omit<HistoryReviewInsight, "provider" | "baseUrl"> {
  const summaryMatch = text.match(/【总结】([\s\S]*?)(?=【诊断】|【建议】|$)/);
  const analysisMatch = text.match(/【诊断】([\s\S]*?)(?=【建议】|$)/);
  const nextStepsMatch = text.match(/【建议】([\s\S]*?)$/);

  const summary = summaryMatch?.[1]?.trim() || fallbackReview.summary;
  const analysis = parseBulletLines(analysisMatch?.[1], fallbackReview.analysis);
  const nextSteps = parseBulletLines(nextStepsMatch?.[1], fallbackReview.nextSteps);

  return {
    summary,
    analysis,
    nextSteps,
  };
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) return fenced;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text;
}

function normalizeRadarPayload(
  text: string,
  fallback: TutorRadarPayload,
): Omit<TutorRadarPayload, "provider" | "baseUrl" | "asOf"> {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as Partial<TutorRadarPayload>;
    const fallbackMetricsById = new Map(fallback.metrics.map((metric) => [metric.id, metric]));
    const metrics = fallback.metrics.map((fallbackMetric) => {
      const candidate =
        parsed.metrics?.find((metric) => metric.id === fallbackMetric.id) ??
        parsed.metrics?.find((metric) => metric.label === fallbackMetric.label);

      return {
        id: fallbackMetric.id,
        label: fallbackMetric.label,
        score: Math.round(
          Math.min(100, Math.max(0, Number(candidate?.score ?? fallbackMetric.score))),
        ),
        note:
          typeof candidate?.note === "string" && candidate.note.trim().length > 0
            ? candidate.note.trim().slice(0, 18)
            : fallbackMetricsById.get(fallbackMetric.id)?.note ?? fallbackMetric.note,
      };
    });

    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : fallback.summary,
      metrics,
    };
  } catch {
    return {
      summary: fallback.summary,
      metrics: fallback.metrics,
    };
  }
}

async function requestRemoteText(input: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: Array<{ type: "text"; text: string }> }>;
  fallbackText: string;
}): Promise<TutorInsightResponse> {
  const config = getAiConfig();

  if (!config) {
    return {
      text: input.fallbackText,
      provider: "fallback",
    };
  }

  const { apiKey, model, baseUrls } = config;

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetchWithTimeout(endpointForBase(baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          system: input.system,
          messages: input.messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI 接口返回 ${response.status}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content
        ?.map((item) => item.text?.trim())
        .filter(Boolean)
        .join("\n")
        .trim();

      if (!text) {
        throw new Error("AI 响应为空");
      }

      return {
        text,
        provider: "remote",
        baseUrl,
      };
    } catch {
      continue;
    }
  }

  return {
    text: input.fallbackText,
    provider: "fallback",
  };
}

export async function requestTutorInsight(input: TutorInsightRequest): Promise<TutorInsightResponse> {
  return requestRemoteText({
    system: buildTutorSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildTutorPrompt(input) }],
      },
    ],
    fallbackText: buildLocalTutorNarrative(input),
  });
}

export async function requestOnboardingNarrative(
  input: OnboardingNarrativeRequest,
): Promise<TutorInsightResponse> {
  return requestRemoteText({
    system: buildOnboardingSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildOnboardingPrompt(input) }],
      },
    ],
    fallbackText: buildLocalOnboardingNarrative(input),
  });
}

export async function requestChatReply(input: ChatReplyRequest): Promise<TutorInsightResponse> {
  const contextBlock = [
    "以下是当前页面与用户上下文，请先理解再回答：",
    input.contextBlock,
  ].join("\n");
  const lastMessages = input.history.slice(-10);
  const conversation = [...lastMessages];
  const lastMessage = conversation.at(-1);

  if (!lastMessage || lastMessage.role !== "user") {
    conversation.push({
      id: "inline-user",
      role: "user",
      text: input.prompt,
      createdAt: new Date().toISOString(),
      meta: {
        mode: input.mode,
      },
    });
  }

  const assistantMessages = mapConversationMessages(conversation);
  const firstUserIndex = assistantMessages.findIndex((message) => message.role === "user");
  if (firstUserIndex >= 0) {
    assistantMessages[firstUserIndex] = {
      role: "user",
      content: [
        {
          type: "text",
          text: `${contextBlock}\n\n用户问题：${assistantMessages[firstUserIndex].content[0]?.text ?? input.prompt}`,
        },
      ],
    };
  }

  return requestRemoteText({
    system: buildChatSystemPrompt(input.mode, input.role),
    messages: assistantMessages,
    fallbackText: buildLocalChatNarrative(input),
  });
}

export async function requestAllocationInsight(
  input: AllocationInsightRequest,
): Promise<TutorInsightResponse> {
  return requestRemoteText({
    system: buildTutorSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildAllocationPrompt(input) }],
      },
    ],
    fallbackText: input.fallbackText,
  });
}

export async function requestHistoryReviewInsight(
  input: HistoryReviewInsightRequest,
): Promise<HistoryReviewInsight> {
  const fallbackText = [
    "【总结】",
    input.fallbackReview.summary,
    "【诊断】",
    ...input.fallbackReview.analysis.map((item) => `- ${item}`),
    "【建议】",
    ...input.fallbackReview.nextSteps.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  const response = await requestRemoteText({
    system: buildTutorSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildHistoryReviewPrompt(input) }],
      },
    ],
    fallbackText,
  });

  const parsed = parseHistoryReviewText(response.text, input.fallbackReview);

  return {
    ...parsed,
    provider: response.provider,
    baseUrl: response.baseUrl,
  };
}

export async function requestTutorRadarPayload(input: TutorRadarRequest): Promise<TutorRadarPayload> {
  const fallback = buildTutorRadarPayload(input.state);
  const response = await requestRemoteText({
    system: buildTutorSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: buildTutorRadarPrompt(input) }],
      },
    ],
    fallbackText: JSON.stringify(
      {
        summary: fallback.summary,
        metrics: fallback.metrics,
      },
      null,
      2,
    ),
  });

  const normalized = normalizeRadarPayload(response.text, fallback);

  return {
    asOf: new Date().toISOString(),
    provider: response.provider,
    baseUrl: response.baseUrl,
    ...normalized,
  };
}
