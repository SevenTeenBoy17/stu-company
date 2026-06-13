"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { QuestClaimResult, StudentQuestPayload, StudentQuestStatus } from "@/lib/quests";
import { cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type QuestFilter = "all" | "active" | "done" | "watch";

const filterLabels: Array<{ id: QuestFilter; label: string }> = [
  { id: "all", label: "全部任务" },
  { id: "active", label: "进行中" },
  { id: "done", label: "已完成" },
  { id: "watch", label: "需观察" },
];

const statusMeta: Record<
  StudentQuestStatus,
  {
    label: string;
    icon: typeof CircleDot;
    className: string;
  }
> = {
  done: {
    label: "已完成",
    icon: CheckCircle2,
    className: "bg-down-soft text-down",
  },
  active: {
    label: "进行中",
    icon: CircleDot,
    className: "bg-brand-soft text-brand-ink",
  },
  watch: {
    label: "需观察",
    icon: Clock3,
    className: "bg-warning/10 text-warning",
  },
  locked: {
    label: "待解锁",
    icon: Lock,
    className: "bg-slate-100 text-slate-500",
  },
};

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QuestStatusBadge({ status }: { status: StudentQuestStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function StudentQuestDashboard({ payload }: { payload: StudentQuestPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [questPayload, setQuestPayload] = useState(payload);
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<QuestClaimResult | null>(null);
  const [claimError, setClaimError] = useState("");

  useGSAP(
    () => {
      gsap.from("[data-quest-reveal]", {
        y: 20,
        opacity: 0,
        duration: 0.62,
        ease: "power3.out",
        stagger: 0.055,
      });
      gsap.from("[data-calendar-cell]", {
        scale: 0.86,
        opacity: 0,
        duration: 0.5,
        ease: "back.out(1.4)",
        stagger: 0.025,
      });
    },
    { scope: rootRef },
  );

  const visibleQuests = useMemo(() => {
    if (filter === "all") return questPayload.quests;
    if (filter === "done") return questPayload.quests.filter((quest) => quest.status === "done");
    if (filter === "watch") {
      return questPayload.quests.filter((quest) => quest.status === "watch" || quest.status === "locked");
    }
    return questPayload.quests.filter((quest) => quest.status === "active");
  }, [filter, questPayload.quests]);

  const completionRate =
    questPayload.overview.total > 0 ? questPayload.overview.completed / questPayload.overview.total : 0;

  async function claimQuest(questId: string) {
    setClaimingQuestId(questId);
    setClaimError("");
    try {
      const response = await fetch("/api/student/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      });
      const data = (await response.json()) as {
        payload?: StudentQuestPayload;
        claimed?: QuestClaimResult;
        message?: string;
      };
      if (!response.ok || !data.payload || !data.claimed) {
        throw new Error(data.message || "任务奖励领取失败，请稍后再试。");
      }
      setQuestPayload(data.payload);
      setClaimResult(data.claimed);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "任务奖励领取失败，请稍后再试。");
    } finally {
      setClaimingQuestId(null);
    }
  }

  return (
    <div ref={rootRef} className="space-y-6">
      <section data-quest-reveal className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft">
        <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Quest Hub</p>
            <h1 className="mt-3 max-w-3xl text-display-lg font-semibold md:text-display-xl">
              把理财好习惯变成可完成的任务
            </h1>
            <p className="mt-4 max-w-3xl text-body-lg leading-8 text-white/68">
              这里不会直接给战力加分，而是把你的学习、交易、现金管理和复盘行为变成可见目标。好任务让你知道下一步练什么，也让每次打开沙盘都有明确方向。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">任务完成度</p>
                <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                  {questPayload.overview.completed}/{questPayload.overview.total}
                </p>
                <div className="mt-4 h-2.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-up"
                    style={{ width: `${Math.max(6, completionRate * 100)}%` }}
                  />
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">净值连升</p>
                <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                  {questPayload.overview.streakCurrent}
                  <span className="mx-2 text-h2 text-white/28">/</span>
                  {questPayload.overview.streakBest}
                </p>
                <p className="mt-3 text-sm text-white/58">当前 / 历史最佳连续回合</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">学习进度</p>
                <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                  {questPayload.overview.learningCompleted}
                  <span className="mx-2 text-h2 text-white/28">/</span>
                  {questPayload.overview.learningTotal}
                </p>
                <p className="mt-3 text-sm text-white/58">课程模块完成数</p>
              </div>
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-warm">Mr.Brown</p>
                <h2 className="mt-3 text-h1 font-semibold text-white">{questPayload.coach.title}</h2>
              </div>
              <Sparkles className="h-6 w-6 text-brand-warm" />
            </div>
            <p className="mt-4 text-body leading-8 text-white/68">{questPayload.coach.summary}</p>
            <div className="mt-6 space-y-3">
              {questPayload.coach.nextActions.map((action, index) => (
                <div key={action} className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4">
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold leading-6 text-white/74">{action}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/student"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              回到策略台执行
              <ArrowRight className="h-4 w-4" />
            </Link>
            {claimResult && (
              <div
                role="status"
                data-testid="quest-claim-result"
                className="mt-5 rounded-[1.35rem] border border-brand/25 bg-brand/12 p-4"
              >
                <p className="text-sm font-black text-brand-warm">奖励已领取</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/74">
                  {claimResult.reward} 已加入成长轨迹。奖励只做装饰，不改变战力或净值。
                </p>
              </div>
            )}
            {claimError && (
              <p role="alert" className="mt-4 rounded-2xl bg-error-soft p-4 text-sm font-bold text-error">
                {claimError}
              </p>
            )}
          </aside>
        </div>
      </section>

      <section data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">本周任务栏</h2>
            </div>
            <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
              任务来自真实行为，不是额外刷分入口。完成后只获得称号、徽章、边框等装饰奖励，榜单和净值仍由沙盘决策决定。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterLabels.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-bold transition",
                  filter === item.id
                    ? "border-border-brand bg-brand text-white shadow-glow"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {visibleQuests.map((quest) => (
            <article
              key={quest.id}
              className="rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-950/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{quest.category}</p>
                  <h3 className="mt-2 text-h2 font-bold text-slate-950">{quest.title}</h3>
                </div>
                <QuestStatusBadge status={quest.status} />
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{quest.target}</p>
              <div className="mt-5 h-3 rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    quest.status === "watch"
                      ? "bg-warning"
                      : quest.status === "locked"
                        ? "bg-slate-300"
                        : "bg-gradient-to-r from-brand to-down",
                  )}
                  style={{ width: `${Math.max(quest.status === "locked" ? 0 : 8, quest.progress * 100)}%` }}
                />
              </div>
              <div className="mt-4 rounded-[1.2rem] bg-slate-950/[0.035] p-4">
                <p className="text-sm font-bold text-slate-950">{quest.reward}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{quest.coachNote}</p>
              </div>
              <button
                type="button"
                data-testid={`quest-claim-${quest.id}`}
                onClick={() => void claimQuest(quest.id)}
                disabled={!quest.claimable || claimingQuestId !== null}
                className={cn(
                  "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition",
                  quest.claimable
                    ? "bg-brand text-white shadow-glow hover:-translate-y-0.5"
                    : quest.claimed
                      ? "bg-slate-950 text-white"
                      : "cursor-not-allowed bg-slate-100 text-slate-400",
                )}
              >
                {claimingQuestId === quest.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : quest.claimed ? (
                  <BadgeCheck className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {quest.claimed ? "已领取装饰奖励" : quest.claimable ? "领取装饰奖励" : "完成后可领取"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-brand" />
              <div>
                <h2 className="text-h1 font-semibold text-slate-950">收益日历</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  更新时间：{formatGeneratedAt(questPayload.generatedAt)}（北京时间）
                </p>
              </div>
            </div>
            <span className="rounded-full bg-brand-subtle px-4 py-2 text-sm font-bold text-brand-ink">
              {questPayload.overview.stageLabel}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {questPayload.calendar.map((day) => (
              <article
                key={day.round}
                data-calendar-cell
                className={cn(
                  "rounded-[1.35rem] border p-4",
                  day.tone === "up" && "border-up/20 bg-up-soft",
                  day.tone === "down" && "border-down/20 bg-down-soft",
                  day.tone === "flat" && "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">第 {day.round} 回合</p>
                  <span className="text-xs font-bold text-slate-500">{day.label}</span>
                </div>
                <p className="mt-3 text-xl font-black">
                  <MoneyText>{formatCurrency(day.netWorth)}</MoneyText>
                </p>
                <p className="mt-2 text-sm font-bold">
                  <MoneyText>{formatCurrency(day.delta)}</MoneyText>
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-slate-950">成就墙</h2>
          </div>
          <p className="mt-2 text-body leading-7 text-slate-600">
            成就只代表学习轨迹，不代表真实投资能力，也不会直接改变榜单战力。
          </p>
          <div className="mt-5 space-y-3">
            {questPayload.achievements.map((achievement) => (
              <article
                key={achievement.id}
                className={cn(
                  "rounded-[1.35rem] border p-4",
                  achievement.unlocked
                    ? "border-border-brand bg-brand-subtle"
                    : "border-slate-200 bg-slate-950/[0.025]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      achievement.unlocked ? "bg-brand text-white" : "bg-slate-200 text-slate-500",
                    )}
                  >
                    {achievement.unlocked ? <BadgeCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-slate-950">{achievement.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{achievement.detail}</p>
                    <p className="mt-2 text-xs font-bold text-brand-ink">{achievement.decorativeReward}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
