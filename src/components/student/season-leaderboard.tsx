"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

import type { LeaderboardEntry } from "@/lib/types";

type SeasonPayload = {
  seasonKey: string;
  leaderboard: LeaderboardEntry[];
  viewerId: string;
};

/** P2: global weekly season leaderboard — everyone this week shares one market. */
export function SeasonLeaderboard() {
  const [data, setData] = useState<SeasonPayload | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/market/season-leaderboard", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SeasonPayload | null) => {
        if (alive && payload) setData(payload);
      })
      .catch(() => {
        // Leaderboard is non-critical; hide on failure.
      });
    return () => {
      alive = false;
    };
  }, []);

  const topThreeViewer =
    data?.leaderboard.find((entry) => entry.userId === data.viewerId && entry.rank <= 3) ?? null;

  return (
    <section className="mt-5 overflow-hidden rounded-[1.7rem] border border-border bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-brand" />
        <p className="text-sm font-semibold text-fg-default">本周赛季榜</p>
        {data ? (
          <span className="rounded-full bg-bg-muted px-2 py-0.5 text-xs font-medium text-fg-muted">
            {data.seasonKey}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-fg-muted">
        本周所有玩家面对同一套行情，凭决策一较高下。每周一刷新。
      </p>

      {!data ? (
        <ol className="mt-3 space-y-1.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="h-9 animate-pulse rounded-xl bg-bg-muted" />
          ))}
        </ol>
      ) : data.leaderboard.length === 0 ? (
        <p className="mt-3 rounded-xl bg-bg-muted px-3 py-4 text-center text-sm text-fg-muted">
          本周赛季刚开始，完成一局即可上榜 🏁
        </p>
      ) : (
        <>
          {topThreeViewer ? (
            <p className="mt-3 rounded-xl bg-brand-subtle px-3 py-2 text-center text-sm font-bold text-brand-ink">
              {topThreeViewer.rank === 1
                ? "🥇 本周你暂列第一，守住到周一刷新！"
                : `${topThreeViewer.rank === 2 ? "🥈" : "🥉"} 你已挤进本周前三，继续加油！`}
            </p>
          ) : null}
          <ol className="mt-3 space-y-1.5">
            {data.leaderboard.map((entry) => {
              const isViewer = entry.userId === data.viewerId;
              return (
                <li
                  key={entry.userId}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                    isViewer ? "bg-brand-subtle font-bold text-brand-ink" : "bg-bg-muted text-fg-default"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-fg-subtle">
                      #{entry.rank}
                    </span>
                    <span className="truncate text-sm">
                      {entry.name}
                      {isViewer ? " （你）" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    ￥{entry.netWorth.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="mt-3 text-[11px] leading-4 text-fg-subtle">
        排名只反映教育模拟里的决策表现，不构成任何投资建议。
      </p>
    </section>
  );
}
