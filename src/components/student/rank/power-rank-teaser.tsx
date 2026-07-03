"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LineChart } from "lucide-react";

import { SCOPE_LABELS, type PowerCardDTO, type RankScope } from "./types";

const SCOPE_ORDER: RankScope[] = ["school", "city", "province", "nation"];

/** Compact learning progress teaser for the student dashboard — drives discovery of /student/rank. */
export function PowerRankTeaser() {
  const [card, setCard] = useState<PowerCardDTO | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setError(null);
    void (async () => {
      try {
        const response = await fetch("/api/leaderboard/me", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as
          | { card?: PowerCardDTO; message?: string }
          | null;
        if (!alive) return;
        if (!response.ok) {
          setCard(null);
          setError(data?.message ?? "学习榜入口暂时加载失败，请重试。");
          return;
        }
        setCard(data?.card ?? null);
      } catch {
        if (alive) {
          setCard(null);
          setError("网络连接不稳定，学习榜入口暂时加载失败。");
        }
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [retryKey]);

  if (!loaded) {
    return <div className="mt-5 h-28 animate-pulse rounded-[1.7rem] bg-bg-muted" aria-hidden="true" />;
  }

  if (error) {
    return (
      <div className="mt-5 rounded-[1.7rem] border border-[var(--error-100)] bg-[var(--error-50)] p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--error-600)]">
            <LineChart className="h-4 w-4" /> 学习进度
          </span>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-fg-default shadow-sm transition hover:-translate-y-0.5"
          >
            重试
          </button>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--error-600)]">{error}</p>
      </div>
    );
  }

  // Most-local available rank (school first), the line a student cares about most.
  const best = SCOPE_ORDER.map((scope) => ({ scope, rank: card?.ranks[scope] })).find(
    (x) => x.rank !== undefined,
  );

  return (
    <Link
      href="/student/rank"
      className="mt-5 block overflow-hidden rounded-[1.7rem] border border-border bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] transition hover:shadow-[0_18px_44px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-default">
          <LineChart className="h-4 w-4 text-brand" /> 学习进度
        </span>
        <ChevronRight className="h-4 w-4 text-fg-muted" />
      </div>

      {!card || !card.hasProfile ? (
        <p className="mt-3 rounded-xl bg-brand-subtle px-3 py-3 text-center text-sm font-semibold text-brand-ink">
          建立学习档案，查看你的复盘节奏 →
        </p>
      ) : !card.ranked ? (
        <p className="mt-3 text-sm leading-6 text-fg-muted">
          完成一局沙盘即可生成学习记录，看到自己的复盘区间。
        </p>
      ) : (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="bz-hero-stat text-hero-num font-mono tabular-nums leading-none">
              {card.power.toLocaleString("zh-CN")}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5">
              <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-semibold text-brand-ink">
                {card.tier.name}
              </span>
              {best ? (
                <span className="text-xs text-fg-muted">
                  {SCOPE_LABELS[best.scope]}第 {best.rank} 名
                </span>
              ) : null}
            </p>
          </div>
          <span className="bz-brand-text-on-light shrink-0 text-xs font-semibold">查看学习榜</span>
        </div>
      )}
    </Link>
  );
}
