"use client";

import { useEffect, useState } from "react";
import { Crown, Flame, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  aliasInfo,
  PERIOD_LABELS,
  SCOPE_LABELS,
  type BoardDTO,
  type RankPeriod,
  type RankScope,
} from "./types";

const SCOPES: RankScope[] = ["school", "city", "province", "nation"];
const PERIODS: RankPeriod[] = ["weekly", "monthly", "season"];

function monogram(name: string, anonymous: boolean): string {
  if (anonymous) return "?";
  const first = [...name].find((ch) => ch.trim().length > 0);
  return (first ?? "?").toUpperCase();
}

/** Top-3 get gold / silver / bronze; everyone else a calm neutral chip. */
function rankBadgeClass(rank: number): string {
  if (rank === 1)
    return "bg-gradient-to-br from-amber-200 via-yellow-100 to-amber-400 text-amber-900 shadow-[0_6px_16px_rgba(240,138,56,0.45)] ring-1 ring-amber-300/60";
  if (rank === 2)
    return "bg-gradient-to-br from-slate-100 to-slate-300 text-slate-700 ring-1 ring-slate-300/70";
  if (rank === 3)
    return "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-50 ring-1 ring-amber-600/40";
  return "bg-bg-muted text-fg-default";
}

export function RankBoard({
  scope,
  onScopeChange,
}: {
  scope: RankScope;
  onScopeChange: (next: RankScope) => void;
}) {
  const [period, setPeriod] = useState<RankPeriod>("weekly");
  const [board, setBoard] = useState<BoardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/leaderboard/board?scope=${scope}&period=${period}`, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as { board?: BoardDTO | null; message?: string } | null;
        if (!alive) return;
        if (!response.ok) {
          setBoard(null);
          setError(data?.message ?? "学习榜暂时加载失败，请稍后重试。");
          return;
        }
        setBoard(data?.board ?? null);
      } catch {
        if (alive) {
          setBoard(null);
          setError("网络连接不稳定，学习榜暂时加载失败。");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [scope, period, retryKey]);

  function selectScope(next: RankScope) {
    if (next === scope) return;
    onScopeChange(next);
  }
  function selectPeriod(next: RankPeriod) {
    if (next === period) return;
    setPeriod(next);
  }

  // The DTO echoes the scope/period it was fetched for, so the displayed board is
  // "stale" until it matches the current selection. Showing the skeleton on stale
  // covers BOTH the board's own tabs and hero-driven scope changes (which bypass
  // the handlers) — without a lint-flagged setState-in-an-effect.
  const showSkeleton =
    loading || (!!board && (board.scope !== scope || board.period !== period));

  // Gap-to-climb: how much more power until the viewer overtakes the rank above
  // them — the single most motivating number on the board.
  const viewer = board?.entries.find((e) => e.isViewer) ?? null;
  const ahead = viewer ? board?.entries.find((e) => e.rank === viewer.rank - 1) ?? null : null;
  const gapToClimb = viewer && ahead ? Math.max(0, ahead.power - viewer.power) : null;

  return (
    <section
      id="rank-board"
      className="overflow-hidden rounded-[1.7rem] border border-border bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <Trophy className="h-4 w-4" />
        </span>
        <h3 className="text-base font-bold text-fg-strong">学习进度榜</h3>
        {board ? (
          <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-semibold text-fg-default">
            共 {board.total} 人
          </span>
        ) : null}
      </div>

      {/* Region selector — full-width horizontal segmented control */}
      <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-full bg-bg-muted p-1">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => selectScope(s)}
            aria-pressed={scope === s}
            className={cn(
              // Every segment carries a visible border + chip background so an
              // inactive tab still reads as a clickable button, not plain text.
              "cursor-pointer rounded-full border px-2 py-2 text-xs font-bold transition",
              scope === s
                ? "border-brand bg-brand text-fg-default shadow-[0_4px_12px_rgba(240,138,56,0.35)]"
                : "border-border bg-white text-fg-muted hover:border-brand-warm hover:bg-brand-subtle hover:text-fg-default",
            )}
          >
            {SCOPE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Period selector — full-width horizontal segmented control */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-full bg-bg-muted p-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => selectPeriod(p)}
            aria-pressed={period === p}
            className={cn(
              "cursor-pointer rounded-full border px-2 py-2 text-xs font-semibold transition",
              period === p
                ? "border-brand-warm bg-brand-subtle text-brand-ink shadow-sm"
                : "border-border bg-white text-fg-muted hover:border-brand-warm hover:bg-brand-subtle hover:text-fg-default",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {board && board.viewerRank ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-brand-subtle to-amber-100/50 px-4 py-3 ring-1 ring-amber-200/70">
          <p className="text-sm font-bold text-brand-ink">
            你在「{SCOPE_LABELS[scope]}·{PERIOD_LABELS[period]}」位于学习记录区间 {board.viewerRank}
          </p>
          {gapToClimb !== null && gapToClimb > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-brand-ink">
              <Flame className="h-3.5 w-3.5" /> 再积累 {gapToClimb.toLocaleString("zh-CN")} 点学习记录即可解锁下一复盘区间
            </span>
          ) : board.viewerRank === 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-brand-ink">
              <Crown className="h-3.5 w-3.5" /> 当前节奏领先，继续保持稳定复盘
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-brand-ink">
              <Flame className="h-3.5 w-3.5" /> 继续打磨决策，稳步进入更稳区间
            </span>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-[var(--error-100)] bg-[var(--error-50)] px-4 py-4">
          <p className="text-sm font-bold text-[var(--error-600)]">{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold text-fg-default shadow-sm transition hover:-translate-y-0.5"
          >
            重新加载学习榜
          </button>
        </div>
      ) : showSkeleton ? (
        <ol className="mt-4 space-y-2" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-2xl bg-bg-muted" />
          ))}
        </ol>
      ) : !board || board.entries.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-bg-muted px-3 py-6 text-center text-sm text-fg-default">
          本范围本期还没有学习记录，完成一局沙盘后就能看到自己的复盘位置。
        </p>
      ) : (
        <ol className="mt-4 space-y-2">
          {board.entries.map((entry, index) => {
            const { name, anonymous } = aliasInfo(entry.alias);
            const champion = entry.rank === 1;
            return (
              <li
                key={entry.rank}
                data-motion-reveal
                data-motion-card
                data-motion-delay={Math.min(index * 0.04, 0.4)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-3",
                  entry.isViewer
                    ? "bg-brand-subtle ring-2 ring-brand"
                    : champion
                      ? "bg-gradient-to-r from-amber-50 to-white ring-1 ring-amber-200/70"
                      : "bg-bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                    rankBadgeClass(entry.rank),
                  )}
                >
                  {entry.rank}
                </span>
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1",
                    entry.isViewer
                      ? "bg-brand text-slate-950 ring-brand"
                      : anonymous
                        ? "bg-bg-muted text-fg-subtle ring-border"
                        : "bg-white text-fg-default ring-border",
                  )}
                >
                  {monogram(name, anonymous)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm font-bold",
                        entry.isViewer ? "text-brand-ink" : "text-fg-default",
                      )}
                      title={name}
                    >
                      {name}
                      {entry.isViewer ? " （你）" : ""}
                    </span>
                    {champion ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
                  </span>
                  {scope !== "school" ? (
                    <span className="block truncate text-[0.7rem] text-fg-muted">
                      {aliasInfo(entry.schoolName).anonymous ? "未公开学校" : entry.schoolName}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-lg font-bold tabular-nums text-[color:var(--up-600)]">
                    {entry.power.toLocaleString("zh-CN")}
                  </span>
                  <span className="block text-[0.6rem] font-bold uppercase tracking-wider text-fg-muted">
                    学习点
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 text-xs leading-5 text-fg-muted">
        榜单只反映教育模拟中的决策表现，不构成任何投资建议。每周一刷新。
      </p>
    </section>
  );
}
