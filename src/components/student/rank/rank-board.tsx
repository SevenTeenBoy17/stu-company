"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

import {
  PERIOD_LABELS,
  SCOPE_LABELS,
  type BoardDTO,
  type RankPeriod,
  type RankScope,
} from "./types";

const SCOPES: RankScope[] = ["school", "city", "province", "nation"];
const PERIODS: RankPeriod[] = ["weekly", "monthly", "season"];

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

export function RankBoard() {
  const [scope, setScope] = useState<RankScope>("school");
  const [period, setPeriod] = useState<RankPeriod>("weekly");
  const [board, setBoard] = useState<BoardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // setState happens only in async callbacks below (never synchronously in the
    // effect body). Loading is flipped on by the tab handlers (event context).
    void fetch(`/api/leaderboard/board?scope=${scope}&period=${period}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { board: BoardDTO | null } | null) => {
        if (alive) setBoard(data?.board ?? null);
      })
      .catch(() => {
        if (alive) setBoard(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [scope, period]);

  function selectScope(next: RankScope) {
    if (next === scope) return;
    setLoading(true);
    setScope(next);
  }
  function selectPeriod(next: RankPeriod) {
    if (next === period) return;
    setLoading(true);
    setPeriod(next);
  }

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-border bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold text-fg-default">排行榜</h3>
        {board ? (
          <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-fg-muted">
            共 {board.total} 人
          </span>
        ) : null}
      </div>

      {/* Scope tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => selectScope(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              scope === s ? "bg-brand text-white" : "bg-bg-muted text-fg-muted hover:text-fg-default"
            }`}
          >
            {SCOPE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Period tabs */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => selectPeriod(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              period === p
                ? "bg-brand-subtle text-brand-ink"
                : "bg-bg-muted text-fg-muted hover:text-fg-default"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {board && board.viewerRank ? (
        <p className="mt-3 rounded-xl bg-brand-subtle px-3 py-2 text-center text-sm font-bold text-brand-ink">
          你在「{SCOPE_LABELS[scope]}·{PERIOD_LABELS[period]}」暂列第 {board.viewerRank} 名
        </p>
      ) : null}

      {loading ? (
        <ol className="mt-3 space-y-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-10 animate-pulse rounded-xl bg-bg-muted" />
          ))}
        </ol>
      ) : !board || board.entries.length === 0 ? (
        <p className="mt-3 rounded-xl bg-bg-muted px-3 py-5 text-center text-sm text-fg-muted">
          本范围本期还没有上榜的同学，完成一局沙盘抢占头名 🏁
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {board.entries.map((entry) => (
            <li
              key={entry.userId}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                entry.isViewer ? "bg-brand-subtle font-bold text-brand-ink" : "bg-bg-muted text-fg-default"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums">
                  {medal(entry.rank)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm" title={entry.alias}>
                    {entry.alias}
                    {entry.isViewer ? " （你）" : ""}
                  </span>
                  {scope !== "school" ? (
                    <span className="block truncate text-[0.7rem] text-fg-muted">{entry.schoolName}</span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                {entry.power.toLocaleString("zh-CN")}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-xs leading-5 text-fg-muted">
        榜单只反映教育模拟中的决策表现，不构成任何投资建议。每周一刷新。
      </p>
    </section>
  );
}
