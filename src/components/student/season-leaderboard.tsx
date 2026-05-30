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

  if (!data || data.leaderboard.length === 0) return null;

  return (
    <section className="mt-5 overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[#f08a38]" />
        <p className="text-sm font-semibold text-slate-950">本周赛季榜</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {data.seasonKey}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        本周所有玩家面对同一套行情，凭决策一较高下。每周一刷新。
      </p>
      <ol className="mt-3 space-y-1.5">
        {data.leaderboard.map((entry) => {
          const isViewer = entry.userId === data.viewerId;
          return (
            <li
              key={entry.userId}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                isViewer ? "bg-[#fff4e9] font-bold text-[#7a4717]" : "bg-slate-50 text-slate-700"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">
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
    </section>
  );
}
