"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  Landmark,
  LineChart,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Trophy,
  WalletCards,
} from "lucide-react";

import { Disclosure } from "@/components/shared/disclosure";
import { MoneyText } from "@/components/shared/money-text";
import { SeasonLeaderboard } from "@/components/student/season-leaderboard";
import { PowerRankTeaser } from "@/components/student/rank/power-rank-teaser";
import { StudentAllocationPanel } from "@/components/student/student-allocation-panel";
import { StudentHomeHub } from "@/components/student/student-home-hub";
import { StudentPetRewardStudio } from "@/components/student/student-pet-reward-studio";
import { StudentTutorRadar } from "@/components/student/student-tutor-radar";
import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { buildStudentPetPayload } from "@/lib/pet-rewards";
import { buildPortfolioIntel } from "@/lib/portfolio-intel";
import { buildStudentHomeHubPayload } from "@/lib/student-service-map";
import type { AdaptiveEvent } from "@/lib/adaptive-events";
import { buildPersonaShareText, computeLearningStreak } from "@/lib/simulation";
import { buildTutorRadarPayload } from "@/lib/tutor-radar";
import type {
  ActionLog,
  InvestorPersona,
  PortfolioIntel,
  SimulationState,
  TutorRadarPayload,
} from "@/lib/types";
import { cn, formatCurrency, formatPercent, getMarketMoveClasses } from "@/lib/utils";

type TradeForm = {
  assetId: string;
  side: "buy" | "sell";
  quantity: number;
  orderMode: "market" | "limit";
};

type ActionTab = "trade" | "bank" | "property" | "venture";

const defaultTrade: TradeForm = {
  assetId: "asset-etf",
  side: "buy",
  quantity: 20,
  orderMode: "market",
};

const actionTabs: Array<{ id: ActionTab; label: string; hint: string }> = [
  { id: "trade", label: "交易", hint: "股票 / ETF / 债券" },
  { id: "bank", label: "现金流", hint: "储蓄、贷款与还款" },
  { id: "property", label: "房产", hint: "模拟买入或退出" },
  { id: "venture", label: "创业", hint: "投入或退出项目" },
];

const actionTypeLabel: Partial<Record<ActionLog["type"], string>> = {
  trade: "交易",
  bank: "现金流",
  property: "房产",
  venture: "创业",
  advance: "回合推进",
  event: "事件决策",
};

const readableActionTypeLabel: Record<ActionLog["type"], string> = {
  trade: actionTypeLabel.trade ?? "交易",
  bank: actionTypeLabel.bank ?? "现金流",
  property: actionTypeLabel.property ?? "房产",
  venture: actionTypeLabel.venture ?? "创业",
  advance: actionTypeLabel.advance ?? "回合推进",
  event: actionTypeLabel.event ?? "事件决策",
  auto_invest: "定投机器人",
  quest: "任务奖励",
  opportunity: "机会观察",
  fund_lab: "基金实验",
  goal_account: "目标账户",
  protection: "风险保护",
  watchlist: "自选观察",
  wealth_review: "财富复盘",
};

function actionDirection(amount: number) {
  if (amount > 0) return "流入";
  if (amount < 0) return "流出";
  return "记录";
}

function currentRank(state: SimulationState) {
  return state.leaderboard.find((entry) => entry.userId === state.user.id)?.rank ?? state.leaderboard.length;
}

export function StudentSandbox({
  initialState,
  renderedAt,
}: {
  initialState: SimulationState;
  /** 服务端渲染时刻（page.tsx 传入）。水合确定性：首帧派生 payload 的 asOf 必须 SSR/CSR 一致，
   *  否则跨分钟边界时“server rendered text didn't match the client”（内测 rank2 根因）。 */
  renderedAt?: string;
}) {
  const [stableNow] = useState(() => renderedAt ?? new Date().toISOString());
  const [state, setState] = useState<SimulationState | null>(initialState);
  const [portfolioIntel, setPortfolioIntel] = useState<PortfolioIntel>(() =>
    buildPortfolioIntel(initialState, { asOf: stableNow }),
  );
  const [tutorRadar, setTutorRadar] = useState<TutorRadarPayload>(() =>
    buildTutorRadarPayload(initialState, "fallback", undefined, stableNow),
  );
  // Premium surfacing: investor-personality card (deepAiReport) + season replay.
  const [persona, setPersona] = useState<InvestorPersona | null>(null);
  const [canReplay, setCanReplay] = useState(false);
  const [canUsePersonalAi, setCanUsePersonalAi] = useState<boolean | null>(null);
  // Behavior-bias overlay cards (adaptive-events) surfaced after each action.
  const [adaptiveEvents, setAdaptiveEvents] = useState<AdaptiveEvent[]>([]);
  const [activeTab, setActiveTab] = useState<ActionTab>("trade");
  const [intelPending, setIntelPending] = useState(false);
  const [radarPending, setRadarPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tradeForm, setTradeForm] = useState<TradeForm>(defaultTrade);
  const [bankAmount, setBankAmount] = useState(5000);
  const [ventureAmount, setVentureAmount] = useState(8000);
  const [pending, startTransition] = useTransition();
  const refreshControllerRef = useRef<AbortController | null>(null);
  const studentId = state?.user.id;

  async function loadState() {
    const response = await fetch("/api/sim/state", { cache: "no-store" });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      state?: SimulationState;
      adaptiveEvents?: AdaptiveEvent[];
    };
    if (!response.ok || !payload.state) {
      throw new Error(payload.message ?? "无法读取当前沙盘。");
    }
    setState(payload.state);
    setAdaptiveEvents(payload.adaptiveEvents ?? []);
  }

  const selectedAsset = useMemo(
    () => state?.market.assets.find((asset) => asset.id === tradeForm.assetId) ?? state?.market.assets[0],
    [state, tradeForm.assetId],
  );
  const streak = useMemo(
    () => (state ? computeLearningStreak(state.run) : { current: 0, best: 0 }),
    [state],
  );

  async function mutate(url: string, body?: object) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as {
      error?: string;
      state?: SimulationState;
      message?: string;
      adaptiveEvents?: AdaptiveEvent[];
    };
    if (!response.ok) {
      throw new Error(payload.message ?? "提交失败。");
    }
    if (payload.state) {
      setState(payload.state);
      setAdaptiveEvents(payload.adaptiveEvents ?? []);
    } else {
      await loadState();
    }
    setMessage(payload.message ?? "操作已更新。");
  }

  // M6: avoid React 19 experimental useEffectEvent; mirror the latest closure
  // via a ref so effects can call the always-fresh implementation.
  const refreshPortfolioIntelRef = useRef<() => Promise<void>>(async () => {});
  refreshPortfolioIntelRef.current = async () => {
    if (!state) return;
    if (canUsePersonalAi !== true) {
      setPortfolioIntel(buildPortfolioIntel(state));
      setIntelPending(false);
      return;
    }

    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    setIntelPending(true);

    try {
      const response = await fetch("/api/market/portfolio-intel", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok) {
        setPortfolioIntel((await response.json()) as PortfolioIntel);
      }
    } catch {
      // Keep the local teaching fallback when the market source is unstable.
    } finally {
      if (!controller.signal.aborted) {
        setIntelPending(false);
      }
    }
  };
  const refreshPortfolioIntel = useCallback(() => refreshPortfolioIntelRef.current(), []);

  async function loadTutorRadarForState(
    currentState: SimulationState,
    options: { silent?: boolean } = {},
  ) {
    if (canUsePersonalAi !== true) {
      setTutorRadar(buildTutorRadarPayload(currentState));
      setPersona(null);
      setRadarPending(false);
      if (!options.silent) {
        setMessage("当前账号暂未开通完整 AI 评定，已先显示本地教学雷达。");
      }
      return;
    }

    setRadarPending(true);
    try {
      const response = await fetch("/api/ai/radar-chart", { method: "POST", cache: "no-store" });
      const payload = (await response.json()) as TutorRadarPayload & {
        error?: string;
        persona?: InvestorPersona | null;
      };
      if (response.ok && !payload.error) {
        setTutorRadar(payload);
        setPersona(payload.persona ?? null);
      } else {
        setTutorRadar(buildTutorRadarPayload(currentState));
        setPersona(null);
      }
    } catch {
      setTutorRadar(buildTutorRadarPayload(currentState));
      setPersona(null);
    } finally {
      setRadarPending(false);
    }
  }

  const refreshTutorRadarOnMountRef = useRef<() => Promise<void>>(async () => {});
  refreshTutorRadarOnMountRef.current = async () => {
    if (state) {
      await loadTutorRadarForState(state, { silent: true });
    }
  };
  const refreshTutorRadarOnMount = useCallback(
    () => refreshTutorRadarOnMountRef.current(),
    [],
  );

  useEffect(() => {
    if (!state) return;
    setPortfolioIntel(buildPortfolioIntel(state));
    setTutorRadar(buildTutorRadarPayload(state));
    if (canUsePersonalAi === true) {
      void refreshPortfolioIntel();
    }
  }, [state, canUsePersonalAi, refreshPortfolioIntel]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { canUsePersonalAiAssessment?: boolean; features?: { seasonReplay?: boolean } } | null) => {
        if (!alive) return;
        setCanReplay(Boolean(data?.features?.seasonReplay));
        setCanUsePersonalAi(Boolean(data?.canUsePersonalAiAssessment));
      })
      .catch(() => {
        // Replay is a premium extra; absence just hides the button.
        if (alive) {
          setCanReplay(false);
          setCanUsePersonalAi(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (studentId && canUsePersonalAi !== null) {
      void refreshTutorRadarOnMount();
    }
  }, [studentId, canUsePersonalAi, refreshTutorRadarOnMount]);

  useEffect(() => {
    if (!studentId || canUsePersonalAi !== true) return;
    const timer = window.setInterval(() => void refreshPortfolioIntel(), MARKET_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [studentId, canUsePersonalAi, refreshPortfolioIntel]);

  useEffect(() => {
    return () => refreshControllerRef.current?.abort();
  }, []);

  const homeHubPayload = useMemo(() => (state ? buildStudentHomeHubPayload(state.run) : null), [state]);
  // 水合确定性：宠物 payload 的 now 用服务端 stableNow（日/心情级语义，冻结在页面加载时刻即可），
  // 否则 SSR/CSR 各自 new Date() 跨分钟边界产生文本不一致（内测 rank2）。
  const petRewardPayload = useMemo(
    () => (state ? buildStudentPetPayload(state.run, undefined, new Date(stableNow)) : null),
    [state, stableNow],
  );

  if (!state || !homeHubPayload || !petRewardPayload) {
    return (
      <div className="panel rounded-[2rem] p-8">
        <p className="text-body font-semibold text-fg-muted">正在加载学生沙盘...</p>
      </div>
    );
  }

  const latestSnapshot = state.run.snapshots.at(-1);
  const previousSnapshot = state.run.snapshots.at(-2);
  const netWorth = latestSnapshot?.netWorth ?? state.run.cash + state.run.savings - state.run.debt;
  const netWorthDelta = previousSnapshot ? netWorth - previousSnapshot.netWorth : 0;
  const holdingsRows = state.market.assets
    .map((asset) => {
      const holding = state.run.holdings.find((item) => item.assetId === asset.id);
      const quantity = holding?.quantity ?? 0;
      const value = quantity * asset.currentPrice;
      const pnl = holding ? (asset.currentPrice - holding.averageCost) * holding.quantity : 0;
      return { asset, quantity, value, pnl };
    })
    .filter((row) => row.quantity > 0)
    .sort((a, b) => b.value - a.value);
  const holdingsValue = holdingsRows.reduce((total, row) => total + row.value, 0);
  const rank = currentRank(state);
  // v2 信息收敛：事件描述只保第一句，其余与 coachingCue 一起折进「💡提示」（数据不动，仅展示层截断）。
  const eventDescription = state.market.event.description;
  const sentenceEnd = eventDescription.indexOf("。");
  const eventLead = sentenceEnd >= 0 ? eventDescription.slice(0, sentenceEnd + 1) : eventDescription;
  const eventRest = eventDescription.slice(eventLead.length).trim();
  const recentActions = state.run.actionLog.slice().reverse().slice(0, 7);
  const topLeaderboard = state.leaderboard.slice(0, 5);

  const heroMetrics = [
    {
      label: "当前净值",
      value: formatCurrency(netWorth),
      motionValue: netWorth,
      motionPrefix: "¥",
      motionFormat: "currency",
      meta: netWorthDelta === 0 ? "本回合保持观察" : `较上回合 ${formatCurrency(netWorthDelta)}`,
      icon: WalletCards,
      money: true,
      isHero: true,
    },
    {
      label: "可用现金",
      value: formatCurrency(state.run.cash),
      motionValue: state.run.cash,
      motionPrefix: "¥",
      motionFormat: "currency",
      meta: "行动前先留安全垫",
      icon: Landmark,
      money: true,
      isHero: false,
    },
    {
      label: "持仓市值",
      value: formatCurrency(holdingsValue),
      motionValue: holdingsValue,
      motionPrefix: "¥",
      motionFormat: "currency",
      meta: `${holdingsRows.length} 个资产正在观察`,
      icon: LineChart,
      money: true,
      isHero: false,
    },
    {
      label: "班级排名",
      value: `#${rank}`,
      motionValue: rank,
      motionPrefix: "#",
      motionFormat: "integer",
      meta: state.classroom.name,
      icon: Trophy,
      money: false,
      isHero: false,
    },
    {
      label: "风险评分",
      value: `${latestSnapshot?.riskScore ?? "--"}`,
      motionValue: latestSnapshot?.riskScore ?? 0,
      motionPrefix: "",
      motionFormat: "integer",
      meta: `纪律分 ${latestSnapshot?.disciplineScore ?? "--"}`,
      icon: ShieldCheck,
      money: false,
      isHero: false,
    },
  ];

  // Double-submit guard: startTransition wraps all action submissions.
  const submitAction = (body?: object, url = "/api/sim/actions") => {
    startTransition(async () => {
      try {
        await mutate(url, body);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败，请重试。");
      }
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ── Page header ── */}
      <header className="panel rounded-[1.65rem] px-5 py-4 sm:px-6" data-motion-reveal>
        {/* Eyebrow on light panel → bz-eyebrow (replaces hardcoded text-orange-500 tracking class) */}
        <p className="bz-eyebrow bz-brand-text-on-light">Brown Zone</p>
        {/* LC10h E2E 修复：本页标题「学生策略台」由 PlatformLayout 以 <h1> 渲染（页面唯一 h1）。
            此处沙盘头部曾用同名 <h1>，与外壳标题构成重复 h1（strict-mode 命中 2 个 heading）。
            降为视觉标题 <p>（样式不变），保证每页只有一个「学生策略台」heading。 */}
        <p className="mt-2 text-display-sm font-semibold tracking-tight text-fg-strong sm:text-display-md">学生策略台</p>
      </header>

      {/* ── KPI bar: ONE hero (net worth) + 4 secondary metrics ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {heroMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="panel min-w-0 overflow-hidden rounded-[1.65rem] p-4 sm:p-5"
              data-motion-card
              data-motion-reveal
            >
              <div className="flex items-start justify-between gap-4">
                <p className="min-w-0 text-body-sm font-semibold text-fg-muted">{item.label}</p>
                <span className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              {/* Net worth card → ONE hero number; others → text-h2 */}
              <p
                className={cn(
                  "mt-3 max-w-full leading-none tracking-tight tabular-nums",
                  item.isHero
                    ? "bz-hero-stat text-hero-num text-fg-strong"
                    : "text-h2 text-fg-strong",
                )}
                data-motion-number
                data-motion-value={item.motionValue}
                data-motion-prefix={item.motionPrefix}
                data-motion-format={item.motionFormat}
              >
                {item.money ? <MoneyText>{item.value}</MoneyText> : item.value}
              </p>
              <p className="mt-3 line-clamp-2 min-w-0 text-body-sm leading-6 text-fg-muted">{item.meta}</p>
            </div>
          );
        })}
      </section>

      <StudentHomeHub payload={homeHubPayload} />

      <StudentPetRewardStudio initialPayload={petRewardPayload} />

      <StudentAllocationPanel
        intel={portfolioIntel}
        loading={intelPending}
        onAskAi={() =>
          dispatchAssistantOpen({
            prompt: "请结合当前市场脉冲、我的持仓和建议配置，解释我下一步应该如何调整仓位。",
            autoSend: true,
          })
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.26fr)_minmax(340px,0.74fr)]">
        {/* ── Action panel ── */}
        <section id="student-action-panel" className="panel min-w-0 rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-6 xl:self-start">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                {/* Round eyebrow → bz-eyebrow pattern */}
                <p className="bz-eyebrow bz-brand-text-on-light">Round {state.run.currentRound}</p>
                {/* 合规（去运气钩子）：连续学习回合数，替代『净值连胜』的追涨诱导（治本②口径，
                    与 quests.ts/pet-rewards.ts 一致）；文案与图标去竞技化。 */}
                {streak.current > 0 ? (
                  <span className="rounded-full bg-brand-subtle px-2.5 py-0.5 text-caption font-semibold text-brand-ink">
                    📚 连续学习 {streak.current} 回合
                  </span>
                ) : null}
              </div>
              {/* Section title → font-semibold (was font-black) */}
              <h2 className="mt-3 text-display-sm font-semibold leading-tight text-fg-strong md:text-display-md">
                {state.market.round.headline}
              </h2>
              <p className="mt-3 text-body leading-8 text-fg-muted">{eventLead}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-caption font-semibold ${
                    state.market.event.signal === "利好"
                      ? "bg-rose-100 text-rose-700"
                      : state.market.event.signal === "利空"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-fg-muted"
                  }`}
                >
                  {state.market.event.signal}
                </span>
                <span className="text-body-sm font-semibold text-fg-strong">{state.market.event.title}</span>
                {state.market.event.teachingConcept && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-caption text-amber-700">
                    本回合知识点 · {state.market.event.teachingConcept}
                  </span>
                )}
              </div>
              {/* v2 信息收敛：教练提示默认收起，需要时再展开（Disclosure 键盘可达） */}
              <Disclosure summary="💡 提示" className="mt-2">
                {eventRest ? <p>{eventRest}</p> : null}
                <p className={eventRest ? "mt-1" : undefined}>{state.market.event.coachingCue}</p>
              </Disclosure>
              {state.market.event.choices?.length ? (
                (() => {
                  const decided = state.run.actionLog.find(
                    (entry) => entry.type === "event" && entry.round === state.run.currentRound,
                  );
                  if (decided) {
                    // red=up positive, green=down negative (Chinese market convention).
                    const tone =
                      decided.amount > 0
                        ? "bg-up-soft text-[var(--up-700)]"
                        : decided.amount < 0
                          ? "bg-down-soft text-[var(--down-700)]"
                          : "bg-slate-100 text-fg-default";
                    return (
                      <div className={`mt-4 rounded-2xl px-4 py-3 ${tone}`}>
                        <p className="text-body-sm font-semibold">{decided.label}</p>
                        <p className="mt-1 text-caption opacity-80">
                          现金变化 {decided.amount >= 0 ? "+" : ""}
                          {decided.amount.toLocaleString("zh-CN")} · 推进回合后会进入新的局面。
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4">
                      <p className="text-body-sm font-semibold text-amber-800">这是一个决策时刻 — 你会怎么选？</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {state.market.event.choices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            disabled={pending}
                            onClick={() => submitAction({ choiceId: choice.id }, "/api/sim/event-choice")}
                            className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-left transition hover:border-amber-400 disabled:opacity-60"
                          >
                            <span className="block text-body-sm font-semibold text-fg-strong">{choice.label}</span>
                            <span className="mt-0.5 block text-caption leading-5 text-fg-muted">{choice.detail}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>
            <div className="flex flex-col items-stretch gap-2">
              {state.run.currentRound >= state.run.totalRounds ? (
                <a
                  href="/student/history"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 !text-white transition-transform hover:-translate-y-0.5 hover:!text-white"
                >
                  {/* Game over: the 12-round sandbox has a terminus now. White label on a
                      span so the global a{color:inherit} reset doesn't grey it out (#4 audit). */}
                  <span className="inline-flex items-center text-body font-semibold text-white">
                    本局已结束 · 查看复盘结算
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submitAction(undefined, "/api/sim/advance-round")}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-body font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  推进下一回合
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              )}
              {canReplay ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm("开启新赛季会用全新行情重新开局，当前进度将被替换。确定吗？")
                    ) {
                      submitAction(undefined, "/api/sim/replay");
                    }
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#f0c89a] bg-[#fff7ee] px-4 text-body-sm font-semibold text-[#b96621] transition-colors hover:bg-[#ffeede] disabled:opacity-60"
                >
                  🔄 新赛季（高级版）
                </button>
              ) : null}
            </div>
          </div>

          {adaptiveEvents.length > 0 ? (
            <div className="mt-5 space-y-2">
              {adaptiveEvents.map((adaptive) => {
                const tone =
                  adaptive.tone === "warning"
                    ? "border-amber-300 bg-amber-50"
                    : adaptive.tone === "positive"
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-sky-300 bg-sky-50";
                return (
                  <div key={adaptive.id} className={`rounded-2xl border px-4 py-3 ${tone}`}>
                    <p className="text-body-sm font-semibold text-fg-strong">{adaptive.title}</p>
                    <p className="mt-1 text-body-sm leading-6 text-fg-muted">{adaptive.message}</p>
                    {/* v2 信息收敛：teachingPoint 默认收起为「💡提示」，展开才读长解说 */}
                    {/* 审查 #5：循环内固定 summary，用干预事件标题区分可访问名（WCAG 2.4.6） */}
                    <Disclosure
                      summary="💡 提示"
                      srContext={adaptive.title}
                      className="mt-1"
                      summaryClassName="py-1 text-caption"
                      panelClassName="text-caption leading-5"
                    >
                      {adaptive.teachingPoint}
                    </Disclosure>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Asset cards */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {state.market.assets.map((asset) => {
              const move = getMarketMoveClasses(asset.dayChange);
              const active = tradeForm.assetId === asset.id;
              return (
                <div
                  key={asset.id}
                  className={cn(
                    "min-w-0 rounded-[1.5rem] border p-4 text-left transition-all duration-200",
                    active
                      ? "border-orange-400 bg-orange-50 shadow-[0_18px_42px_rgba(240,138,56,0.18)]"
                      : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-white",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setTradeForm((current) => ({ ...current, assetId: asset.id }))}
                    className="block w-full rounded-[1.2rem] text-left focus:outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    <div className="min-w-0">
                      {/* Title on its own full-width line so it stays on ONE line
                          (no competing with the change badge, no mid-word "ETF" break). */}
                      <p className="truncate text-body font-semibold text-fg-strong">{asset.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-caption uppercase tracking-[0.18em] text-fg-muted">
                          {asset.symbol}
                        </p>
                        {/* text-up / text-down tokens preserved — Chinese convention */}
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold", move.badge)}>
                          {formatPercent(asset.dayChange)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-h2 tabular-nums text-fg-strong">
                      <MoneyText>{formatCurrency(asset.currentPrice)}</MoneyText>
                    </p>
                    <p className="mt-2 line-clamp-2 text-body-sm leading-6 text-fg-muted">{asset.description}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatchAssistantOpen({
                        prompt: `请帮我分析当前这只资产 ${asset.name}（${asset.symbol}）的风险、仓位和下一步观察点。`,
                        assetId: asset.id,
                      });
                    }}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-body-sm font-semibold text-fg-muted transition-colors hover:border-orange-400 hover:text-orange-700"
                  >
                    <MessageSquareQuote className="h-4 w-4" />
                    询问 AI
                  </button>
                </div>
              );
            })}
          </div>

          {/* Action tabs */}
          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              {actionTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-left transition-colors",
                    activeTab === tab.id ? "bg-white shadow-sm" : "hover:bg-white/70",
                  )}
                >
                  <span className="block text-body font-semibold text-fg-strong">{tab.label}</span>
                  <span className="mt-1 block text-caption text-fg-muted">{tab.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Action form area */}
          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
            {activeTab === "trade" ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-body-sm font-semibold text-fg-muted">方向</span>
                    <select
                      value={tradeForm.side}
                      onChange={(event) =>
                        setTradeForm((current) => ({ ...current, side: event.target.value as TradeForm["side"] }))
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-body font-semibold outline-none focus:border-orange-400"
                    >
                      <option value="buy">买入</option>
                      <option value="sell">卖出</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-body-sm font-semibold text-fg-muted">订单模式</span>
                    <select
                      value={tradeForm.orderMode}
                      onChange={(event) =>
                        setTradeForm((current) => ({ ...current, orderMode: event.target.value as TradeForm["orderMode"] }))
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-body font-semibold outline-none focus:border-orange-400"
                    >
                      <option value="market">市价</option>
                      <option value="limit">限价</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-body-sm font-semibold text-fg-muted">数量</span>
                    <input
                      type="number"
                      min={1}
                      value={tradeForm.quantity}
                      onChange={(event) =>
                        setTradeForm((current) => ({ ...current, quantity: Number(event.target.value) }))
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-body font-semibold outline-none focus:border-orange-400"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={pending || !selectedAsset}
                  onClick={() =>
                    submitAction({
                      type: "trade",
                      assetId: tradeForm.assetId,
                      side: tradeForm.side,
                      quantity: tradeForm.quantity,
                      orderMode: tradeForm.orderMode,
                    })
                  }
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-400 px-5 text-body font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  提交{tradeForm.side === "buy" ? "买入" : "卖出"}指令
                </button>
              </div>
            ) : null}

            {activeTab === "bank" ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-body-sm font-semibold text-fg-muted">金额</span>
                  <input
                    type="number"
                    min={1000}
                    value={bankAmount}
                    onChange={(event) => setBankAmount(Number(event.target.value))}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-body font-semibold outline-none focus:border-orange-400"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "转入储蓄", payload: { type: "bank", action: "deposit", amount: bankAmount } },
                    { label: "提取储蓄", payload: { type: "bank", action: "withdraw", amount: bankAmount } },
                    { label: "申请贷款", payload: { type: "bank", action: "loan", amount: bankAmount } },
                    { label: "偿还贷款", payload: { type: "bank", action: "repay", amount: bankAmount } },
                  ].map(({ label, payload }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={pending}
                      onClick={() => submitAction(payload)}
                      className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-body font-semibold text-fg-strong transition-colors hover:border-orange-300 disabled:opacity-60"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === "property" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "买入一套模拟房产", payload: { type: "property", action: "buy" } },
                  { label: "出售一套模拟房产", payload: { type: "property", action: "sell" } },
                ].map(({ label, payload }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={pending}
                    onClick={() => submitAction(payload)}
                    className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-body font-semibold text-fg-strong transition-colors hover:border-orange-300 disabled:opacity-60"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {activeTab === "venture" ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-body-sm font-semibold text-fg-muted">创业投入金额</span>
                  <input
                    type="number"
                    min={2000}
                    value={ventureAmount}
                    onChange={(event) => setVentureAmount(Number(event.target.value))}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-body font-semibold outline-none focus:border-orange-400"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "投入创业", payload: { type: "venture", action: "invest", amount: ventureAmount } },
                    { label: "退出创业", payload: { type: "venture", action: "exit" } },
                  ].map(({ label, payload }) => (
                    <button
                      key={label}
                      type="button"
                      disabled={pending}
                      onClick={() => submitAction(payload)}
                      className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-body font-semibold text-fg-strong transition-colors hover:border-orange-300 disabled:opacity-60"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {message ? (
            <div
              role="status"
              className="mt-5 rounded-[1.5rem] border border-orange-200 bg-orange-50 px-4 py-3 text-body-sm font-semibold text-orange-700"
            >
              {message}
            </div>
          ) : null}
        </section>

        {/* ── Side panels: holdings + action log ── */}
        <aside className="min-w-0 space-y-6">
          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                {/* Eyebrow on light panel → bz-eyebrow */}
                <p className="bz-eyebrow bz-brand-text-on-light">Holdings</p>
                <h3 className="mt-2 text-h1 font-semibold text-fg-strong">持仓与现金温度</h3>
              </div>
              <Sparkles className="h-5 w-5 text-brand" />
            </div>
            <div className="mt-5 space-y-3">
              {holdingsRows.length > 0 ? (
                holdingsRows.map((row) => (
                  <div key={row.asset.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-body font-semibold text-fg-strong">{row.asset.name}</p>
                        <p className="mt-1 text-caption uppercase tracking-[0.18em] text-fg-muted">
                          {row.asset.symbol} · {row.quantity} 份
                        </p>
                      </div>
                      {/* text-up/text-down preserved — Chinese convention red=up, green=down */}
                      <p className={cn("shrink-0 whitespace-nowrap text-body-sm font-semibold", getMarketMoveClasses(row.pnl).text)}>
                        {formatCurrency(row.pnl)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-body-sm text-fg-muted">
                      <span>市值</span>
                      <MoneyText>{formatCurrency(row.value)}</MoneyText>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-body text-fg-muted">
                  暂无持仓。可以先观察资产卡，再用交易面板提交模拟指令。
                </div>
              )}
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 sm:p-6">
            {/* Eyebrow on light panel → bz-eyebrow */}
            <p className="bz-eyebrow bz-brand-text-on-light">Timeline</p>
            <h3 className="mt-2 text-h1 font-semibold text-fg-strong">最近操作流</h3>
            <div className="mt-5 space-y-3">
              {recentActions.length > 0 ? (
                recentActions.map((entry) => (
                  <div key={entry.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-body font-semibold text-fg-strong">{entry.label}</p>
                        <p className="mt-1 text-body-sm text-fg-muted">
                          第 {entry.round} 回合 · {readableActionTypeLabel[entry.type]} · {actionDirection(entry.amount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          dispatchAssistantOpen({
                            prompt: `请帮我复盘这笔历史操作“${entry.label}”，它在当前回合是否合理？`,
                            actionLogId: entry.id,
                          })
                        }
                        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-body-sm font-semibold text-fg-muted transition-colors hover:border-orange-400 hover:text-orange-700"
                      >
                        问 AI
                      </button>
                    </div>
                    {entry.amount !== 0 ? (
                      <p className="mt-3 text-body font-semibold text-orange-700">
                        <MoneyText>{formatCurrency(entry.amount)}</MoneyText>
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-body text-fg-muted">
                  推进或提交操作后，这里会形成可复盘的行动链。
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* ── AI tutor + leaderboard ── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {/* Eyebrow on light panel → bz-eyebrow */}
              <p className="bz-eyebrow bz-brand-text-on-light">KeyAI / Mr.Brown</p>
              <h2 className="mt-3 text-display-sm font-semibold text-fg-strong md:text-display-md">实时导师点评</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                dispatchAssistantOpen({
                  prompt: "请结合我当前仓位、现金流和学习榜位置，给我下一回合建议。",
                  autoSend: true,
                })
              }
              className="inline-flex min-h-12 items-center rounded-full border border-slate-200 bg-white px-4 text-body font-semibold text-fg-muted transition-colors hover:border-orange-400 hover:text-orange-700"
            >
              获取 AI 复盘
            </button>
          </div>
          <div className="mt-6 rounded-[2rem] bg-slate-950 p-6 text-white">
            <p className="text-body leading-8 text-white/76">
              {state.run.lastInsight ?? "等待新的回合总结。当前建议先看风险、现金垫和单一资产集中度，再决定是否行动。"}
            </p>
          </div>
          <div className="mt-5">
            <StudentTutorRadar
              payload={tutorRadar}
              persona={persona}
              personaShareText={persona ? buildPersonaShareText(persona, state.run) : undefined}
              loading={radarPending}
              onRefresh={() => {
                void loadTutorRadarForState(state);
              }}
            />
            <SeasonLeaderboard />
            <PowerRankTeaser />
          </div>
        </section>

        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          {/* Eyebrow on light panel → bz-eyebrow */}
          <p className="bz-eyebrow bz-brand-text-on-light">Leaderboard</p>
          <h2 className="mt-3 text-display-sm font-semibold text-fg-strong">学习榜与当前位置</h2>
          <div className="mt-5 space-y-3">
            {topLeaderboard.map((entry) => {
              const isCurrentUser = entry.userId === state.user.id;
              return (
                <div
                  key={`${entry.userId}-${entry.rank}`}
                  className={cn(
                    "rounded-[1.5rem] border p-4 transition-colors",
                    isCurrentUser ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-slate-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-fg-strong">
                        #{entry.rank} {entry.name}
                      </p>
                      <p className="mt-1 text-body-sm text-fg-muted">纪律分 {entry.disciplineScore}</p>
                    </div>
                    <p className="text-body font-semibold text-orange-700">
                      <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {topLeaderboard.every((entry) => entry.userId !== state.user.id) ? (
            <div className="mt-4 rounded-[1.5rem] border border-orange-400 bg-orange-50 p-4">
              <p className="text-body font-semibold text-fg-strong">我的当前位置：#{rank}</p>
              <p className="mt-1 text-body-sm text-fg-muted">继续提高纪律分和现金垫，排名会更稳。</p>
            </div>
          ) : null}
        </section>
      </div>

    </div>
  );
}
