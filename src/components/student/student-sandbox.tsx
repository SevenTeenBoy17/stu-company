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

import { MoneyText } from "@/components/shared/money-text";
import { SeasonLeaderboard } from "@/components/student/season-leaderboard";
import { StudentAllocationPanel } from "@/components/student/student-allocation-panel";
import { StudentTutorRadar } from "@/components/student/student-tutor-radar";
import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { buildPortfolioIntel } from "@/lib/portfolio-intel";
import type { AdaptiveEvent } from "@/lib/adaptive-events";
import { buildPersonaShareText, computeStreak } from "@/lib/simulation";
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

const actionTypeLabel: Record<ActionLog["type"], string> = {
  trade: "交易",
  bank: "现金流",
  property: "房产",
  venture: "创业",
  advance: "回合推进",
  event: "事件决策",
};

function actionDirection(amount: number) {
  if (amount > 0) return "流入";
  if (amount < 0) return "流出";
  return "记录";
}

function currentRank(state: SimulationState) {
  return state.leaderboard.find((entry) => entry.userId === state.user.id)?.rank ?? state.leaderboard.length;
}

export function StudentSandbox({ initialState }: { initialState: SimulationState }) {
  const [state, setState] = useState<SimulationState | null>(initialState);
  const [portfolioIntel, setPortfolioIntel] = useState<PortfolioIntel>(() =>
    buildPortfolioIntel(initialState),
  );
  const [tutorRadar, setTutorRadar] = useState<TutorRadarPayload>(() =>
    buildTutorRadarPayload(initialState),
  );
  // Premium surfacing: investor-personality card (deepAiReport) + season replay.
  const [persona, setPersona] = useState<InvestorPersona | null>(null);
  const [canReplay, setCanReplay] = useState(false);
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
      throw new Error(payload.message ?? payload.error ?? "无法读取当前沙盘。");
    }
    setState(payload.state);
    setAdaptiveEvents(payload.adaptiveEvents ?? []);
  }

  const selectedAsset = useMemo(
    () => state?.market.assets.find((asset) => asset.id === tradeForm.assetId) ?? state?.market.assets[0],
    [state, tradeForm.assetId],
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
      throw new Error(payload.message ?? payload.error ?? "提交失败。");
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

  async function loadTutorRadarForState(currentState: SimulationState) {
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
      await loadTutorRadarForState(state);
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
    void refreshPortfolioIntel();
  }, [state, refreshPortfolioIntel]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { features?: { seasonReplay?: boolean } } | null) => {
        if (alive && data?.features) setCanReplay(Boolean(data.features.seasonReplay));
      })
      .catch(() => {
        // Replay is a premium extra; absence just hides the button.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (studentId) {
      void refreshTutorRadarOnMount();
    }
  }, [studentId, refreshTutorRadarOnMount]);

  useEffect(() => {
    if (!studentId) return;
    const timer = window.setInterval(() => void refreshPortfolioIntel(), MARKET_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [studentId, refreshPortfolioIntel]);

  useEffect(() => {
    return () => refreshControllerRef.current?.abort();
  }, []);

  if (!state) {
    return (
      <div className="panel rounded-[2rem] p-8">
        <p className="text-base font-semibold text-slate-500">正在加载学生沙盘...</p>
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
  const recentActions = state.run.actionLog.slice().reverse().slice(0, 7);
  const topLeaderboard = state.leaderboard.slice(0, 5);

  const heroMetrics = [
    {
      label: "当前净值",
      value: formatCurrency(netWorth),
      meta: netWorthDelta === 0 ? "本回合保持观察" : `较上回合 ${formatCurrency(netWorthDelta)}`,
      icon: WalletCards,
      money: true,
    },
    { label: "可用现金", value: formatCurrency(state.run.cash), meta: "行动前先留安全垫", icon: Landmark, money: true },
    {
      label: "持仓市值",
      value: formatCurrency(holdingsValue),
      meta: `${holdingsRows.length} 个资产正在观察`,
      icon: LineChart,
      money: true,
    },
    { label: "班级排名", value: `#${rank}`, meta: state.classroom.name, icon: Trophy, money: false },
    {
      label: "风险评分",
      value: `${latestSnapshot?.riskScore ?? "--"}`,
      meta: `纪律分 ${latestSnapshot?.disciplineScore ?? "--"}`,
      icon: ShieldCheck,
      money: false,
    },
  ];

  const submitAction = (body?: object, url = "/api/sim/actions") => {
    startTransition(() => {
      void mutate(url, body).catch((error) => {
        setMessage(error instanceof Error ? error.message : "操作失败，请稍后再试。");
      });
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {heroMetrics.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="panel min-w-0 overflow-hidden rounded-[1.65rem] p-4 transition-transform hover:-translate-y-1 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="min-w-0 text-base font-bold text-slate-500">{item.label}</p>
                <span className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-orange-500">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 max-w-full overflow-hidden text-[clamp(2rem,2vw,2.65rem)] font-black leading-none tracking-tight text-slate-950">
                {item.money ? <MoneyText>{item.value}</MoneyText> : item.value}
              </p>
              <p className="mt-3 line-clamp-2 min-w-0 text-sm font-semibold leading-6 text-slate-500">{item.meta}</p>
            </div>
          );
        })}
      </section>

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
        <section id="student-action-panel" className="panel min-w-0 rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-6 xl:self-start">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Round {state.run.currentRound}</p>
                {computeStreak(state.run).current > 0 ? (
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                    🔥 连胜 {computeStreak(state.run).current} 回合
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 md:text-4xl">
                {state.market.round.headline}
              </h2>
              <p className="mt-3 text-base leading-8 text-slate-600">{state.market.event.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    state.market.event.signal === "利好"
                      ? "bg-rose-100 text-rose-700"
                      : state.market.event.signal === "利空"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {state.market.event.signal}
                </span>
                <span className="text-sm font-bold text-slate-900">{state.market.event.title}</span>
                {state.market.event.teachingConcept && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    本回合知识点 · {state.market.event.teachingConcept}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-500">{state.market.event.coachingCue}</p>
              {state.market.event.choices?.length ? (
                (() => {
                  const decided = state.run.actionLog.find(
                    (entry) => entry.type === "event" && entry.round === state.run.currentRound,
                  );
                  if (decided) {
                    return (
                      <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">{decided.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          现金变化 {decided.amount >= 0 ? "+" : ""}
                          {decided.amount.toLocaleString()} · 推进回合后会进入新的局面。
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4">
                      <p className="text-sm font-bold text-amber-800">这是一个决策时刻 — 你会怎么选？</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {state.market.event.choices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            disabled={pending}
                            onClick={() => submitAction({ choiceId: choice.id }, "/api/sim/event-choice")}
                            className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-left transition hover:border-amber-400 disabled:opacity-60"
                          >
                            <span className="block text-sm font-bold text-slate-900">{choice.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-slate-500">{choice.detail}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </div>
            <div className="flex flex-col items-stretch gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => submitAction(undefined, "/api/sim/advance-round")}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                推进下一回合
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
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
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#f0c89a] bg-[#fff7ee] px-4 text-sm font-bold text-[#b96621] transition-colors hover:bg-[#ffeede] disabled:opacity-60"
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
                    <p className="text-sm font-bold text-slate-900">{adaptive.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{adaptive.message}</p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-500">💡 {adaptive.teachingPoint}</p>
                  </div>
                );
              })}
            </div>
          ) : null}

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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-950">{asset.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{asset.symbol}</p>
                      </div>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", move.badge)}>
                        {formatPercent(asset.dayChange)}
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-black text-slate-950">
                      <MoneyText>{formatCurrency(asset.currentPrice)}</MoneyText>
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{asset.description}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatchAssistantOpen({
                        prompt: `请帮我分析当前这只资产 ${asset.name}（${asset.symbol}）的风险、仓位和下一步观察点。`,
                        assetId: asset.id,
                      });
                    }}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-600 transition-colors hover:border-orange-400 hover:text-orange-700"
                  >
                    <MessageSquareQuote className="h-4 w-4" />
                    询问 AI
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              {actionTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-left transition-colors",
                    activeTab === tab.id ? "bg-white shadow-sm" : "hover:bg-white/70",
                  )}
                >
                  <span className="block text-base font-black text-slate-950">{tab.label}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-400">{tab.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
            {activeTab === "trade" ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">方向</span>
                    <select
                      value={tradeForm.side}
                      onChange={(event) =>
                        setTradeForm((current) => ({ ...current, side: event.target.value as TradeForm["side"] }))
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-orange-400"
                    >
                      <option value="buy">买入</option>
                      <option value="sell">卖出</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">订单模式</span>
                    <select
                      value={tradeForm.orderMode}
                      onChange={(event) =>
                        setTradeForm((current) => ({ ...current, orderMode: event.target.value as TradeForm["orderMode"] }))
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-orange-400"
                    >
                      <option value="market">市价</option>
                      <option value="limit">限价</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-600">数量</span>
                    <input
                      type="number"
                      min={1}
                      value={tradeForm.quantity}
                      onChange={(event) =>
                        setTradeForm((current) => ({ ...current, quantity: Number(event.target.value) }))
                      }
                      className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-orange-400"
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
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-orange-400 px-5 text-base font-black text-slate-950 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                >
                  提交{tradeForm.side === "buy" ? "买入" : "卖出"}指令
                </button>
              </div>
            ) : null}

            {activeTab === "bank" ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">金额</span>
                  <input
                    type="number"
                    min={1000}
                    value={bankAmount}
                    onChange={(event) => setBankAmount(Number(event.target.value))}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-orange-400"
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
                      className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-950 transition-colors hover:border-orange-300 disabled:opacity-60"
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
                    className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-950 transition-colors hover:border-orange-300 disabled:opacity-60"
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {activeTab === "venture" ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-600">创业投入金额</span>
                  <input
                    type="number"
                    min={2000}
                    value={ventureAmount}
                    onChange={(event) => setVentureAmount(Number(event.target.value))}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-orange-400"
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
                      className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-950 transition-colors hover:border-orange-300 disabled:opacity-60"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {message ? (
            <div className="mt-5 rounded-[1.5rem] border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">
              {message}
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-6">
          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Holdings</p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">持仓与现金温度</h3>
              </div>
              <Sparkles className="h-5 w-5 text-orange-500" />
            </div>
            <div className="mt-5 space-y-3">
              {holdingsRows.length > 0 ? (
                holdingsRows.map((row) => (
                  <div key={row.asset.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-950">{row.asset.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          {row.asset.symbol} · {row.quantity} 份
                        </p>
                      </div>
                      <p className={cn("text-sm font-black", getMarketMoveClasses(row.pnl).text)}>
                        {formatCurrency(row.pnl)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm font-bold text-slate-500">
                      <span>市值</span>
                      <MoneyText>{formatCurrency(row.value)}</MoneyText>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-base font-semibold text-slate-500">
                  暂无持仓。可以先观察资产卡，再用交易面板提交模拟指令。
                </div>
              )}
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Timeline</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">最近操作流</h3>
            <div className="mt-5 space-y-3">
              {recentActions.length > 0 ? (
                recentActions.map((entry) => (
                  <div key={entry.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-base font-black text-slate-950">{entry.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          第 {entry.round} 回合 · {actionTypeLabel[entry.type]} · {actionDirection(entry.amount)}
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
                        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition-colors hover:border-orange-400 hover:text-orange-700"
                      >
                        问 AI
                      </button>
                    </div>
                    {entry.amount !== 0 ? (
                      <p className="mt-3 text-base font-black text-orange-700">
                        <MoneyText>{formatCurrency(entry.amount)}</MoneyText>
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-base font-semibold text-slate-500">
                  推进或提交操作后，这里会形成可复盘的行动链。
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">KeyAI / Mr.Brown</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 md:text-4xl">实时导师点评</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                dispatchAssistantOpen({
                  prompt: "请结合我当前仓位、现金流和排行榜位置，给我下一回合建议。",
                  autoSend: true,
                })
              }
              className="inline-flex min-h-12 items-center rounded-full border border-slate-200 bg-white px-4 text-base font-bold text-slate-600 transition-colors hover:border-orange-400 hover:text-orange-700"
            >
              获取 AI 复盘
            </button>
          </div>
          <div className="mt-6 rounded-[2rem] bg-slate-950 p-6 text-white">
            <p className="text-base leading-8 text-white/76">
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
          </div>
        </section>

        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Leaderboard</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">排行榜与当前位置</h2>
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
                      <p className="text-lg font-black text-slate-950">
                        #{entry.rank} {entry.name}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">纪律分 {entry.disciplineScore}</p>
                    </div>
                    <p className="text-lg font-black text-orange-700">
                      <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {topLeaderboard.every((entry) => entry.userId !== state.user.id) ? (
            <div className="mt-4 rounded-[1.5rem] border border-orange-400 bg-orange-50 p-4">
              <p className="text-base font-black text-slate-950">我的当前位置：#{rank}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">继续提高纪律分和现金垫，排名会更稳。</p>
            </div>
          ) : null}
        </section>
      </div>

    </div>
  );
}
