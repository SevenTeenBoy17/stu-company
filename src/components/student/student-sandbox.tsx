"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { MessageSquareQuote } from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import { StudentAllocationPanel } from "@/components/student/student-allocation-panel";
import { StudentTutorRadar } from "@/components/student/student-tutor-radar";
import { dispatchAssistantOpen } from "@/lib/assistant-config";
import { MARKET_REFRESH_INTERVAL_MS } from "@/lib/market-refresh";
import { buildPortfolioIntel } from "@/lib/portfolio-intel";
import { buildTutorRadarPayload } from "@/lib/tutor-radar";
import type { PortfolioIntel, SimulationState, TutorRadarPayload } from "@/lib/types";
import { cn, formatCurrency, formatPercent, getMarketMoveClasses } from "@/lib/utils";

type TradeForm = {
  assetId: string;
  side: "buy" | "sell";
  quantity: number;
  orderMode: "market" | "limit";
};

const defaultTrade: TradeForm = {
  assetId: "asset-etf",
  side: "buy",
  quantity: 20,
  orderMode: "market",
};

export function StudentSandbox({ initialState }: { initialState: SimulationState }) {
  const [state, setState] = useState<SimulationState | null>(initialState);
  const [portfolioIntel, setPortfolioIntel] = useState<PortfolioIntel>(() =>
    buildPortfolioIntel(initialState),
  );
  const [tutorRadar, setTutorRadar] = useState<TutorRadarPayload>(() =>
    buildTutorRadarPayload(initialState),
  );
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
    const payload = (await response.json()) as { error?: string; state?: SimulationState };
    if (!response.ok || !payload.state) {
      throw new Error(payload.error ?? "无法读取当前沙盘。");
    }
    setState(payload.state);
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
    const payload = (await response.json()) as { error?: string; state?: SimulationState; message?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "提交失败。");
    }
    if (payload.state) {
      setState(payload.state);
    } else {
      await loadState();
    }
    setMessage(payload.message ?? "操作已更新。");
  }

  const refreshPortfolioIntel = useEffectEvent(async () => {
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

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as PortfolioIntel;
      setPortfolioIntel(payload);
    } catch {
      // 保留本地教学兜底，不让面板因为行情接口抖动而空掉。
    } finally {
      if (!controller.signal.aborted) {
        setIntelPending(false);
      }
    }
  });

  async function loadTutorRadarForState(currentState: SimulationState) {
    setRadarPending(true);
    try {
      const response = await fetch("/api/ai/radar-chart", {
        method: "POST",
        cache: "no-store",
      });
      const payload = (await response.json()) as TutorRadarPayload & { error?: string };

      if (!response.ok || payload.error) {
        setTutorRadar(buildTutorRadarPayload(currentState));
        return;
      }

      setTutorRadar(payload);
    } catch {
      setTutorRadar(buildTutorRadarPayload(currentState));
    } finally {
      setRadarPending(false);
    }
  }

  const refreshTutorRadarOnMount = useEffectEvent(async () => {
    if (!state) return;
    await loadTutorRadarForState(state);
  });

  async function refreshTutorRadar() {
    if (!state) return;
    await loadTutorRadarForState(state);
  }

  useEffect(() => {
    if (!state) return;
    setPortfolioIntel(buildPortfolioIntel(state));
    setTutorRadar(buildTutorRadarPayload(state));
    void refreshPortfolioIntel();
  }, [state]);

  useEffect(() => {
    if (!studentId) return;
    void refreshTutorRadarOnMount();
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;

    const timer = window.setInterval(() => {
      void refreshPortfolioIntel();
    }, MARKET_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [studentId]);

  useEffect(() => {
    return () => {
      refreshControllerRef.current?.abort();
    };
  }, []);

  if (!state) {
    return (
      <div className="panel rounded-[2rem] p-8">
        <p className="text-[15px] font-semibold text-slate-500">正在加载学生沙盘...</p>
      </div>
    );
  }

  const latestSnapshot = state.run.snapshots.at(-1);
  const holdingsValue = state.market.assets.reduce((total, asset) => {
    const holding = state.run.holdings.find((item) => item.assetId === asset.id);
    return total + (holding ? holding.quantity * asset.currentPrice : 0);
  }, 0);

  return (
    <div className="space-y-6 pb-20 sm:pb-24">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "当前净值", value: latestSnapshot ? formatCurrency(latestSnapshot.netWorth) : "--", money: true },
          { label: "可用现金", value: formatCurrency(state.run.cash), money: true },
          { label: "持仓市值", value: formatCurrency(holdingsValue), money: true },
          { label: "风险评分", value: `${latestSnapshot?.riskScore ?? "--"}`, money: false },
        ].map((item) => (
          <div key={item.label} className="panel rounded-[1.8rem] p-5 md:p-6">
            <p className="text-[15px] font-semibold text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950 md:text-[2.2rem]">
              {item.money ? <MoneyText>{item.value}</MoneyText> : item.value}
            </p>
          </div>
        ))}
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6 [&_label>span]:text-[15px] [&_label>span]:font-semibold [&_label>span]:text-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f08a38]">
                回合 {state.run.currentRound}
              </p>
              <h2 className="mt-3 text-[2rem] font-semibold text-slate-950 md:text-[2.25rem]">
                {state.market.round.headline}
              </h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-8 text-slate-600 md:text-base">
                {state.market.event.description}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  void mutate("/api/sim/advance-round");
                })
              }
              className="rounded-full bg-slate-950 px-5 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              推进到下一回合
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.market.assets.map((asset) => (
              <div
                key={asset.id}
                role="button"
                tabIndex={0}
                onClick={() => setTradeForm((current) => ({ ...current, assetId: asset.id }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setTradeForm((current) => ({ ...current, assetId: asset.id }));
                  }
                }}
                className={cn(
                  "rounded-[1.5rem] border p-5 text-left transition-colors",
                  tradeForm.assetId === asset.id
                    ? "border-[#f08a38] bg-[#fff4e9]"
                    : "border-slate-200 bg-slate-950/[0.02]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-slate-950">{asset.name}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {asset.symbol}
                    </p>
                  </div>
                  <span className={cn("text-sm font-semibold", getMarketMoveClasses(asset.dayChange).text)}>
                    {formatPercent(asset.dayChange)}
                  </span>
                </div>
                <p className="mt-3 text-[1.9rem] font-semibold">
                  <MoneyText>{formatCurrency(asset.currentPrice)}</MoneyText>
                </p>
                <p className="mt-2 text-[15px] leading-7 text-slate-600">{asset.description}</p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchAssistantOpen({
                        prompt: `请帮我分析当前这只资产 ${asset.name}（${asset.symbol}）的风险、仓位和下一步观察点。`,
                        assetId: asset.id,
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-[#f08a38] hover:text-[#b96621]"
                  >
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    询问 AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f08a38]">统一操作台</p>
          <h2 className="mt-3 text-[2rem] font-semibold text-slate-950">
            订单、现金流与扩展动作都在这里完成
          </h2>

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-600">方向</span>
                <select
                  value={tradeForm.side}
                  onChange={(event) =>
                    setTradeForm((current) => ({
                      ...current,
                      side: event.target.value as TradeForm["side"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
                >
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-600">订单模式</span>
                <select
                  value={tradeForm.orderMode}
                  onChange={(event) =>
                    setTradeForm((current) => ({
                      ...current,
                      orderMode: event.target.value as TradeForm["orderMode"],
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
                >
                  <option value="market">市价</option>
                  <option value="limit">限价</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-600">数量</span>
              <input
                type="number"
                min={1}
                value={tradeForm.quantity}
                onChange={(event) =>
                  setTradeForm((current) => ({
                    ...current,
                    quantity: Number(event.target.value),
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
              />
            </label>
            <button
              type="button"
              disabled={pending || !selectedAsset}
              onClick={() =>
                startTransition(() => {
                  void mutate("/api/sim/actions", {
                    type: "trade",
                    assetId: tradeForm.assetId,
                    side: tradeForm.side,
                    quantity: tradeForm.quantity,
                    orderMode: tradeForm.orderMode,
                  });
                })
              }
              className="w-full rounded-full bg-[#f08a38] px-5 py-3.5 text-[15px] font-semibold text-slate-950 disabled:opacity-60"
            >
              提交{tradeForm.side === "buy" ? "买入" : "卖出"}指令
            </button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { label: "转入储蓄", payload: { type: "bank", action: "deposit", amount: bankAmount } },
              { label: "提取储蓄", payload: { type: "bank", action: "withdraw", amount: bankAmount } },
              { label: "买入房产", payload: { type: "property", action: "buy" } },
              { label: "投入创业", payload: { type: "venture", action: "invest", amount: ventureAmount } },
            ].map(({ label, payload }) => (
              <button
                key={label}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void mutate("/api/sim/actions", payload);
                  })
                }
                className="rounded-[1.4rem] border border-slate-200 bg-slate-950/[0.03] px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              type="number"
              min={1000}
              value={bankAmount}
              onChange={(event) => setBankAmount(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
            />
            <input
              type="number"
              min={2000}
              value={ventureAmount}
              onChange={(event) => setVentureAmount(Number(event.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#f08a38]"
            />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f08a38]">
                KeyAI / Mr.Brown
              </p>
              <h2 className="mt-3 text-[2rem] font-semibold text-slate-950">实时导师点评</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                dispatchAssistantOpen({
                  prompt: "请结合我当前仓位、现金流和排行榜位置，给我下一回合建议。",
                  autoSend: true,
                })
              }
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              获取 AI 复盘
            </button>
          </div>
          <div className="mt-6 rounded-[1.6rem] bg-slate-950 p-5 text-white">
            <p className="text-sm leading-8 text-white/72">
              {state.run.lastInsight ?? "等待新的回合总结..."}
            </p>
          </div>
          <StudentTutorRadar
            payload={tutorRadar}
            loading={radarPending}
            onRefresh={() => {
              void refreshTutorRadar();
            }}
          />
          {message ? (
            <div className="mt-4 rounded-[1.4rem] bg-[#fff4e9] px-4 py-3 text-sm font-medium text-[#7a4717]">
              {message}
            </div>
          ) : null}
        </section>

        <section className="panel min-w-0 rounded-[2rem] p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f08a38]">班级榜单与操作流</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.6rem] bg-slate-950/[0.03] p-4">
              <h3 className="text-lg font-semibold text-slate-950">班级榜</h3>
              <div className="mt-4 space-y-3">
                {state.leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        #{entry.rank} {entry.name}
                      </p>
                      <p className="text-[15px] font-semibold text-slate-500">纪律分 {entry.disciplineScore}</p>
                    </div>
                    <p className="font-semibold">
                      <MoneyText>{formatCurrency(entry.netWorth)}</MoneyText>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] bg-slate-950/[0.03] p-4">
              <h3 className="text-lg font-semibold text-slate-950">最近动作</h3>
              <div className="mt-4 space-y-3">
                {state.run.actionLog.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{entry.label}</p>
                        <p className="mt-1 text-[15px] font-semibold text-slate-500">
                          第 {entry.round} 回合 ·{" "}
                          {entry.amount !== 0 ? <MoneyText>{formatCurrency(entry.amount)}</MoneyText> : "节奏推进"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          dispatchAssistantOpen({
                            prompt: `请帮我复盘这笔动作“${entry.label}”，它在当前回合是否合理？`,
                            actionLogId: entry.id,
                          })
                        }
                        className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-[#f08a38] hover:text-[#b96621]"
                      >
                        问 AI
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
