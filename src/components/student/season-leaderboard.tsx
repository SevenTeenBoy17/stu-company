"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

import type { PublicSeasonLeaderboardEntry } from "@/lib/types";

type SeasonPayload = {
  seasonKey: string;
  leaderboard: PublicSeasonLeaderboardEntry[];
};

/** P2: global weekly season leaderboard — everyone this week shares one market. */
export function SeasonLeaderboard() {
  const [data, setData] = useState<SeasonPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch("/api/market/season-leaderboard", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as (SeasonPayload & { message?: string }) | null;
        if (!alive) return;
        if (!response.ok || !payload) {
          setData(null);
          setError(payload?.message ?? "本周赛季榜暂时加载失败，请稍后重试。");
          return;
        }
        setData(payload);
      } catch {
        if (alive) {
          setData(null);
          setError("网络连接不稳定，本周赛季榜暂时加载失败。");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [retryKey]);

  const topThreeViewer =
    data?.leaderboard.find((entry) => entry.isViewer && entry.rank <= 3) ?? null;

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

      {error ? (
        <div className="mt-3 rounded-xl border border-[var(--error-100)] bg-[var(--error-50)] px-3 py-4">
          <p className="text-sm font-bold text-[var(--error-600)]">{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-fg-default shadow-sm transition hover:-translate-y-0.5"
          >
            重新加载赛季榜
          </button>
        </div>
      ) : loading ? (
        <ol className="mt-3 space-y-1.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="h-9 animate-pulse rounded-xl bg-bg-muted" />
          ))}
        </ol>
      ) : !data || data.leaderboard.length === 0 ? (
        <p className="mt-3 rounded-xl bg-bg-muted px-3 py-4 text-center text-sm text-fg-muted">
          本周赛季刚开始，完成一局即可上榜 🏁
        </p>
      ) : (
        <>
          {topThreeViewer ? (
            <p className="mt-3 rounded-xl bg-brand-subtle px-3 py-2 text-center text-sm font-bold text-brand-ink">
              {topThreeViewer.rank === 1
                ? "🥇 本周你的复盘表现很稳定，继续保持节奏！"
                : `${topThreeViewer.rank === 2 ? "🥈" : "🥉"} 本周你的学习记录进入前列，继续复盘！`}
            </p>
          ) : null}
          <ol className="mt-3 space-y-1.5">
            {data.leaderboard.map((entry) => {
              const isViewer = entry.isViewer;
              return (
                <li
                  key={entry.rank}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                    isViewer ? "bg-brand-subtle font-bold text-brand-ink" : "bg-bg-muted text-fg-default"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-fg-muted">
                      #{entry.rank}
                    </span>
                    <span className="truncate text-sm" title={entry.name}>
                      {entry.name}
                      {isViewer ? " （你）" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    ￥{entry.netWorth.toLocaleString("zh-CN")}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="mt-3 text-xs leading-5 text-fg-muted">
        排名只反映教育模拟里的决策表现，不构成任何投资建议。
      </p>
    </section>
  );
}
