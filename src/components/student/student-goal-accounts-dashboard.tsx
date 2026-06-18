"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2, Flag, Loader2, PiggyBank, Target, WalletCards } from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { GoalAccountId, GoalAccountPayload } from "@/lib/goal-accounts";
import { cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type MessageState = { tone: "success" | "error"; text: string } | null;

const statusLabel: Record<GoalAccountPayload["goals"][number]["status"], string> = {
  ahead: "节奏领先",
  on_track: "节奏正常",
  needs_attention: "需要补进度",
};

const statusClass: Record<GoalAccountPayload["goals"][number]["status"], string> = {
  ahead: "bg-down-soft text-[var(--down-700)]",
  on_track: "bg-brand-soft text-brand",
  needs_attention: "bg-warning/10 text-warning",
};

export function StudentGoalAccountsDashboard({ initialPayload }: { initialPayload: GoalAccountPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [goalId, setGoalId] = useState<GoalAccountId>(initialPayload.selectedGoalId);
  const selectedGoal = payload.goals.find((goal) => goal.id === goalId) ?? payload.goals[0];
  const [amount, setAmount] = useState(selectedGoal?.suggestedRoundContribution ?? 800);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<MessageState>(null);
  const [pending, startTransition] = useTransition();

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-goal-reveal]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-goal-reveal]", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
      });
    },
    { scope: rootRef },
  );

  function selectGoal(nextGoalId: GoalAccountId) {
    const goal = payload.goals.find((item) => item.id === nextGoalId);
    setGoalId(nextGoalId);
    if (goal) setAmount(goal.suggestedRoundContribution);
  }

  function submitGoalTransfer() {
    setMessage(null);
    startTransition(() => {
      void fetch("/api/student/goal-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goalId, amount, note }),
      })
        .then(async (response) => {
          const data = (await response.json()) as { payload?: GoalAccountPayload; message?: string; error?: string };
          if (!response.ok || !data.payload) {
            throw new Error(data.message ?? "目标账户更新失败，请稍后重试。");
          }
          setPayload(data.payload);
          setNote("");
          setMessage({ tone: "success", text: data.message ?? "目标账户已更新。" });
        })
        .catch((error) => {
          setMessage({
            tone: "error",
            text: error instanceof Error ? error.message : "目标账户更新失败，请稍后再试。",
          });
        });
    });
  }

  return (
    <div ref={rootRef} className="space-y-6 pb-24">
      <section
        data-goal-reveal
        data-motion-reveal
        className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] md:p-8"
      >
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300">Goal Accounts</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
              目标账户：把未来想要的东西拆成今天的小动作
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">{payload.overview.learningPrompt}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <HeroMetric label="目标分" value={payload.overview.goalScore} />
            <HeroMetric
              label="已 earmark"
              value={<MoneyText tone="dark">{formatCurrency(payload.overview.earmarkedTotal)}</MoneyText>}
            />
            <HeroMetric
              label="可用现金"
              value={<MoneyText tone="dark">{formatCurrency(payload.overview.availableCash)}</MoneyText>}
            />
            <HeroMetric label="阶段" value={payload.overview.stageLabel} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section data-goal-reveal data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">我的生活目标</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">
              投资服务于目标，不反过来绑架生活
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {payload.goals.map((goal) => (
              <button
                data-motion-card
                key={goal.id}
                type="button"
                onClick={() => selectGoal(goal.id)}
                className={cn(
                  "rounded-[1.6rem] border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg",
                  goal.id === goalId ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-slate-950">{goal.title}</p>
                    <p className="mt-1 text-sm font-bold text-slate-600">{goal.concept}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-black", statusClass[goal.status])}>
                    {statusLabel[goal.status]}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">{goal.whyItMatters}</p>
                <div className="mt-5">
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-3xl font-black text-slate-950">{goal.progress}%</span>
                    <span className="text-sm font-bold text-slate-600">
                      <MoneyText>{formatCurrency(goal.saved)}</MoneyText> / <MoneyText>{formatCurrency(goal.target)}</MoneyText>
                    </span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside data-goal-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">转入目标账户</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              这一步会把现金转入储蓄目标桶，净值不变，但“可随手花的钱”会减少。
            </p>

            <label className="mt-5 block text-sm font-black text-slate-700" htmlFor="goal-amount">
              本回合转入金额
            </label>
            <input
              id="goal-amount"
              type="number"
              min={100}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-lg font-black text-slate-950 outline-none focus:border-orange-300"
            />

            <label className="mt-4 block text-sm font-black text-slate-700" htmlFor="goal-note">
              一句话理由
            </label>
            <textarea
              id="goal-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：这笔钱先留给电脑基金，不参与本回合高波动机会。"
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700 outline-none focus:border-orange-300"
            />

            <button
              data-motion-button
              type="button"
              onClick={submitGoalTransfer}
              disabled={pending}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-base font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <WalletCards className="h-5 w-5" />}
              记录目标转入
            </button>
            {message ? (
              <p
                className={cn(
                  "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
                  message.tone === "success" ? "bg-down-soft text-[var(--down-700)]" : "bg-error-soft text-error",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </section>

          <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-200">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-300" />
              <h2 className="text-xl font-black">{payload.coach.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-7 text-white/68">{payload.coach.summary}</p>
            <div className="mt-4 space-y-3">
              {payload.coach.nextSteps.map((step) => (
                <div key={step} className="flex gap-3 rounded-2xl bg-white/[0.06] p-3 text-sm leading-6 text-white/78">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section data-goal-reveal data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
        <h2 className="text-2xl font-black text-slate-950">目标账户记录</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {payload.history.length > 0 ? (
            payload.history.slice(0, 6).map((entry) => (
              <article key={entry.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <p className="text-lg font-black text-slate-950">{entry.title}</p>
                <p className="mt-1 text-sm font-bold text-orange-500">{formatCurrency(entry.amount)}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{entry.note}</p>
              </article>
            ))
          ) : (
            <p className="rounded-[1.35rem] bg-slate-50 p-5 text-sm font-bold text-slate-600">
              还没有目标账户记录。先选一个真实生活目标，写下为什么要为它留钱。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-black text-orange-100">{value}</p>
    </div>
  );
}
