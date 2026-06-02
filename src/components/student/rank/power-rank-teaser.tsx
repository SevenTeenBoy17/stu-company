"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Swords } from "lucide-react";

import { SCOPE_LABELS, type PowerCardDTO, type RankScope } from "./types";

const SCOPE_ORDER: RankScope[] = ["school", "city", "province", "nation"];

/** Compact 财商战力 teaser for the student dashboard — drives discovery of /student/rank. */
export function PowerRankTeaser() {
  const [card, setCard] = useState<PowerCardDTO | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch("/api/leaderboard/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ card: PowerCardDTO }>) : null))
      .then((data) => {
        if (!alive) return;
        setCard(data?.card ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded) {
    return <div className="mt-5 h-28 animate-pulse rounded-[1.7rem] bg-bg-muted" aria-hidden="true" />;
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
          <Swords className="h-4 w-4 text-brand" /> 财商战力
        </span>
        <ChevronRight className="h-4 w-4 text-fg-muted" />
      </div>

      {!card || !card.hasProfile ? (
        <p className="mt-3 rounded-xl bg-brand-subtle px-3 py-3 text-center text-sm font-semibold text-brand-ink">
          加入战力榜，和同校 / 同城同学比拼财商 →
        </p>
      ) : !card.ranked ? (
        <p className="mt-3 text-sm leading-6 text-fg-muted">
          完成一局沙盘即可生成你的财商战力并参与排名。
        </p>
      ) : (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-4xl font-black tabular-nums leading-none text-fg-default">
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
          <span className="shrink-0 text-xs font-medium text-brand">查看战力榜</span>
        </div>
      )}
    </Link>
  );
}
