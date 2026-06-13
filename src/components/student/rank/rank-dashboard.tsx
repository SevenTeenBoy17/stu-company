"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { PowerCard } from "./power-card";
import { RankBoard } from "./rank-board";
import { RankOnboarding } from "./rank-onboarding";
import type { FormulaDTO, PowerCardDTO, RankScope } from "./types";

interface MeResponse {
  card: PowerCardDTO;
  formula: FormulaDTO;
}

export function RankDashboard() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped after onboarding to re-run the fetch effect (setState stays inside
  // the async callbacks, per the codebase's effect pattern).
  const [refreshKey, setRefreshKey] = useState(0);
  // Region scope is lifted here so the hero's per-region tiles and the board's
  // own selector stay in sync — clicking 全国 on either drives the same board.
  const [scope, setScope] = useState<RankScope>("school");

  useEffect(() => {
    let alive = true;
    void fetch("/api/leaderboard/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
      .then((payload) => {
        if (!alive) return;
        setData(payload);
        setLoading(false);
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[1.7rem] border border-border bg-white p-12 text-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">加载战力数据…</span>
      </div>
    );
  }

  if (!data || !data.card.hasProfile) {
    return <RankOnboarding onComplete={() => setRefreshKey((k) => k + 1)} />;
  }

  return (
    <div className="space-y-4">
      <PowerCard
        card={data.card}
        formula={data.formula}
        scope={scope}
        onScopeChange={setScope}
      />
      <RankBoard scope={scope} onScopeChange={setScope} />
    </div>
  );
}
